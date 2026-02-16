import { NextRequest, NextResponse } from "next/server";
import { callClaudeRemediation, getRemediationPromptVersion, getModelId } from "@/lib/claude";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getWorkflow, saveWorkflow } from "@/lib/db";
import { parseExtractionJson } from "@/lib/extraction-schemas";
import { withApiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/api-errors";
import { RemediationInputSchema } from "@/lib/validation";
import type { RemediationInput } from "@/lib/validation";
import type { Workflow, RemediationPlan, RemediationPhase, ProjectedImpact } from "@/lib/types";
import { z } from "zod";

// ─── Zod schemas for OUTPUT validation (Claude response) ───

const TaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(["critical", "high", "medium", "low"]),
  effort: z.enum(["quick_win", "incremental", "strategic"]),
  owner: z.string().nullable().default(null),
  gapIds: z.array(z.number()).default([]),
  stepIds: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  successMetric: z.string().default(""),
  dependencies: z.array(z.string()).default([]),
});

const PhaseSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(""),
  timeframe: z.string().default(""),
  tasks: z.array(TaskSchema).min(1),
});

const ImpactSchema = z.object({
  metricName: z.string().min(1),
  currentValue: z.string(),
  projectedValue: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  assumption: z.string().default(""),
});

const RemediationResponseSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  phases: z.array(PhaseSchema).min(1),
  projectedImpact: z.array(ImpactSchema).default([]),
});

