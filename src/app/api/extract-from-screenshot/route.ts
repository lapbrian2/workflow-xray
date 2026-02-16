import { NextRequest, NextResponse } from "next/server";
import {
  callClaudeVisionExtraction,
  getVisionExtractionPromptVersion,
  getModelId,
} from "@/lib/claude";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import {
  ExtractionResultSchema,
  recoverPartialExtraction,
  parseExtractionJson,
} from "@/lib/extraction-schemas";
import { withApiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/api-errors";
import { ExtractFromScreenshotSchema } from "@/lib/validation";
import type { ExtractFromScreenshotInput } from "@/lib/validation";

// ─── POST /api/extract-from-screenshot ───

export const POST = withApiHandler<ExtractFromScreenshotInput>(
  async (request, body) => {
    // Rate limit: 10 extraction calls per minute per IP
    const ip = getClientIp(request);
    const rl = rateLimit(`extract-screenshot:${ip}`, 10, 60);
    if (!rl.allowed) {
      throw new AppError("RATE_LIMITED", `Rate limit exceeded. Try again in ${rl.resetInSeconds}s.`, 429);
    }

    // Basic size check (base64 screenshots should be < 20MB)
    if (body.screenshot.length > 20_000_000) {
      throw new AppError("VALIDATION_ERROR", "Screenshot too large. Maximum 20MB.", 400);
    }

    let response;
    try {
      response = await callClaudeVisionExtraction(body.screenshot, body.additionalContext);
    } catch (error) {
      console.error("[extract-from-screenshot] Claude call failed:", error);
      throw new AppError("AI_ERROR", "Screenshot extraction failed. Please try again.", 502);
    }

    // Parse JSON from response
    let rawJson: unknown;
    try {
      rawJson = parseExtractionJson(response.text);
    } catch {
      throw new AppError("AI_ERROR", "Could not extract workflows from screenshot. The image may not contain recognizable workflows.", 502);
    }

    // Validate with Zod (graceful — recover partial data)
    const parsed = ExtractionResultSchema.safeParse(rawJson);
    const result = parsed.success ? parsed.data : recoverPartialExtraction(rawJson);

    // Assign stable IDs if missing
    result.workflows.forEach((wf, i) => {
      if (!wf.id || wf.id === "wf_0") {
        wf.id = `wf_${i + 1}`;
      }
    });

    // Update total count
    if (!result.totalWorkflowsFound) {
      result.totalWorkflowsFound = result.workflows.length;
    }

    return NextResponse.json({
      ...result,
      sourceType: "screenshot",
      sourceUrl: body.sourceUrl || null,
      promptVersion: getVisionExtractionPromptVersion(),
      modelUsed: getModelId(),
      tokenUsage: {
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
    });
  },
  { schema: ExtractFromScreenshotSchema }
);
