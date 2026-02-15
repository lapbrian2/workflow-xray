import { NextRequest } from "next/server";
import Firecrawl from "@mendable/firecrawl-js";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { callClaudeExtraction, callClaudeVisionExtraction } from "@/lib/claude";
import {
  parseExtractionJson,
  ExtractionResultSchema,
  recoverPartialExtraction,
} from "@/lib/extraction-schemas";
import { decomposeWorkflow } from "@/lib/decompose";
import { saveWorkflow } from "@/lib/db";
import { stripBoilerplate, LOW_TEXT_THRESHOLD } from "@/lib/scrape-utils";
import type { Workflow, ExtractionSource } from "@/lib/types";

// Allow up to 5 minutes for streaming (Vercel Pro)
export const maxDuration = 300;

// ─── Types for SSE events ───

interface CrawlEvent {
  type: string;
  [key: string]: unknown;
}

// ─── POST /api/crawl-site ───
// Streams the full crawl pipeline: map → scrape → extract → decompose

export async function POST(request: NextRequest) {
  // Rate limit: 3 crawls per minute per IP
  const ip = getClientIp(request);
  const rl = rateLimit(`crawl-site:${ip}`, 3, 60);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: `Rate limit exceeded. Try again in ${rl.resetInSeconds}s.` }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(rl.resetInSeconds) } }
    );
  }

  // Validate API keys
  if (!process.env.FIRECRAWL_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Firecrawl is not configured." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Anthropic API key not configured." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  // Parse body
  let body: { url?: string; maxPages?: number };
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid request body." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { url } = body;
  if (!url || typeof url !== "string") {
    return new Response(
      JSON.stringify({ error: "Missing or invalid 'url' field." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid URL format." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return new Response(
      JSON.stringify({ error: "Only HTTP and HTTPS URLs are supported." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const maxPages = Math.min(Math.max(body.maxPages || 20, 1), 50);
  const MAX_CONTENT_CHARS = 30_000;

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: CrawlEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Controller may be closed if client disconnected
        }
      };

      try {
        const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY! });

        // ─── STAGE 1: Map the site ───
        send({ type: "map_start" });

        let pages: string[];
        try {
          const mapResult = await firecrawl.map(url, { limit: maxPages });

          if (!mapResult.links || mapResult.links.length === 0) {
            send({ type: "map_error", error: "No pages discovered. The site may block crawlers or have no public pages." });
            controller.close();
            return;
          }

          pages = mapResult.links.slice(0, maxPages).map((link) => link.url);
          send({ type: "map_complete", totalPages: pages.length, pages });
        } catch (err) {
          send({ type: "map_error", error: err instanceof Error ? err.message : "Site mapping failed." });
          controller.close();
          return;
        }

        // ─── STAGE 2: Scrape each page ───
        interface ScrapedPage {
          url: string;
          title: string;
          content: string;
          isVisualContent: boolean;
          screenshot: string | null;
          charCount: number;
        }
        const scrapedPages: ScrapedPage[] = [];

        for (let i = 0; i < pages.length; i++) {
          const pageUrl = pages[i];
          send({ type: "scrape_start", current: i + 1, total: pages.length, url: pageUrl });

          try {
            const result = await firecrawl.scrape(pageUrl, {
              formats: ["markdown", "screenshot"],
            });

            const markdown = result.markdown || "";
            const screenshot = result.screenshot || null;
            const title = result.metadata?.title || new URL(pageUrl).pathname;
            const meaningfulContent = stripBoilerplate(markdown);
            const isVisualContent = meaningfulContent.length < LOW_TEXT_THRESHOLD && !!screenshot;
            const content = markdown.length > MAX_CONTENT_CHARS
              ? markdown.slice(0, MAX_CONTENT_CHARS)
              : markdown;

            scrapedPages.push({
              url: pageUrl,
              title,
              content,
              isVisualContent,
              screenshot,
              charCount: content.length,
            });

            send({
              type: "scrape_complete",
              current: i + 1,
              total: pages.length,
              url: pageUrl,
              title,
              isVisualContent,
              charCount: content.length,
            });
          } catch (err) {
            console.error(`[crawl-site] Scrape failed for ${pageUrl}:`, err);
            send({
              type: "scrape_error",
              current: i + 1,
              total: pages.length,
              url: pageUrl,
              error: "Scrape failed",
            });
          }
        }

        // ─── STAGE 3: Extract workflows from each page ───
        interface ExtractedItem {
          pageUrl: string;
          pageTitle: string;
          workflowTitle: string;
          description: string;
          sourceSection?: string;
          totalWorkflowsInDocument: number;
        }
        const allExtracted: ExtractedItem[] = [];

        for (let i = 0; i < scrapedPages.length; i++) {
          const page = scrapedPages[i];
          send({ type: "extract_start", current: i + 1, total: scrapedPages.length, url: page.url });

          try {
            let rawJson: unknown;

            if (page.isVisualContent && page.screenshot) {
              // Vision fallback for visual-heavy pages
              const response = await callClaudeVisionExtraction(
                page.screenshot,
                `Page URL: ${page.url}\nPage title: ${page.title}`
              );
              rawJson = parseExtractionJson(response.text);
            } else if (page.content.trim().length >= 50) {
              // Standard text extraction
              const userMessage = [
                `Source: url (${page.url})`,
                `Content length: ${page.content.length} characters`,
                "",
                "--- DOCUMENT CONTENT ---",
                "",
                page.content,
              ].join("\n");

              const response = await callClaudeExtraction(userMessage);
              rawJson = parseExtractionJson(response.text);
            } else {
              // Skip pages with insufficient content
              send({
                type: "extract_skip",
                current: i + 1,
                total: scrapedPages.length,
                url: page.url,
                reason: "Insufficient content",
              });
              continue;
            }

            // Validate with Zod (graceful recovery)
            const parsed = ExtractionResultSchema.safeParse(rawJson);
            const result = parsed.success ? parsed.data : recoverPartialExtraction(rawJson);

            if (result.workflows.length === 0) {
              send({
                type: "extract_skip",
                current: i + 1,
                total: scrapedPages.length,
                url: page.url,
                reason: "No workflows found",
              });
              continue;
            }

            // Collect valid extracted workflows
            for (const wf of result.workflows) {
              const desc =
                wf.extractedDescription ||
                (wf as Record<string, unknown>).description as string ||
                "";
              if (desc.length >= 20) {
                allExtracted.push({
                  pageUrl: page.url,
                  pageTitle: page.title,
                  workflowTitle: wf.title,
                  description: desc,
                  sourceSection: wf.sourceSection,
                  totalWorkflowsInDocument: result.workflows.length,
                });
              }
            }

            send({
              type: "extract_complete",
              current: i + 1,
              total: scrapedPages.length,
              url: page.url,
              workflowCount: result.workflows.length,
              workflows: result.workflows.map((w) => ({
                id: w.id || `wf_${i}`,
                title: w.title,
              })),
            });
          } catch (err) {
            console.error(`[crawl-site] Extraction failed for ${page.url}:`, err);
            send({
              type: "extract_skip",
              current: i + 1,
              total: scrapedPages.length,
              url: page.url,
              reason: "Extraction failed",
            });
          }
        }

        // ─── STAGE 4: Decompose each workflow SEQUENTIALLY ───
        const savedIds: string[] = [];
        let decomposeFailed = 0;

        // Pre-populate queued list for frontend
        if (allExtracted.length > 0) {
          send({
            type: "decompose_queue",
            workflows: allExtracted.map((item, i) => ({
              id: `crawl_wf_${i + 1}`,
              title: item.workflowTitle,
              pageUrl: item.pageUrl,
            })),
            total: allExtracted.length,
          });
        }

        for (let i = 0; i < allExtracted.length; i++) {
          const item = allExtracted[i];
          const tempId = `crawl_wf_${i + 1}`;

          send({
            type: "decompose_start",
            workflowId: tempId,
            workflowTitle: item.workflowTitle,
            current: i + 1,
            total: allExtracted.length,
          });

          try {
            const result = await decomposeWorkflow({ description: item.description });
            const { _meta, ...decomposition } = result;

            const extractionSource: ExtractionSource = {
              type: "crawl",
              url: item.pageUrl,
              title: item.pageTitle,
              extractedAt: new Date().toISOString(),
              crawlRootUrl: url,
              sourceSection: item.sourceSection,
              totalWorkflowsInDocument: item.totalWorkflowsInDocument,
            };

            const workflow: Workflow = {
              id: decomposition.id,
              decomposition,
              description: item.description,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              version: 1,
              promptVersion: _meta.promptVersion,
              modelUsed: _meta.modelUsed,
              tokenUsage: {
                inputTokens: _meta.inputTokens,
                outputTokens: _meta.outputTokens,
              },
              extractionSource,
            };

            await saveWorkflow(workflow);
            savedIds.push(workflow.id);

            send({
              type: "decompose_complete",
              workflowId: tempId,
              workflowTitle: item.workflowTitle,
              savedId: workflow.id,
              current: i + 1,
              total: allExtracted.length,
              steps: decomposition.steps.length,
              gaps: decomposition.gaps.length,
              automationPotential: decomposition.health.automationPotential,
            });
          } catch (err) {
            decomposeFailed++;
            console.error(`[crawl-site] Decompose failed for "${item.workflowTitle}":`, err);
            send({
              type: "decompose_error",
              workflowId: tempId,
              workflowTitle: item.workflowTitle,
              error: err instanceof Error ? err.message : "Decomposition failed",
              current: i + 1,
              total: allExtracted.length,
            });
          }
        }

        // ─── STAGE 5: Pipeline complete ───
        send({
          type: "pipeline_complete",
          summary: {
            totalPages: pages.length,
            pagesScraped: scrapedPages.length,
            pagesWithWorkflows: new Set(allExtracted.map((e) => e.pageUrl)).size,
            totalWorkflows: allExtracted.length,
            workflowsSaved: savedIds.length,
            workflowsFailed: decomposeFailed,
            savedWorkflowIds: savedIds,
          },
        });
      } catch (err) {
        console.error("[crawl-site] Pipeline error:", err);
        send({
          type: "pipeline_error",
          error: err instanceof Error ? err.message : "Pipeline failed unexpectedly.",
        });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
