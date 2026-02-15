import { NextRequest, NextResponse } from "next/server";
import { decomposeWorkflow } from "@/lib/decompose";
import { saveWorkflow, listWorkflows } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import type { DecomposeRequest, Workflow } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 decompositions per minute per IP
    const ip = getClientIp(request);
    const rl = rateLimit(`decompose:${ip}`, 10, 60);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: `Rate limit exceeded. Try again in ${rl.resetInSeconds} seconds.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rl.resetInSeconds),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // Validate API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "API key not configured. Please set ANTHROPIC_API_KEY." },
        { status: 503 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    // Validate and sanitize input
    if (
      !body.description ||
      typeof body.description !== "string" ||
      body.description.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Workflow description is required" },
        { status: 400 }
      );
    }

    // Prevent excessive input that could overflow context window
    if (body.description.length > 15000) {
      return NextResponse.json(
        { error: "Workflow description is too long (max 15,000 characters). Please shorten it or split into multiple workflows." },
        { status: 400 }
      );
    }

    // Validate stages if provided
    const stages = Array.isArray(body.stages)
      ? body.stages
          .filter((s: unknown) => typeof s === "string" && s.trim().length > 0)
          .slice(0, 20)
          .map((s: string) => s.slice(0, 500))
      : undefined;

    // Validate context if provided
    const context =
      typeof body.context === "string"
        ? body.context.slice(0, 5000)
        : undefined;

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
      stages,
      context,
    };

    const result = await decomposeWorkflow(decomposeRequest);

    // Separate metadata from decomposition
    const { _meta, ...decomposition } = result;

    // Determine version info
    const parentId: string | undefined = body.parentId;
    let version = 1;

    if (parentId) {
      // Count existing versions: parent (v1) + children with this parentId
      try {
        const allWorkflows = await listWorkflows();
        const existingVersions = allWorkflows.filter(
          (w) => w.parentId === parentId || w.id === parentId
        );
        // The new workflow is the next version after all existing ones
        const maxVersion = existingVersions.reduce(
          (max, w) => Math.max(max, w.version || 1),
          1
        );
        version = maxVersion + 1;
      } catch {
        version = 2; // fallback if listing fails
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
      ...(body.costContext && typeof body.costContext === "object"
        ? {
            costContext: {
              hourlyRate: typeof body.costContext.hourlyRate === "number" ? body.costContext.hourlyRate : undefined,
              hoursPerStep: typeof body.costContext.hoursPerStep === "number" ? body.costContext.hoursPerStep : undefined,
              teamSize: typeof body.costContext.teamSize === "number" ? body.costContext.teamSize : undefined,
              teamContext: typeof body.costContext.teamContext === "string" && body.costContext.teamContext.trim()
                ? body.costContext.teamContext.trim().slice(0, 200)
                : undefined,
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
  } catch (error) {
    console.error("Decompose error:", error);

    // User-friendly error messages — don't expose raw Claude output or JSON
    let userMessage = "Decomposition failed. Please try again.";
    if (error instanceof Error) {
      if (error.message.includes("invalid JSON")) {
        userMessage = "Claude returned an unexpected format. Try simplifying your workflow description.";
      } else if (error.message.includes("schema validation")) {
        userMessage = "Analysis produced incomplete results. Try rephrasing your workflow.";
      } else if (error.message.includes("timed out") || error.message.includes("timeout")) {
        userMessage = "Request timed out. Try a shorter workflow description or try again.";
      } else if (error.message.includes("rate limit") || error.message.includes("429")) {
        userMessage = "Too many requests. Please wait a moment and try again.";
      } else if (error.message.includes("not found") && error.message.includes("prompt")) {
        userMessage = "Server configuration error — prompt files missing. Please contact support.";
      } else {
        userMessage = "Decomposition failed. Please try again.";
      }
    }

    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    );
  }
}