export const POST = withApiHandler<RemediationInput>(
  async (request, body) => {
    // Rate limit: 10 remediation plans per minute per IP
    const ip = getClientIp(request);
    const rl = rateLimit(`remediation:${ip}`, 10, 60);
    if (!rl.allowed) {
      throw new AppError("RATE_LIMITED", `Rate limit exceeded. Try again in ${rl.resetInSeconds}s.`, 429);
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new AppError("SERVICE_UNAVAILABLE", "API key not configured.", 503);
    }

    // Load the workflow from storage
    const workflow = await getWorkflow(body.workflowId);
    if (!workflow) {
      throw new AppError("NOT_FOUND", "Workflow not found. It may have been deleted.", 404);
    }

    const { decomposition, costContext } = workflow;

    // Guard: no gaps = no remediation needed
    if (!decomposition.gaps || decomposition.gaps.length === 0) {
      throw new AppError("VALIDATION_ERROR", "This workflow has no gaps to remediate. A remediation plan requires at least one identified gap.", 400);
    }

    // Build the user message with diagnostic data
    const userMessage = buildRemediationPrompt(workflow, body.teamContext);

    // Call Claude
    let claudeResponse;
    try {
      claudeResponse = await callClaudeRemediation(userMessage);
    } catch (error) {
      console.error("[Remediation] Claude call failed:", error);
      const apiError = error as { status?: number; message?: string };
      if (apiError.status === 429) {
        throw new AppError("RATE_LIMITED", "AI service is busy. Please wait a moment and try again.", 429);
      }
      if (apiError.message?.includes("not found")) {
        throw new AppError("SERVICE_UNAVAILABLE", "Server configuration error — prompt files missing. Please contact support.", 503);
      }
      if (apiError.status && apiError.status >= 400) {
        throw new AppError("AI_ERROR", `AI service error. Please try again.`, 502);
      }
      throw new AppError("AI_ERROR", "Failed to generate remediation plan. Please try again.", 502);
    }

    // Parse JSON from response (handles code fences, embedded objects, etc.)
    let parsed;
    try {
      parsed = parseExtractionJson(claudeResponse.text);
    } catch {
      console.error("[Remediation] Failed to parse Claude response as JSON:", claudeResponse.text.slice(0, 200));
      throw new AppError("AI_ERROR", "Analysis failed — please try again.", 502);
    }

    // Validate against schema
    let validated;
    try {
      validated = RemediationResponseSchema.parse(parsed);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("[Remediation] Schema validation failed:", error.issues);
        throw new AppError("AI_ERROR", "Analysis produced invalid structure — please try again.", 502);
      }
      throw error;
    }

    // Add status to all tasks (default: not_started)
    const phases: RemediationPhase[] = validated.phases.map((phase) => ({
      ...phase,
      tasks: phase.tasks.map((task) => ({
        ...task,
        owner: task.owner ?? null,
        status: "not_started" as const,
      })),
    }));

    // Build the remediation plan
    const planId = `rem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const plan: RemediationPlan = {
      id: planId,
      workflowId: workflow.id,
      title: validated.title,
      summary: validated.summary,
      phases,
      projectedImpact: validated.projectedImpact as ProjectedImpact[],
      teamContext: body.teamContext || undefined,
      createdAt: now,
      updatedAt: now,
      promptVersion: getRemediationPromptVersion(),
      modelUsed: getModelId(),
      tokenUsage: {
        inputTokens: claudeResponse.inputTokens,
        outputTokens: claudeResponse.outputTokens,
      },
    };

    // Save plan alongside the workflow
    const updatedWorkflow: Workflow = {
      ...workflow,
      remediationPlan: plan,
      updatedAt: now,
    };
    await saveWorkflow(updatedWorkflow);

    return NextResponse.json({
      success: true,
      plan,
    });
  },
  { schema: RemediationInputSchema }
);

// Also support GET to retrieve existing plan
export const GET = withApiHandler(
  async (request) => {
    const ip = getClientIp(request);
    const rl = rateLimit(`remediation-get:${ip}`, 60, 60);
    if (!rl.allowed) {
      throw new AppError("RATE_LIMITED", `Rate limit exceeded. Try again in ${rl.resetInSeconds}s.`, 429);
    }

    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get("workflowId");

    if (!workflowId) {
      throw new AppError("VALIDATION_ERROR", "workflowId is required.", 400);
    }

    const workflow = await getWorkflow(workflowId);
    if (!workflow) {
      throw new AppError("NOT_FOUND", "Workflow not found.", 404);
    }

    if (!workflow.remediationPlan) {
      throw new AppError("NOT_FOUND", "No remediation plan exists for this workflow.", 404);
    }

    return NextResponse.json({ plan: workflow.remediationPlan });
  },
  { bodyType: "none" }
);

function buildRemediationPrompt(
  workflow: Workflow,
  teamContext?: {
    teamSize?: number;
    budget?: string;
    timeline?: string;
    constraints?: string[];
  }
): string {
  const { decomposition, costContext } = workflow;
  const { steps, gaps, health } = decomposition;

  let prompt = `## Workflow Diagnostic Summary\n\n`;
  prompt += `**Workflow:** ${decomposition.title}\n`;
  prompt += `**Steps:** ${steps.length}\n`;
  prompt += `**Gaps:** ${gaps.length}\n\n`;

  // Health scores
  prompt += `### Health Scores\n`;
  prompt += `- Complexity: ${health.complexity}/100\n`;
  prompt += `- Fragility: ${health.fragility}/100\n`;
  prompt += `- Automation Potential: ${health.automationPotential}%\n`;
  prompt += `- Team Load Balance: ${health.teamLoadBalance}/100\n\n`;

  // Steps summary
  prompt += `### Steps\n`;
  steps.forEach((s, i) => {
    prompt += `${i + 1}. **${s.name}** (${s.id}) — ${s.description}\n`;
    prompt += `   Layer: ${s.layer} | Owner: ${s.owner || "Unassigned"} | Automation: ${s.automationScore}%\n`;
    if (s.tools.length > 0) prompt += `   Tools: ${s.tools.join(", ")}\n`;
    prompt += `\n`;
  });

  // Gaps
  prompt += `### Gaps (indexed 0 to ${gaps.length - 1})\n`;
  gaps.forEach((g, i) => {
    prompt += `[${i}] **${g.type}** (${g.severity}) — ${g.description}\n`;
    prompt += `   Steps: ${g.stepIds.join(", ")}\n`;
    prompt += `   Suggestion: ${g.suggestion}\n`;
    if (g.timeWaste) prompt += `   Time waste: ${g.timeWaste}\n`;
    if (g.effortLevel) prompt += `   Effort: ${g.effortLevel}\n`;
    prompt += `\n`;
  });

  // Cost & team context
  if (costContext) {
    prompt += `### Cost & Team Context\n`;
    if (costContext.hourlyRate) prompt += `- Hourly rate: $${costContext.hourlyRate}\n`;
    if (costContext.hoursPerStep) prompt += `- Hours per step: ${costContext.hoursPerStep}\n`;
    if (costContext.teamSize) prompt += `- Team size: ${costContext.teamSize} people\n`;
    if (costContext.teamContext) prompt += `- Team description: ${costContext.teamContext}\n`;
    if (costContext.teamSize || costContext.teamContext) {
      prompt += `\nAdapt recommendations to this team. For solo operators (team size 1), avoid delegation suggestions and focus on automation. For larger teams, consider cross-training, load distribution, and role-based task assignments.\n`;
    }
    prompt += `\n`;
  }

  // Team context
  if (teamContext) {
    prompt += `### Team Context\n`;
    if (teamContext.teamSize) prompt += `- Team size: ${teamContext.teamSize}\n`;
    if (teamContext.budget) prompt += `- Budget: ${teamContext.budget}\n`;
    if (teamContext.timeline) prompt += `- Timeline: ${teamContext.timeline}\n`;
    if (teamContext.constraints?.length) {
      prompt += `- Constraints: ${teamContext.constraints.join("; ")}\n`;
    }
    prompt += `\n`;
  }

  prompt += `\nGenerate a structured remediation plan addressing ALL ${gaps.length} gaps. Organize into phases by effort level.`;

  return prompt;
}
