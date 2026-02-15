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

    const body = await request.json();
    const decomposeRequest: DecomposeRequest = {
      description: body.description,
      stages: body.stages,
      context: body.context,
    };

    if (
      !decomposeRequest.description ||
      decomposeRequest.description.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Workflow description is required" },
        { status: 400 }
      );
    }

    // Prevent excessive input that could overflow context window
    if (decomposeRequest.description.length > 15000) {
      return NextResponse.json(
        { error: "Workflow description is too long (max 15,000 characters). Please shorten it or split into multiple workflows." },
        { status: 400 }
      );
    }

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
      ...(body.costContext ? { costContext: body.costContext } : {}),
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
      } else if (error.message.includes("System prompt file not found")) {
        userMessage = "Server configuration error. Please contact support.";
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
