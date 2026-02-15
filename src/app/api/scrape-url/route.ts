import { NextRequest, NextResponse } from "next/server";
import Firecrawl from "@mendable/firecrawl-js";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// ─── POST /api/scrape-url ───
// Scrapes a URL via Firecrawl and returns clean markdown text
// suitable for pasting into the workflow textarea or feeding into extraction.

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

    // v2 API: .scrape() returns Document directly
    const result = await firecrawl.scrape(url, {
      formats: ["markdown"],
    });

    const markdown = result.markdown || "";
    const title = result.metadata?.title || parsed.hostname;

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
