import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { withApiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/api-errors";

// Allow up to 60s for large file parsing
export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_CHARS = 30_000;

// ─── POST /api/parse-file ───
// Accepts FormData with a single file and returns extracted text.
// Supported: .pdf, .docx, .xlsx, .xls
// Text-based files (.txt, .md, .csv, .json) should be parsed client-side.

export const POST = withApiHandler(
  async (request) => {
    // Rate limit: 15 file parses per minute per IP
    const ip = getClientIp(request);
    const rl = rateLimit(`parse-file:${ip}`, 15, 60);
    if (!rl.allowed) {
      throw new AppError("RATE_LIMITED", `Rate limit exceeded. Try again in ${rl.resetInSeconds}s.`, 429);
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new AppError("VALIDATION_ERROR", "Request must be multipart/form-data.", 400);
    }

    const file = formData.get("file") as File | null;

    if (!file) {
      throw new AppError("VALIDATION_ERROR", "No file provided.", 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new AppError("VALIDATION_ERROR", `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`, 400);
    }

    if (file.size === 0) {
      throw new AppError("VALIDATION_ERROR", "File is empty.", 400);
    }

    const fileName = file.name;
    const lastDotIndex = fileName.lastIndexOf(".");
    if (lastDotIndex === -1) {
      throw new AppError("VALIDATION_ERROR", "File must have an extension (e.g., .pdf, .docx, .xlsx).", 400);
    }
    const ext = fileName.substring(lastDotIndex).toLowerCase();

    let content: string;
    const buffer = Buffer.from(await file.arrayBuffer());

    if (ext === ".pdf") {
      // Validate PDF magic bytes (%PDF-)
      if (buffer.length < 5 || buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
        throw new AppError("VALIDATION_ERROR", "File is not a valid PDF.", 400);
      }
      // pdf-parse uses CJS `module.exports =` — cast for dynamic require
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
      const pdfData = await pdfParse(buffer);
      content = pdfData.text;

    } else if (ext === ".docx") {
      // Validate DOCX magic bytes (PK zip header)
      if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
        throw new AppError("VALIDATION_ERROR", "File is not a valid DOCX document.", 400);
      }
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      content = result.value;

    } else if (ext === ".xlsx" || ext === ".xls") {
      // Validate Excel magic bytes: PK (xlsx) or 0xD0CF (xls OLE2)
      const isPK = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
      const isOLE = buffer.length >= 4 && buffer[0] === 0xd0 && buffer[1] === 0xcf;
      if (!isPK && !isOLE) {
        throw new AppError("VALIDATION_ERROR", "File is not a valid Excel spreadsheet.", 400);
      }
      const XLSX = await import("xlsx");
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
        throw new AppError("VALIDATION_ERROR", "Excel file contains no readable data in any sheet.", 422);
      }

      content = sheetTexts.join("\n");

    } else {
      throw new AppError("VALIDATION_ERROR", `Unsupported file type: ${ext}. Server-side parsing supports .pdf, .docx, .xlsx, and .xls.`, 400);
    }

    if (!content || content.trim().length === 0) {
      throw new AppError("VALIDATION_ERROR", "Could not extract any text from this file. It may be image-only or encrypted.", 422);
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
  },
  { bodyType: "none" }
);
