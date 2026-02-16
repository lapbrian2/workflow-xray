import { NextRequest, NextResponse } from "next/server";
import Firecrawl from "@mendable/firecrawl-js";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { stripBoilerplate, LOW_TEXT_THRESHOLD } from "@/lib/scrape-utils";
import { withApiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/api-errors";
import { ScrapeUrlSchema } from "@/lib/validation";
import type { ScrapeUrlInput } from "@/lib/validation";

// ─── POST /api/scrape-url ───

export const POST = withApiHandler<ScrapeUrlInput>(
  async (request, body) => {
    // Rate limit: 10 scrapes per minute per IP
    const ip = getClientIp(request);
    const rl = rateLimit(`scrape-url:${ip}`, 10, 60);
    if (!rl.allowed) {
      throw new AppError("RATE_LIMITED", `Rate limit exceeded. Try again in ${rl.resetInSeconds}s.`, 429);
    }

    // Basic URL validation
    let parsed: URL;
    try {
      parsed = new URL(body.url);
    } catch {
      throw new AppError("VALIDATION_ERROR", "Invalid URL format.", 400);
    }

    // Block non-http(s) protocols
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new AppError("VALIDATION_ERROR", "Only HTTP and HTTPS URLs are supported.", 400);
    }

    // Block private/internal IPs (SSRF protection)
    const hostname = parsed.hostname.toLowerCase();
    const isPrivate =
      hostname === "localhost" ||
      hostname === "0.0.0.0" ||
      hostname === "[::]" ||
      hostname === "[::1]" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("169.254.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
    if (isPrivate) {
      throw new AppError("VALIDATION_ERROR", "Cannot scrape private or internal network addresses.", 400);
    }

    // Ensure Firecrawl API key is configured
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new AppError("SERVICE_UNAVAILABLE", "Firecrawl is not configured. Set FIRECRAWL_API_KEY in environment.", 503);
    }

    let result;
    try {
      const firecrawl = new Firecrawl({ apiKey });
      result = await firecrawl.scrape(body.url, {
        formats: ["markdown", "screenshot"],
      });
    } catch (error) {
      console.error("[scrape-url] Firecrawl error:", error);
      throw new AppError("AI_ERROR", "Failed to scrape URL. The page may be inaccessible or blocked.", 502);
    }

    const markdown = result.markdown || "";
    const screenshot = result.screenshot || null;
    const title = result.metadata?.title || parsed.hostname;

    // Detect visual-heavy pages (SPA, dashboards, canvas editors, etc.)
    const meaningfulContent = stripBoilerplate(markdown);
    const isVisualContent = meaningfulContent.length < LOW_TEXT_THRESHOLD && !!screenshot;

    // Truncate very large pages to 30k chars
    const MAX_CHARS = 30_000;
    const truncated = markdown.length > MAX_CHARS;
    const content = truncated ? markdown.slice(0, MAX_CHARS) : markdown;

    return NextResponse.json({
      title,
      content,
      url: parsed.href,
      charCount: content.length,
      originalLength: markdown.length,
      truncated,
      isVisualContent,
      screenshot,
    });
  },
  { schema: ScrapeUrlSchema }
);
