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

// ─── POST /api/extract-from-screenshot ───
// Sends a screenshot to Claude's vision model and extracts workflows.
// Uses the same response format as /api/extract-workflows.

export async function POST(request: NextRequest) {
  // Rate limit: 10 extraction calls per minute per IP
  const ip = getClientIp(request);
  const rl = rateLimit(`extract-screenshot:${ip}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rl.resetInSeconds}s.` },
      { status: 429 }
    );
  }

  // Parse body
  let body: { screenshot?: string; sourceUrl?: string; additionalContext?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const { screenshot, sourceUrl, additionalContext } = body;

  if (!screenshot || typeof screenshot !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid 'screenshot' field. Expected base64 string." },
      { status: 400 }
    );
  }

  // Basic size check (base64 screenshots should be < 20MB)
  if (screenshot.length > 20_000_000) {
    return NextResponse.json(
      { error: "Screenshot too large. Maximum 20MB." },
      { status: 400 }
    );
  }

  try {
    const response = await callClaudeVisionExtraction(screenshot, additionalContext);

    // Parse JSON from response
    let rawJson: unknown;
    try {
      rawJson = parseExtractionJson(response.text);
    } catch {
      return NextResponse.json(
        {
          error: "Could not extract workflows from screenshot. The image may not contain recognizable workflows.",
        },
        { status: 502 }
      );
    }

    // Validate with Zod (graceful — recover partial data)
    const parsed = ExtractionResultSchema.safeParse(rawJson);

    let result;
    if (parsed.success) {
      result = parsed.data;
    } else {
      result = recoverPartialExtraction(rawJson);
    }

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
      sourceUrl: sourceUrl || null,
      promptVersion: getVisionExtractionPromptVersion(),
      modelUsed: getModelId(),
      tokenUsage: {
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
    });
  } catch (err) {
    console.error("[extract-from-screenshot] Error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to extract workflows from screenshot.",
      },
      { status: 500 }
    );
  }
}
