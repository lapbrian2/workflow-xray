import { NextRequest, NextResponse } from "next/server";
import { decomposeWorkflow } from "@/lib/decompose";
import { saveWorkflow, listWorkflows } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { withApiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/api-errors";
import { DecomposeInputSchema } from "@/lib/validation";
import type { DecomposeInput } from "@/lib/validation";
import type { DecomposeRequest, Workflow } from "@/lib/types";

export const POST = withApiHandler<DecomposeInput>(
  async (request, body) => {
    // Rate limit: 10 decompositions per minute per IP
    const ip = getClientIp(request);
    const rl = rateLimit(`decompose:${ip}`, 10, 60);
    if (!rl.allowed) {
      throw new AppError("RATE_LIMITED", `Rate limit exceeded. Try again in ${rl.resetInSeconds} seconds.`, 429);
    }

    // Validate API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new AppError("SERVICE_UNAVAILABLE", "API key not configured. Please set ANTHROPIC_API_KEY.", 503);
    }

    // Build team context block to inject into the prompt
    let enrichedDescription = body.description;
    const cc = body.costContext;
    if (cc && typeof cc === "object") {
      const contextParts: string[] = [];
      if (typeof cc.teamSize === "number") contextParts.push(`Team size: ${cc.teamSize} people`);
      if (typeof cc.teamContext === "string" && cc.teamContext.trim()) contextParts.push(`Team: ${cc.teamContext.trim()}`);
      if (typeof cc.hourlyRate === "number") contextParts.push(`Avg hourly rate: $${cc.hourlyRate}`);
      if (typeof cc.hoursPerStep === "number") contextParts.push(`Avg hours per step: ${cc.hoursPerStep}`);
      if (contextParts.length > 0) {
        enrichedDescription += `\n\n## Team & Cost Context\n${contextParts.join("\n")}\nAdapt your analysis to this team. For solo operators (team size 1), avoid delegation suggestions. For larger teams, consider cross-training and load distribution.`;
      }
    }

    const decomposeRequest: DecomposeRequest = {
      description: enrichedDescription,
      stages: body.stages as DecomposeRequest["stages"],
      context: body.context as DecomposeRequest["context"],
    };

    // Call decomposeWorkflow with error mapping
    let result;
    try {
      result = await decomposeWorkflow(decomposeRequest);
    } catch (error) {
      console.error("Decompose error:", error);

      // Map internal errors to user-friendly messages
      let userMessage = "Decomposition failed. Please try again.";
      let statusCode = 502;
      if (error instanceof Error) {
        if (error.message.includes("invalid JSON")) {
          userMessage = "Claude returned an unexpected format. Try simplifying your workflow description.";
        } else if (error.message.includes("schema validation")) {
          userMessage = "Analysis produced incomplete results. Try rephrasing your workflow.";
        } else if (error.message.includes("timed out") || error.message.includes("timeout")) {
          userMessage = "Request timed out. Try a shorter workflow description or try again.";
        } else if (error.message.includes("rate limit") || error.message.includes("429")) {
          userMessage = "Too many requests. Please wait a moment and try again.";
          statusCode = 429;
        } else if (error.message.includes("not found") && error.message.includes("prompt")) {
          userMessage = "Server configuration error — prompt files missing. Please contact support.";
          statusCode = 503;
        }
      }
      throw new AppError("AI_ERROR", userMessage, statusCode);
    }

    // Separate metadata from decomposition
    const { _meta, ...decomposition } = result;

    // Determine version info
    const parentId: string | undefined = body.parentId;
    let version = 1;

    if (parentId) {
      try {
        const allWorkflows = await listWorkflows();
        const existingVersions = allWorkflows.filter(
          (w) => w.parentId === parentId || w.id === parentId
        );
        const maxVersion = existingVersions.reduce(
          (max, w) => Math.max(max, w.version || 1),
          1
        );
        version = maxVersion + 1;
      } catch {
        version = 2;
      }
    }

    // Build the workflow object with prompt versioning & token tracking
    const workflow: Workflow = {
      id: decomposition.id,
      decomposition,
      description: decomposeRequest.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(parentId ? { parentId, version } : { version: 1 }),
      ...(body.costContext
        ? {
            costContext: {
              hourlyRate: body.costContext.hourlyRate,
              hoursPerStep: body.costContext.hoursPerStep,
              teamSize: body.costContext.teamSize,
              teamContext: body.costContext.teamContext?.trim().slice(0, 200) || undefined,
            },
          }
        : {}),
      promptVersion: _meta.promptVersion,
      modelUsed: _meta.modelUsed,
      tokenUsage: {
        inputTokens: _meta.inputTokens,
        outputTokens: _meta.outputTokens,
      },
    };

    await saveWorkflow(workflow);

    return NextResponse.json(workflow);
  },
  { schema: DecomposeInputSchema }
);
