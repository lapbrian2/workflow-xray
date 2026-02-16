import { NextRequest, NextResponse } from "next/server";
import { callClaudeExtraction, getExtractionPromptVersion, getModelId } from "@/lib/claude";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import {
  ExtractionResultSchema,
  recoverPartialExtraction,
  parseExtractionJson,
} from "@/lib/extraction-schemas";
import { withApiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/api-errors";
import { ExtractWorkflowsSchema } from "@/lib/validation";
import type { ExtractWorkflowsInput } from "@/lib/validation";

// ─── POST /api/extract-workflows ───

export const POST = withApiHandler<ExtractWorkflowsInput>(
  async (request, body) => {
    // Rate limit: 10 extraction calls per minute per IP
    const ip = getClientIp(request);
    const rl = rateLimit(`extract-workflows:${ip}`, 10, 60);
    if (!rl.allowed) {
      throw new AppError("RATE_LIMITED", `Rate limit exceeded. Try again in ${rl.resetInSeconds}s.`, 429);
    }

    if (body.content.trim().length < 50) {
      throw new AppError("VALIDATION_ERROR", "Content must be at least 50 characters to extract workflows.", 400);
    }

    // Truncate to 30k chars for Claude context
    const MAX_CHARS = 30_000;
    const truncatedContent =
      body.content.length > MAX_CHARS ? body.content.slice(0, MAX_CHARS) : body.content;

    // Build the user message
    const userMessage = [
      `Source: ${body.sourceType || "text"}${body.sourceUrl ? ` (${body.sourceUrl})` : ""}`,
      `Content length: ${truncatedContent.length} characters`,
      body.content.length > MAX_CHARS
        ? `Note: Content was truncated from ${body.content.length} to ${MAX_CHARS} characters.`
        : "",
      "",
      "--- DOCUMENT CONTENT ---",
      "",
      truncatedContent,
    ]
      .filter(Boolean)
      .join("\n");

    // Call Claude for extraction
    let response;
    try {
      response = await callClaudeExtraction(userMessage);
    } catch (error) {
      console.error("[extract-workflows] Claude call failed:", error);
      throw new AppError("AI_ERROR", "Workflow extraction failed. Please try again.", 502);
    }

    // Parse JSON from response
    let rawJson: unknown;
    try {
      rawJson = parseExtractionJson(response.text);
    } catch {
      throw new AppError("AI_ERROR", "Could not extract workflows. Try using 'Use Raw Content' instead.", 502);
    }

    // Validate with Zod (graceful — clamp and fix rather than reject)
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
      sourceType: body.sourceType || "text",
      sourceUrl: body.sourceUrl || null,
      promptVersion: getExtractionPromptVersion(),
      modelUsed: getModelId(),
      tokenUsage: {
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
    });
  },
  { schema: ExtractWorkflowsSchema }
);
