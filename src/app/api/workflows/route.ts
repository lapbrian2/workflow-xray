import { NextRequest, NextResponse } from "next/server";
import { listWorkflows, getWorkflow, saveWorkflow, deleteWorkflow } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { withApiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/api-errors";
import { WorkflowSaveSchema } from "@/lib/validation";
import type { WorkflowSaveInput } from "@/lib/validation";

function checkRate(request: NextRequest, action: string, max: number) {
  const ip = getClientIp(request);
  const rl = rateLimit(`workflows:${action}:${ip}`, max, 60);
  if (!rl.allowed) {
    throw new AppError("RATE_LIMITED", `Rate limit exceeded. Try again in ${rl.resetInSeconds}s.`, 429);
  }
}

export const GET = withApiHandler(
  async (request) => {
    checkRate(request, "read", 60);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const id = searchParams.get("id");

    if (id) {
      const workflow = await getWorkflow(id);
      if (!workflow) {
        throw new AppError("NOT_FOUND", "Workflow not found.", 404);
      }
      return NextResponse.json(workflow);
    }

    const workflows = await listWorkflows(search);
    return NextResponse.json({ workflows });
  },
  { bodyType: "none" }
);

export const POST = withApiHandler<WorkflowSaveInput>(
  async (request, body) => {
    checkRate(request, "write", 20);

    await saveWorkflow(body as unknown as import("@/lib/types").Workflow);
    return NextResponse.json(body);
  },
  { schema: WorkflowSaveSchema }
);

export const DELETE = withApiHandler(
  async (request) => {
    checkRate(request, "delete", 10);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      throw new AppError("VALIDATION_ERROR", "ID is required.", 400);
    }

    await deleteWorkflow(id);
    return NextResponse.json({ deleted: true });
  },
  { bodyType: "none" }
);
