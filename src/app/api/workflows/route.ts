import { NextRequest, NextResponse } from "next/server";
import { listWorkflows, getWorkflow, saveWorkflow, deleteWorkflow } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const id = searchParams.get("id");

    if (id) {
      const workflow = await getWorkflow(id);
      if (!workflow) {
        return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
      }
      return NextResponse.json(workflow);
    }

    const workflows = await listWorkflows(search);
    return NextResponse.json({ workflows });
  } catch (error) {
    console.error("List workflows error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workflows" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const workflow = await request.json();
    await saveWorkflow(workflow);
    return NextResponse.json(workflow);
  } catch (error) {
    console.error("Save workflow error:", error);
    return NextResponse.json(
      { error: "Failed to save workflow" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await deleteWorkflow(id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Delete workflow error:", error);
    return NextResponse.json(
      { error: "Failed to delete workflow" },
      { status: 500 }
    );
  }
}
