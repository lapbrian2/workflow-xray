import { NextRequest, NextResponse } from "next/server";
import { callClaudeExtraction, getExtractionPromptVersion, getModelId } from "@/lib/claude";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";

// ─── Zod schemas for extraction validation ───

const ExtractedWorkflowSchema = z.object({
  id: z.string().optional().default("wf_0"),
  title: z.string().min(3).max(300),
  summary: z.string().max(600).optional().default(""),
  estimatedSteps: z.number().int().min(1).max(50).optional().default(5),
  sourceSection: z.string().max(400).optional().default(""),
  extractedDescription: z.string().min(20).max(5000),
  // Also accept the format from the prompt (confidence / sourceSnippet)
  confidence: z.enum(["high", "medium", "low"]).optional().default("medium"),
  sourceSnippet: z.string().max(500).optional().default(""),
  description: z.string().optional(), // alternate field name Claude might use
});

const ExtractionResultSchema = z.object({
  workflows: z.array(ExtractedWorkflowSchema).max(10),
  documentTitle: z.string().max(400).optional().default("Untitled Document"),
  documentSummary: z.string().max(600).optional().default(""),
  totalWorkflowsFound: z.number().int().min(0).optional().default(0),
});

// ─── POST /api/extract-workflows ───

export async function POST(request: NextRequest) {
  // Rate limit: 10 extraction calls per minute per IP
  const ip = getClientIp(request);
  const rl = rateLimit(`extract-workflows:${ip}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rl.resetInSeconds}s.` },
      { status: 429 }
    );
  }

  // Parse body
  let body: { content?: string; sourceUrl?: string; sourceType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const { content, sourceUrl, sourceType = "text" } = body;

  if (!content || typeof content !== "string" || content.trim().length < 50) {
    return NextResponse.json(
      { error: "Content must be at least 50 characters to extract workflows." },
      { status: 400 }
    );
  }

  // Truncate to 30k chars for Claude context
  const MAX_CHARS = 30_000;
  const truncatedContent =
    content.length > MAX_CHARS ? content.slice(0, MAX_CHARS) : content;

  try {
    // Build the user message
    const userMessage = [
      `Source: ${sourceType}${sourceUrl ? ` (${sourceUrl})` : ""}`,
      `Content length: ${truncatedContent.length} characters`,
      content.length > MAX_CHARS
        ? `Note: Content was truncated from ${content.length} to ${MAX_CHARS} characters.`
        : "",
      "",
      "--- DOCUMENT CONTENT ---",
      "",
      truncatedContent,
    ]
      .filter(Boolean)
      .join("\n");

    // Call Claude for extraction
    const response = await callClaudeExtraction(userMessage);

    // Parse JSON from response
    let rawJson: unknown;
    try {
      // Claude might wrap in ```json blocks
      const cleaned = response.text
        .replace(/^```(?:json)?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "")
        .trim();
      rawJson = JSON.parse(cleaned);
    } catch {
      // Retry: try to find JSON object in the response
      const match = response.text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          rawJson = JSON.parse(match[0]);
        } catch {
          return NextResponse.json(
            {
              error: "Could not extract workflows. Try using 'Use Raw Content' instead.",
              rawResponse: response.text.slice(0, 200),
            },
            { status: 502 }
          );
        }
      } else {
        return NextResponse.json(
          {
            error: "Could not extract workflows. Try using 'Use Raw Content' instead.",
          },
          { status: 502 }
        );
      }
    }

    // Validate with Zod (graceful — clamp and fix rather than reject)
    const parsed = ExtractionResultSchema.safeParse(rawJson);

    let result;
    if (parsed.success) {
      result = parsed.data;
    } else {
      // Try partial recovery: extract what we can
      const raw = rawJson as Record<string, unknown>;
      const rawWorkflows = Array.isArray(raw.workflows) ? raw.workflows : [];

      const recoveredWorkflows = rawWorkflows
        .slice(0, 10)
        .map((w: unknown, i: number) => {
          if (typeof w !== "object" || !w) return null;
          const wf = w as Record<string, unknown>;

          // Accept either extractedDescription or description
          const desc =
            typeof wf.extractedDescription === "string"
              ? wf.extractedDescription
              : typeof wf.description === "string"
                ? wf.description
                : "";

          if (desc.length < 20) return null;

          return {
            id: typeof wf.id === "string" ? wf.id : `wf_${i + 1}`,
            title:
              typeof wf.title === "string"
                ? wf.title.slice(0, 300)
                : `Workflow ${i + 1}`,
            summary:
              typeof wf.summary === "string" ? wf.summary.slice(0, 600) : "",
            estimatedSteps: Math.min(
              50,
              Math.max(
                1,
                typeof wf.estimatedSteps === "number" ? wf.estimatedSteps : 5
              )
            ),
            sourceSection:
              typeof wf.sourceSection === "string"
                ? wf.sourceSection.slice(0, 400)
                : "",
            extractedDescription: desc.slice(0, 5000),
            confidence:
              typeof wf.confidence === "string" &&
              ["high", "medium", "low"].includes(wf.confidence)
                ? (wf.confidence as "high" | "medium" | "low")
                : "medium",
            sourceSnippet:
              typeof wf.sourceSnippet === "string"
                ? wf.sourceSnippet.slice(0, 500)
                : "",
          };
        })
        .filter((w): w is NonNullable<typeof w> => w !== null);

      result = {
        workflows: recoveredWorkflows,
        documentTitle:
          typeof raw.documentTitle === "string"
            ? raw.documentTitle.slice(0, 400)
            : "Untitled Document",
        documentSummary:
          typeof raw.documentSummary === "string"
            ? raw.documentSummary.slice(0, 600)
            : "",
        totalWorkflowsFound: recoveredWorkflows.length,
      };
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
      sourceType,
      sourceUrl: sourceUrl || null,
      promptVersion: getExtractionPromptVersion(),
      modelUsed: getModelId(),
      tokenUsage: {
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
    });
  } catch (err) {
    console.error("[extract-workflows] Error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to extract workflows from content.",
      },
      { status: 500 }
    );
  }
}
