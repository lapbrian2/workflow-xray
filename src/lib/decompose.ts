import { z } from "zod";
import { callClaude, getPromptVersion, getModelId } from "./claude";
import { computeHealth } from "./scoring";
import type { Decomposition, DecomposeRequest } from "./types";
import { generateId } from "./utils";
import { buildOrgContext, formatOrgContextForPrompt } from "./org-context";

export interface DecomposeMetadata {
  promptVersion: string;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
}

const StepSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  owner: z.string().nullable(),
  layer: z.enum(["cell", "orchestration", "memory", "human", "integration"]),
  inputs: z.array(z.string()),
  outputs: z.array(z.string()),
  tools: z.array(z.string()),
  automationScore: z.number().min(0).max(100),
  dependencies: z.array(z.string()),
});

const GapSchema = z.object({
  type: z.enum([
    "bottleneck",
    "context_loss",
    "single_dependency",
    "manual_overhead",
    "missing_feedback",
    "missing_fallback",
    "scope_ambiguity",
  ]),
  severity: z.enum(["low", "medium", "high"]),
  stepIds: z.array(z.string()),
  description: z.string(),
  suggestion: z.string(),
  timeWaste: z.string().optional(),
  effortLevel: z.enum(["quick_win", "incremental", "strategic"]).optional(),
  impactedRoles: z.array(z.string()).optional(),
  confidence: z.enum(["high", "inferred"]).optional().default("inferred"),
});

const DecompositionResponseSchema = z.object({
  title: z.string(),
  steps: z.array(StepSchema),
  gaps: z.array(GapSchema),
});

function buildPrompt(request: DecomposeRequest, orgContext?: string): string {
  let prompt = `Analyze and decompose this workflow:\n\n${request.description}`;

  if (request.stages && request.stages.length > 0) {
    prompt += "\n\nStructured stages provided:\n";
    request.stages.forEach((stage, i) => {
      prompt += `\nStage ${i + 1}: ${stage.name}`;
      if (stage.owner) prompt += `\n  Owner: ${stage.owner}`;
      if (stage.tools) prompt += `\n  Tools: ${stage.tools}`;
      if (stage.inputs) prompt += `\n  Inputs: ${stage.inputs}`;
      if (stage.outputs) prompt += `\n  Outputs: ${stage.outputs}`;
    });
  }

  if (request.context) {
    if (request.context.team.length > 0) {
      prompt += `\n\nTeam members: ${request.context.team.join(", ")}`;
    }
    if (request.context.tools.length > 0) {
      prompt += `\nTools used: ${request.context.tools.join(", ")}`;
    }
  }

  // Inject organizational memory context
  if (orgContext) {
    prompt += `\n\n${orgContext}`;
  }

  return prompt;
}

export interface PartialDecompositionInfo {
  _partial: boolean;
  _recoveryReason?: string;
}

// Multi-strategy JSON extraction from Claude's response
function extractJsonFromResponse(raw: string): unknown | null {
  // Strategy 1: Code fence extraction
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]); } catch { /* next strategy */ }
  }
  // Strategy 2: Direct parse
  try { return JSON.parse(raw); } catch { /* next strategy */ }
  // Strategy 3: Find largest JSON object
  const objMatch = raw.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch { /* next strategy */ }
  }
  return null;
}

