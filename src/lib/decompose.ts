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
  request: DecomposeRequest
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

  // Fix invalid dependency references (remove non-existent IDs)
  for (const step of validated.steps) {
    step.dependencies = step.dependencies.filter((depId) =>
      validStepIds.has(depId)
    );
  }

  // Fix invalid gap stepIds (remove non-existent IDs)
  for (const gap of validated.gaps) {
    gap.stepIds = gap.stepIds.filter((sid) => validStepIds.has(sid));
  }

  // Remove gaps that ended up with zero stepIds after cleanup
  const cleanGaps = validated.gaps.filter((g) => g.stepIds.length > 0);

  // Detect circular dependencies — if found, break the cycle
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const stepMap = new Map(validated.steps.map((s) => [s.id, s]));

  function hasCycle(stepId: string): boolean {
    if (inStack.has(stepId)) return true;
    if (visited.has(stepId)) return false;
    visited.add(stepId);
    inStack.add(stepId);
    const step = stepMap.get(stepId);
    if (step) {
      for (const dep of step.dependencies) {
        if (hasCycle(dep)) {
          // Break cycle by removing this dependency
          step.dependencies = step.dependencies.filter((d) => d !== dep);
          return false; // cycle broken, continue
        }
      }
    }
    inStack.delete(stepId);
    return false;
  }

  for (const step of validated.steps) {
    visited.clear();
    inStack.clear();
    hasCycle(step.id);
  }

  // Clamp automation scores to valid range (defense-in-depth)
  for (const step of validated.steps) {
    step.automationScore = Math.max(0, Math.min(100, Math.round(step.automationScore)));
  }

  const health = computeHealth(validated.steps, cleanGaps);

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
