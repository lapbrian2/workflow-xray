import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/api-errors";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { CreateShareLinkSchema } from "@/lib/validation";
import type { CreateShareLinkInput } from "@/lib/validation";
import { getWorkflow } from "@/lib/db";
import {
  createShareLink,
  listShareLinks,
  deleteShareLink,
} from "@/lib/db-shares";

function checkRate(request: NextRequest, action: string, max: number) {
  const ip = getClientIp(request);
  const rl = rateLimit(`shares:${action}:${ip}`, max, 60);
  if (!rl.allowed) {
    throw new AppError(
      "RATE_LIMITED",
      `Rate limit exceeded. Try again in ${rl.resetInSeconds}s.`,
      429
    );
  }
}

// ─── POST: Create a share link ───

export const POST = withApiHandler<CreateShareLinkInput>(
  async (request, body) => {
    checkRate(request, "create", 20);

    // Validate workflow exists
    const workflow = await getWorkflow(body.workflowId);
    if (!workflow) {
      throw new AppError("NOT_FOUND", "Workflow not found.", 404);
    }

    const shareLink = await createShareLink(
      body.workflowId,
      body.label,
      body.expiresInDays
    );

    return NextResponse.json(
      {
        ...shareLink,
        url: `/share/${shareLink.token}`,
      },
      { status: 201 }
    );
  },
  { schema: CreateShareLinkSchema }
);

// ─── GET: List share links for a workflow ───

export const GET = withApiHandler(
  async (request) => {
    checkRate(request, "read", 60);

    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get("workflowId");

    if (!workflowId) {
      throw new AppError(
        "VALIDATION_ERROR",
        "workflowId query parameter is required.",
        400
      );
    }

    const shares = await listShareLinks(workflowId);
    return NextResponse.json({ shares });
  },
  { bodyType: "none" }
);

// ─── DELETE: Revoke a share link ───

export const DELETE = withApiHandler(
  async (request) => {
    checkRate(request, "delete", 20);

    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      throw new AppError(
        "VALIDATION_ERROR",
        "token query parameter is required.",
        400
      );
    }

    await deleteShareLink(token);
    return NextResponse.json({ deleted: true });
  },
  { bodyType: "none" }
);