// Partial recovery when Zod validation fails
function recoverPartialDecomposition(raw: unknown): {
  title: string;
  steps: z.infer<typeof StepSchema>[];
  gaps: z.infer<typeof GapSchema>[];
  _partial: boolean;
  _recoveryReason: string;
} {
  const obj = raw as Record<string, unknown>;

  const title = typeof obj.title === "string" ? obj.title : "Untitled Analysis";

  const VALID_LAYERS = ["cell", "orchestration", "memory", "human", "integration"] as const;
  const VALID_SEVERITIES = ["low", "medium", "high"] as const;
  const VALID_GAP_TYPES = [
    "bottleneck", "context_loss", "single_dependency", "manual_overhead",
    "missing_feedback", "missing_fallback", "scope_ambiguity",
  ] as const;
  const VALID_EFFORT = ["quick_win", "incremental", "strategic"] as const;

  // Recover steps
  const rawSteps = Array.isArray(obj.steps) ? obj.steps : [];
  const steps = rawSteps
    .map((s: unknown, i: number) => {
      if (typeof s !== "object" || !s) return null;
      const step = s as Record<string, unknown>;
      return {
        id: typeof step.id === "string" ? step.id : `step_${i + 1}`,
        name: typeof step.name === "string" ? step.name : `Step ${i + 1}`,
        description: typeof step.description === "string" ? step.description : "",
        owner: typeof step.owner === "string" ? step.owner : null,
        layer: (VALID_LAYERS as readonly string[]).includes(step.layer as string)
          ? (step.layer as typeof VALID_LAYERS[number])
          : "human" as const,
        inputs: Array.isArray(step.inputs) ? step.inputs.filter((x: unknown) => typeof x === "string") : [],
        outputs: Array.isArray(step.outputs) ? step.outputs.filter((x: unknown) => typeof x === "string") : [],
        tools: Array.isArray(step.tools) ? step.tools.filter((x: unknown) => typeof x === "string") : [],
        automationScore: typeof step.automationScore === "number"
          ? Math.max(0, Math.min(100, Math.round(step.automationScore))) : 50,
        dependencies: Array.isArray(step.dependencies) ? step.dependencies.filter((x: unknown) => typeof x === "string") : [],
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  // Recover gaps
  const rawGaps = Array.isArray(obj.gaps) ? obj.gaps : [];
  const gaps = rawGaps
    .map((g: unknown) => {
      if (typeof g !== "object" || !g) return null;
      const gap = g as Record<string, unknown>;
      const description = typeof gap.description === "string" ? gap.description : "";
      if (description.length === 0) return null;
      return {
        type: (VALID_GAP_TYPES as readonly string[]).includes(gap.type as string)
          ? (gap.type as typeof VALID_GAP_TYPES[number])
          : "manual_overhead" as const,
        severity: (VALID_SEVERITIES as readonly string[]).includes(gap.severity as string)
          ? (gap.severity as typeof VALID_SEVERITIES[number])
          : "medium" as const,
        stepIds: Array.isArray(gap.stepIds) ? gap.stepIds.filter((x: unknown) => typeof x === "string") : [],
        description,
        suggestion: typeof gap.suggestion === "string" ? gap.suggestion : "",
        timeWaste: typeof gap.timeWaste === "string" ? gap.timeWaste : undefined,
        effortLevel: (VALID_EFFORT as readonly string[]).includes(gap.effortLevel as string)
          ? (gap.effortLevel as typeof VALID_EFFORT[number])
          : undefined,
        impactedRoles: Array.isArray(gap.impactedRoles) ? gap.impactedRoles.filter((x: unknown) => typeof x === "string") : undefined,
        confidence: gap.confidence === "high" ? "high" as const : "inferred" as const,
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);

  return {
    title,
    steps,
    gaps,
    _partial: true,
    _recoveryReason: steps.length === 0
      ? "No valid steps could be recovered"
      : `Recovered ${steps.length} steps and ${gaps.length} gaps from malformed response`,
  };
}

export async function decomposeWorkflow(
  request: DecomposeRequest,
  teamSize?: number
): Promise<Decomposition & { _meta: DecomposeMetadata } & PartialDecompositionInfo> {
  // Build organizational context from saved library
  let orgContextStr: string | undefined;
  try {
    const orgCtx = await buildOrgContext(request.description);
    if (orgCtx) {
      orgContextStr = formatOrgContextForPrompt(orgCtx);
    }
  } catch {
    // Non-critical — proceed without org context
  }

  const prompt = buildPrompt(request, orgContextStr);
  const response = await callClaude(prompt);
  const raw = response.text;

  // Extract JSON from Claude's response using multi-strategy extraction
  const parsed = extractJsonFromResponse(raw);
  let isPartial = false;
  let recoveryReason: string | undefined;

  if (parsed === null) {
    // Total failure — return minimal result
    const minTitle = request.description.slice(0, 80).replace(/\n/g, " ").trim() || "Failed Analysis";
    const health = computeHealth([], [], teamSize);
    return {
      id: generateId(),
      title: minTitle,
      steps: [],
      gaps: [],
      health,
      _meta: {
        promptVersion: getPromptVersion(),
        modelUsed: getModelId(),
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
      _partial: true,
      _recoveryReason: "Could not extract any valid JSON from Claude response",
    };
  }

  let validated;
  const zodResult = DecompositionResponseSchema.safeParse(parsed);
  if (zodResult.success) {
    validated = zodResult.data;
  } else {
    // Attempt partial recovery
    const recovered = recoverPartialDecomposition(parsed);
    validated = recovered;
    isPartial = true;
    recoveryReason = recovered._recoveryReason;
  }

  // ── Referential integrity checks ──
  const validStepIds = new Set(validated.steps.map((s) => s.id));

  // Deduplicate step IDs — keep first occurrence if Claude duplicates
  const seenStepIds = new Set<string>();
  const deduped = validated.steps.filter((s) => {
    if (seenStepIds.has(s.id)) return false;
    seenStepIds.add(s.id);
    return true;
  });
  if (deduped.length < validated.steps.length) {
    validated.steps.length = 0;
    validated.steps.push(...deduped);
  }

  // Fix invalid dependency references (remove non-existent IDs + self-refs)
  for (const step of validated.steps) {
    step.dependencies = step.dependencies.filter(
      (depId) => validStepIds.has(depId) && depId !== step.id
    );
  }

  // Fix invalid gap stepIds (remove non-existent IDs)
  for (const gap of validated.gaps) {
    gap.stepIds = gap.stepIds.filter((sid) => validStepIds.has(sid));
  }

  // Keep gaps with stepIds OR system-level gaps (some gap types are global)
  const SYSTEM_GAP_TYPES = new Set(["scope_ambiguity", "missing_fallback"]);
  const cleanGaps = validated.gaps.filter(
    (g) => g.stepIds.length > 0 || SYSTEM_GAP_TYPES.has(g.type)
  );

  // Post-process confidence: safety net over Zod's .default("inferred")
  for (const gap of cleanGaps) {
    if (!gap.confidence) {
      gap.confidence = teamSize != null ? "high" : "inferred";
    }
  }

  // Detect and break circular dependencies via proper DFS
  const stepMap = new Map(validated.steps.map((s) => [s.id, s]));
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const edgesToRemove: { stepId: string; depId: string }[] = [];

  function detectCycles(stepId: string): void {
    if (visited.has(stepId)) return;
    visited.add(stepId);
    inStack.add(stepId);
    const step = stepMap.get(stepId);
    if (step) {
      // Iterate over a stable copy — never mutate during traversal
      for (const dep of [...step.dependencies]) {
        if (inStack.has(dep)) {
          // Back-edge found → mark for removal
          edgesToRemove.push({ stepId, depId: dep });
        } else if (!visited.has(dep)) {
          detectCycles(dep);
        }
      }
    }
    inStack.delete(stepId);
  }

  // Single pass — don't clear visited/inStack between start nodes
  for (const step of validated.steps) {
    if (!visited.has(step.id)) {
      detectCycles(step.id);
    }
  }

  // Apply cycle-breaking removals after full traversal
  for (const { stepId, depId } of edgesToRemove) {
    const step = stepMap.get(stepId);
    if (step) {
      step.dependencies = step.dependencies.filter((d) => d !== depId);
    }
  }

  // Clamp automation scores to valid range (defense-in-depth)
  for (const step of validated.steps) {
    step.automationScore = Math.max(0, Math.min(100, Math.round(step.automationScore)));
  }

  const health = computeHealth(validated.steps, cleanGaps, teamSize);

  return {
    id: generateId(),
    title: validated.title,
    steps: validated.steps,
    gaps: cleanGaps,
    health,
    _meta: {
      promptVersion: getPromptVersion(),
      modelUsed: getModelId(),
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    },
    _partial: isPartial,
    _recoveryReason: recoveryReason,
  };
}
