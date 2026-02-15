import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// Allow up to 60s for large PDF parsing
export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_CHARS = 30_000;

// ─── POST /api/parse-file ───
// Accepts FormData with a single file (.pdf or .docx) and returns extracted text.
// Text-based files (.txt, .md, .csv, .json) should be parsed client-side.

export async function POST(request: NextRequest) {
  // Rate limit: 10 file parses per minute per IP
  const ip = getClientIp(request);
  const rl = rateLimit(`parse-file:${ip}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rl.resetInSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(rl.resetInSeconds) } }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "File is empty." },
        { status: 400 }
      );
    }

    const fileName = file.name;
    const ext = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();

    let content: string;

    if (ext === ".pdf") {
      // pdf-parse uses CJS `module.exports =` — cast through eslint-disable for dynamic require
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
      const buffer = Buffer.from(await file.arrayBuffer());
      const pdfData = await pdfParse(buffer);
      content = pdfData.text;
    } else if (ext === ".docx") {
      const mammoth = await import("mammoth");
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await mammoth.extractRawText({ buffer });
      content = result.value;
    } else {
      return NextResponse.json(
        { error: `Unsupported file type: ${ext}. Server-side parsing supports .pdf and .docx only.` },
        { status: 400 }
      );
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract any text from this file. It may be image-only or encrypted." },
        { status: 422 }
      );
    }

    // Truncate to 30k chars (same as other import routes)
    const truncated = content.length > MAX_CHARS;
    const safeContent = truncated ? content.slice(0, MAX_CHARS) : content;

    return NextResponse.json({
      title: fileName.replace(/\.[^.]+$/, ""),
      content: safeContent,
      charCount: safeContent.length,
      originalLength: content.length,
      truncated,
      fileType: ext,
      fileName,
    });
  } catch (err) {
    console.error("[parse-file] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse file." },
      { status: 500 }
    );
  }
}
