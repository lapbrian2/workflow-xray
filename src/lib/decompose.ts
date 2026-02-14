import { z } from "zod";
import { callClaude } from "./claude";
import { computeHealth } from "./scoring";
import type { Decomposition, DecomposeRequest } from "./types";
import { generateId } from "./utils";

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
  ]),
  severity: z.enum(["low", "medium", "high"]),
  stepIds: z.array(z.string()),
  description: z.string(),
  suggestion: z.string(),
});

const DecompositionResponseSchema = z.object({
  title: z.string(),
  steps: z.array(StepSchema),
  gaps: z.array(GapSchema),
});

function buildPrompt(request: DecomposeRequest): string {
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

  return prompt;
}

export async function decomposeWorkflow(
  request: DecomposeRequest
): Promise<Decomposition> {
  const prompt = buildPrompt(request);
  const raw = await callClaude(prompt);

  // Extract JSON from Claude's response (it might wrap in markdown code blocks)
  let jsonStr = raw;
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  const parsed = JSON.parse(jsonStr);
  const validated = DecompositionResponseSchema.parse(parsed);

  const health = computeHealth(validated.steps, validated.gaps);

  return {
    id: generateId(),
    title: validated.title,
    steps: validated.steps,
    gaps: validated.gaps,
    health,
  };
}
