import { NextRequest, NextResponse } from "next/server";
import { listWorkflows, getWorkflow, saveWorkflow, deleteWorkflow } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

function checkRateLimit(request: NextRequest, action: string, max: number) {
  const ip = getClientIp(request);
  const rl = rateLimit(`workflows:${action}:${ip}`, max, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rl.resetInSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(rl.resetInSeconds) } }
    );
  }
  return null;
}

export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request, "read", 60); // 60 reads/min
  if (blocked) return blocked;

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
  const blocked = checkRateLimit(request, "write", 20); // 20 writes/min
  if (blocked) return blocked;

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
  const blocked = checkRateLimit(request, "delete", 10); // 10 deletes/min
  if (blocked) return blocked;

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
