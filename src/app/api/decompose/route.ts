import { NextRequest, NextResponse } from "next/server";
import { decomposeWorkflow } from "@/lib/decompose";
import { saveWorkflow, listWorkflows } from "@/lib/db";
import type { DecomposeRequest, Workflow } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
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

    const decomposition = await decomposeWorkflow(decomposeRequest);

    // Determine version info
    const parentId: string | undefined = body.parentId;
    let version = 1;

    if (parentId) {
      // Count existing versions of this parent
      try {
        const allWorkflows = await listWorkflows();
        const siblings = allWorkflows.filter(
          (w) => w.parentId === parentId || w.id === parentId
        );
        version = siblings.length + 1;
      } catch {
        version = 2; // fallback if listing fails
      }
    }

    // Build the workflow object
    const workflow: Workflow = {
      id: decomposition.id,
      decomposition,
      description: decomposeRequest.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(parentId ? { parentId, version } : { version: 1 }),
    };

    await saveWorkflow(workflow);

    return NextResponse.json(workflow);
  } catch (error) {
    console.error("Decompose error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Decomposition failed",
      },
      { status: 500 }
    );
  }
}
