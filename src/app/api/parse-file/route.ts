import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// Allow up to 60s for large file parsing
export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_CHARS = 30_000;

// ─── POST /api/parse-file ───
// Accepts FormData with a single file and returns extracted text.
// Supported: .pdf, .docx, .xlsx, .xls
// Text-based files (.txt, .md, .csv, .json) should be parsed client-side.

export async function POST(request: NextRequest) {
  // Rate limit: 15 file parses per minute per IP
  const ip = getClientIp(request);
  const rl = rateLimit(`parse-file:${ip}`, 15, 60);
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
    const lastDotIndex = fileName.lastIndexOf(".");
    if (lastDotIndex === -1) {
      return NextResponse.json(
        { error: "File must have an extension (e.g., .pdf, .docx, .xlsx)." },
        { status: 400 }
      );
    }
    const ext = fileName.substring(lastDotIndex).toLowerCase();

    let content: string;

    if (ext === ".pdf") {
      // pdf-parse uses CJS `module.exports =` — cast for dynamic require
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

    } else if (ext === ".xlsx" || ext === ".xls") {
      const XLSX = await import("xlsx");
      const buffer = Buffer.from(await file.arrayBuffer());
      const workbook = XLSX.read(buffer, { type: "buffer" });

      // Extract text from ALL sheets, labeled by tab name
      const sheetTexts: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        // Convert sheet to CSV text (preserves all data)
        const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
        if (csv.trim().length === 0) continue;

        sheetTexts.push(`\n--- Sheet: ${sheetName} ---\n${csv}`);
      }

      if (sheetTexts.length === 0) {
        return NextResponse.json(
          { error: "Excel file contains no readable data in any sheet." },
          { status: 422 }
        );
      }

      content = sheetTexts.join("\n");

    } else {
      return NextResponse.json(
        { error: `Unsupported file type: ${ext}. Server-side parsing supports .pdf, .docx, .xlsx, and .xls.` },
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
