import { NextRequest, NextResponse } from "next/server";
import { decomposeWorkflow } from "@/lib/decompose";
import { saveWorkflow } from "@/lib/db";
import type { DecomposeRequest } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body: DecomposeRequest = await request.json();

    if (!body.description || body.description.trim().length === 0) {
      return NextResponse.json(
        { error: "Workflow description is required" },
        { status: 400 }
      );
    }

    const decomposition = await decomposeWorkflow(body);

    // Auto-save the workflow
    const workflow = {
      id: decomposition.id,
      decomposition,
      description: body.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveWorkflow(workflow);

    return NextResponse.json(workflow);
  } catch (error) {
    console.error("Decompose error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Decomposition failed" },
      { status: 500 }
    );
  }
}
