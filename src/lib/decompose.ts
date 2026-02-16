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

export async function decomposeWorkflow(
  request: DecomposeRequest,
  teamSize?: number
): Promise<Decomposition & { _meta: DecomposeMetadata }> {
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

  // Extract JSON from Claude's response (it might wrap in markdown code blocks)
  let jsonStr = raw;
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(
      `Claude returned invalid JSON: ${err instanceof Error ? err.message : "Parse failed"}. Response starts with: "${jsonStr.slice(0, 120)}..."`
    );
  }

  let validated;
  try {
    validated = DecompositionResponseSchema.parse(parsed);
  } catch (err) {
    throw new Error(
      `Claude output failed schema validation: ${err instanceof Error ? err.message : "Validation error"}`
    );
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
  };
}
