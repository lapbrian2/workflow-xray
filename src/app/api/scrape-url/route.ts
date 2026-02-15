import { NextRequest, NextResponse } from "next/server";
import Firecrawl from "@mendable/firecrawl-js";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// ─── POST /api/scrape-url ───
// Scrapes a URL via Firecrawl and returns clean markdown text + optional screenshot.
// When the page has minimal text (visual editor, canvas app), flags isVisualContent.

/**
 * Strip boilerplate text to measure "meaningful" content.
 * Nav links, footers, cookie banners, etc. are noise.
 */
function stripBoilerplate(markdown: string): string {
  const boilerplate = [
    "sign in", "sign up", "log in", "log out", "cookie", "privacy policy",
    "terms of service", "subscribe", "newsletter", "follow us",
    "copyright", "all rights reserved", "powered by", "accept cookies",
    "close menu", "open menu", "skip to content",
  ];

  return markdown
    .split("\n")
    .filter((line) => line.trim().length >= 20)
    .filter((line) => {
      const lower = line.toLowerCase();
      return !boilerplate.some((phrase) => lower.includes(phrase));
    })
    .join("\n")
    .trim();
}

const LOW_TEXT_THRESHOLD = 200;

export async function POST(request: NextRequest) {
  // Rate limit: 10 scrapes per minute per IP
  const ip = getClientIp(request);
  const rl = rateLimit(`scrape-url:${ip}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rl.resetInSeconds}s.` },
      { status: 429 }
    );
  }

  // Parse body safely
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const { url } = body;
  if (!url || typeof url !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid 'url' field." },
      { status: 400 }
    );
  }

  // Basic URL validation
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json(
      { error: "Invalid URL format." },
      { status: 400 }
    );
  }

  // Block non-http(s) protocols
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json(
      { error: "Only HTTP and HTTPS URLs are supported." },
      { status: 400 }
    );
  }

  // Ensure Firecrawl API key is configured
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Firecrawl is not configured. Set FIRECRAWL_API_KEY in environment." },
      { status: 503 }
    );
  }

  try {
    const firecrawl = new Firecrawl({ apiKey });

    // v2 API: request both markdown and screenshot
    const result = await firecrawl.scrape(url, {
      formats: ["markdown", "screenshot"],
    });

    const markdown = result.markdown || "";
    const screenshot = result.screenshot || null;
    const title = result.metadata?.title || parsed.hostname;

    // Detect visual-heavy pages (SPA, dashboards, canvas editors, etc.)
    const meaningfulContent = stripBoilerplate(markdown);
    const isVisualContent = meaningfulContent.length < LOW_TEXT_THRESHOLD && !!screenshot;

    // Truncate very large pages to 30k chars (same as Notion import)
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
      // Vision fallback fields
      isVisualContent,
      screenshot,
    });
  } catch (err) {
    console.error("[scrape-url] Firecrawl error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to scrape URL. The page may be inaccessible.",
      },
      { status: 502 }
    );
  }
}
