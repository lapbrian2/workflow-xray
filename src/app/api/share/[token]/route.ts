/**
 * GET /api/share/[token] — Public share token lookup API.
 *
 * Resolves a share token to a sanitized workflow. No auth required —
 * the middleware allows /api/share/* through without authentication.
 *
 * Returns:
 *   200 — { workflow: SanitizedWorkflow, share: { label?, expiresAt? } }
 *   404 — Token not found or workflow deleted
 *   410 — Token expired
 *   429 — Rate limited
 */

import { type NextRequest, NextResponse } from "next/server";
import { getShareLink } from "@/lib/db-shares";
import { getWorkflow } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { errorResponse, rateLimited } from "@/lib/api-errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  try {
    const { token } = await params;

    // ── Rate limit: 30 per minute per IP (prevents token enumeration) ──
    const ip = getClientIp(request);
    const limit = rateLimit(`share:read:${ip}`, 30, 60);
    if (!limit.allowed) {
      return rateLimited(limit.resetInSeconds);
    }

    // ── Resolve share token ──
    const shareLink = await getShareLink(token);

    if (!shareLink) {
      return errorResponse(
        "NOT_FOUND",
        "Share link not found or has expired.",
        404
      );
    }

    // ── Check expiry (belt-and-suspenders — KV TTL may have already cleaned it) ──
    if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
      return errorResponse(
        "EXPIRED",
        "This share link has expired.",
        410
      );
    }

    // ── Fetch the workflow ──
    const workflow = await getWorkflow(shareLink.workflowId);

    if (!workflow) {
      return errorResponse(
        "NOT_FOUND",
        "The shared workflow no longer exists.",
        404
      );
    }

    // ── Sanitize: strip sensitive fields ──
    const sanitized = {
      id: workflow.id,
      decomposition: workflow.decomposition,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      version: workflow.version,
      // Explicitly OMIT: description, costContext, tokenUsage, extractionSource,
      // _partial, _recoveryReason, cacheHit, cachedAt, promptVersion, modelUsed,
      // parentId, remediationPlan
    };

    return NextResponse.json({
      workflow: sanitized,
      share: {
        label: shareLink.label,
        expiresAt: shareLink.expiresAt,
      },
    });
  } catch (error) {
    console.error("[api/share] Error resolving share token:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred.",
      500
    );
  }
}
