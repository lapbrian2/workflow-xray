import { z } from "zod";

// ─── Shared Zod schemas for extraction validation ───
// Used by both /api/extract-workflows and /api/extract-from-screenshot

export const ExtractedWorkflowSchema = z.object({
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

export const ExtractionResultSchema = z.object({
  workflows: z.array(ExtractedWorkflowSchema).max(20),
  documentTitle: z.string().max(400).optional().default("Untitled Document"),
  documentSummary: z.string().max(600).optional().default(""),
  totalWorkflowsFound: z.number().int().min(0).optional().default(0),
});

/**
 * Attempts to recover workflow data from a partially valid extraction response.
 * Returns a structured result even when Zod validation fails on some fields.
 */
export function recoverPartialExtraction(rawJson: unknown) {
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

  return {
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

/**
 * Attempts to parse JSON from Claude's response text, handling
 * markdown code fences and embedded JSON objects.
 */
export function parseExtractionJson(responseText: string): unknown {
  // Try direct parse after stripping code fences
  const cleaned = responseText
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Retry: try to find JSON object in the response
    const match = responseText.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // Fallback parse also failed
      }
    }
    throw new Error("No valid JSON found in response");
  }
}
