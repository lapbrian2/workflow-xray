import { NextRequest } from "next/server";
import { decomposeWorkflow } from "@/lib/decompose";
import { saveWorkflow, listWorkflows } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api-errors";
import { DecomposeInputSchema } from "@/lib/validation";
import { classifyClaudeError } from "@/lib/claude";
import type { DecomposeRequest, Workflow } from "@/lib/types";

export const maxDuration = 120;

type DecomposeEvent =
  | { type: "progress"; step: string; message: string }
  | { type: "complete"; workflow: Workflow }
  | { type: "partial"; workflow: Workflow; warning: string }
  | { type: "error"; code: string; message: string };

export async function POST(request: NextRequest) {
  // ── Pre-stream validation (returns JSON errors, not SSE) ──

  const ip = getClientIp(request);
  const rl = rateLimit(`decompose:${ip}`, 10, 60);
  if (!rl.allowed) {
    return errorResponse("RATE_LIMITED", `Rate limit exceeded. Try again in ${rl.resetInSeconds} seconds.`, 429);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return errorResponse("SERVICE_UNAVAILABLE", "API key not configured. Please set ANTHROPIC_API_KEY.", 503);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  const parseResult = DecomposeInputSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Input validation failed.",
      400,
      parseResult.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }))
    );
  }
  const body = parseResult.data;

  // ── SSE stream ──
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: DecomposeEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Controller may be closed if client disconnected
        }
      };

      try {
        // Stage 1: Building context
        send({ type: "progress", step: "context", message: "Loading organizational context..." });

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

        // Stage 2: Calling Claude
        send({ type: "progress", step: "analyzing", message: "Decomposing workflow with Claude..." });

        const result = await decomposeWorkflow(decomposeRequest, body.costContext?.teamSize);

        // Stage 3: Processing results
        send({ type: "progress", step: "processing", message: "Processing AI response..." });

        const { _meta, _partial, _recoveryReason, ...decomposition } = result;

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

        // Stage 4: Saving
        send({ type: "progress", step: "saving", message: "Saving workflow..." });

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
          ...(_partial ? { _partial, _recoveryReason } : {}),
        };

        await saveWorkflow(workflow);

        // Stage 5: Complete or partial
        if (_partial) {
          send({ type: "partial", workflow, warning: _recoveryReason || "Partial results recovered" });
        } else {
          send({ type: "complete", workflow });
        }
      } catch (error) {
        const classified = classifyClaudeError(error);
        let userMessage: string;
        let code = "AI_ERROR";

        switch (classified.type) {
          case "rate_limit":
            userMessage = "AI service is busy. Please try again in a moment.";
            code = "RATE_LIMITED";
            break;
          case "timeout":
            userMessage = "Request timed out after multiple retries. Try a shorter workflow description.";
            break;
          case "connection":
            userMessage = "Could not reach AI service. Check your connection and try again.";
            break;
          case "api_error":
            userMessage = "AI service error. Please try again.";
            break;
          default:
            userMessage = "Decomposition failed. Please try again.";
            break;
        }

        console.error("Decompose SSE error:", error);
        send({ type: "error", code, message: userMessage });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
