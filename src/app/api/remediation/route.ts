import { NextRequest, NextResponse } from "next/server";
import { callClaudeRemediation, getRemediationPromptVersion, getModelId } from "@/lib/claude";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getWorkflow, saveWorkflow } from "@/lib/db";
import type { Workflow, RemediationPlan, RemediationPhase, ProjectedImpact } from "@/lib/types";
import { z } from "zod";

// ─── Zod schemas for validation ───

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

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 remediation plans per minute per IP
    const ip = getClientIp(request);
    const rl = rateLimit(`remediation:${ip}`, 10, 60);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { "Retry-After": String(rl.resetInSeconds) } }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "API key not configured." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { workflowId, teamContext } = body;

    if (!workflowId) {
      return NextResponse.json(
        { error: "workflowId is required." },
        { status: 400 }
      );
    }

    // Load the workflow from storage
    const workflow = await getWorkflow(workflowId);
    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found. It may have been deleted." },
        { status: 404 }
      );
    }

    const { decomposition, costContext } = workflow;

    // Guard: no gaps = no remediation needed
    if (!decomposition.gaps || decomposition.gaps.length === 0) {
      return NextResponse.json(
        { error: "This workflow has no gaps to remediate. A remediation plan requires at least one identified gap." },
        { status: 400 }
      );
    }

    // Build the user message with diagnostic data
    const userMessage = buildRemediationPrompt(workflow, teamContext);

    // Call Claude
    const claudeResponse = await callClaudeRemediation(userMessage);

    // Parse JSON from response
    let parsed;
    try {
      // Handle potential markdown code fences
      let rawText = claudeResponse.text.trim();
      if (rawText.startsWith("```")) {
        rawText = rawText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }
      parsed = JSON.parse(rawText);
    } catch {
      console.error("[Remediation] Failed to parse Claude response as JSON");
      return NextResponse.json(
        { error: "Analysis failed — please try again." },
        { status: 502 }
      );
    }

    // Validate against schema
    const validated = RemediationResponseSchema.parse(parsed);

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
      teamContext: teamContext || undefined,
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
  } catch (error) {
    console.error("Remediation error:", error);

    if (error instanceof z.ZodError) {
      console.error("[Remediation] Schema validation failed:", error.issues);
      return NextResponse.json(
        { error: "Analysis produced invalid structure — please try again." },
        { status: 502 }
      );
    }

    const apiError = error as { status?: number; code?: string };
    if (apiError.status === 429) {
      return NextResponse.json(
        { error: "AI service is busy. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate remediation plan. Please try again." },
      { status: 500 }
    );
  }
}

// Also support GET to retrieve existing plan
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`remediation-get:${ip}`, 60, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rl.resetInSeconds}s.` },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const workflowId = searchParams.get("workflowId");

  if (!workflowId) {
    return NextResponse.json(
      { error: "workflowId is required." },
      { status: 400 }
    );
  }

  const workflow = await getWorkflow(workflowId);
  if (!workflow) {
    return NextResponse.json(
      { error: "Workflow not found." },
      { status: 404 }
    );
  }

  if (!workflow.remediationPlan) {
    return NextResponse.json(
      { error: "No remediation plan exists for this workflow." },
      { status: 404 }
    );
  }

  return NextResponse.json({ plan: workflow.remediationPlan });
}

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

  // Cost context
  if (costContext) {
    prompt += `### Cost Context\n`;
    if (costContext.hourlyRate) prompt += `- Hourly rate: $${costContext.hourlyRate}\n`;
    if (costContext.hoursPerStep) prompt += `- Hours per step: ${costContext.hoursPerStep}\n`;
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
