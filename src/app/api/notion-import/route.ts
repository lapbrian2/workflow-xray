import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { withApiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/api-errors";
import { NotionImportSchema } from "@/lib/validation";
import type { NotionImportInput } from "@/lib/validation";

/**
 * Extract page ID from a Notion URL or raw ID string.
 */
function extractPageId(input: string): string | null {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(input)) return input;

  const hexRegex = /^[0-9a-f]{32}$/i;
  if (hexRegex.test(input)) {
    return `${input.slice(0, 8)}-${input.slice(8, 12)}-${input.slice(12, 16)}-${input.slice(16, 20)}-${input.slice(20)}`;
  }

  const urlMatch = input.match(/([0-9a-f]{32})\s*$/i);
  if (urlMatch) {
    const hex = urlMatch[1];
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  const uuidInUrl = input.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  if (uuidInUrl) return uuidInUrl[1];

  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NotionBlock = any;

/**
 * Get rich text content from a block's rich_text array.
 */
function getRichText(block: NotionBlock, blockType: string): string {
  const data = block[blockType];
  if (!data) return "";
  const richText = data.rich_text || data.text;
  if (!richText || !Array.isArray(richText)) return "";
  return richText.map((t: { plain_text: string }) => t.plain_text).join("");
}

/**
 * Recursively fetch ALL blocks (including nested children) from a Notion page.
 */
const MAX_TOTAL_BLOCKS = 1000; // Safety limit to prevent runaway recursion

async function fetchAllBlocks(
  notion: Client,
  blockId: string,
  depth = 0,
  maxDepth = 6,
  counter = { count: 0 }
): Promise<NotionBlock[]> {
  if (depth > maxDepth) return [];
  if (counter.count >= MAX_TOTAL_BLOCKS) return [];

  const blocks: NotionBlock[] = [];
  let cursor: string | undefined = undefined;
  let hasMore = true;

  while (hasMore && counter.count < MAX_TOTAL_BLOCKS) {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const block of response.results) {
      if (counter.count >= MAX_TOTAL_BLOCKS) break;
      counter.count++;
      blocks.push(block);

      // Recursively fetch children for blocks that have them
      const b = block as NotionBlock;
      if (b.has_children && counter.count < MAX_TOTAL_BLOCKS) {
        const children = await fetchAllBlocks(
          notion,
          b.id,
          depth + 1,
          maxDepth,
          counter
        );
        // Attach children to the block for indented rendering
        b._children = children;
      }
    }

    hasMore = response.has_more;
    cursor = response.next_cursor ?? undefined;
  }

  return blocks;
}

/**
 * Convert blocks tree into readable text, preserving structure with indentation.
 */
function blocksToText(blocks: NotionBlock[], indent = 0): string {
  const lines: string[] = [];
  const prefix = "  ".repeat(indent);
  let numberedCounter = 0;

  for (const block of blocks) {
    const blockType = block.type as string;
    const text = getRichText(block, blockType);

    // Reset numbered list counter when block isn't a numbered item
    if (blockType !== "numbered_list_item") {
      numberedCounter = 0;
    }

    switch (blockType) {
      case "heading_1":
        lines.push(`\n${prefix}# ${text}`);
        break;
      case "heading_2":
        lines.push(`\n${prefix}## ${text}`);
        break;
      case "heading_3":
        lines.push(`\n${prefix}### ${text}`);
        break;
      case "paragraph":
        if (text.trim()) {
          lines.push(`${prefix}${text}`);
        } else {
          lines.push(""); // preserve blank lines
        }
        break;
      case "bulleted_list_item":
        lines.push(`${prefix}- ${text}`);
        break;
      case "numbered_list_item":
        numberedCounter++;
        lines.push(`${prefix}${numberedCounter}. ${text}`);
        break;
      case "to_do": {
        const checked = block[blockType]?.checked;
        lines.push(`${prefix}${checked ? "[x]" : "[ ]"} ${text}`);
        break;
      }
      case "toggle":
        lines.push(`${prefix}▸ ${text}`);
        break;
      case "quote":
        lines.push(`${prefix}> ${text}`);
        break;
      case "callout": {
        const icon = block[blockType]?.icon?.emoji || "\u{1F4A1}";
        lines.push(`${prefix}${icon} ${text}`);
        break;
      }
      case "code": {
        const lang = block[blockType]?.language || "";
        lines.push(`${prefix}\`\`\`${lang}\n${prefix}${text}\n${prefix}\`\`\``);
        break;
      }
      case "divider":
        lines.push(`${prefix}---`);
        break;
      case "table_row": {
        const cells = block[blockType]?.cells;
        if (cells && Array.isArray(cells)) {
          const row = cells
            .map((cell: Array<{ plain_text: string }>) =>
              cell.map((t) => t.plain_text).join("")
            )
            .join(" | ");
          lines.push(`${prefix}| ${row} |`);
        }
        break;
      }
      case "child_page":
        lines.push(`${prefix}\u{1F4C4} ${block[blockType]?.title || "Untitled page"}`);
        break;
      case "child_database":
        lines.push(
          `${prefix}\u{1F5C2}\uFE0F ${block[blockType]?.title || "Untitled database"}`
        );
        break;
      case "bookmark":
        lines.push(`${prefix}\u{1F517} ${block[blockType]?.url || ""}`);
        break;
      case "embed":
        lines.push(`${prefix}\u{1F4CE} ${block[blockType]?.url || ""}`);
        break;
      case "image": {
        const caption =
          block[blockType]?.caption
            ?.map((c: { plain_text: string }) => c.plain_text)
            .join("") || "";
        lines.push(`${prefix}[Image${caption ? `: ${caption}` : ""}]`);
        break;
      }
      case "video":
        lines.push(`${prefix}[Video]`);
        break;
      case "file":
        lines.push(
          `${prefix}[File: ${block[blockType]?.name || "attachment"}]`
        );
        break;
      case "pdf":
        lines.push(`${prefix}[PDF]`);
        break;
      case "equation":
        lines.push(`${prefix}$${block[blockType]?.expression || ""}$`);
        break;
      case "column_list":
        break;
      case "column":
        break;
      case "synced_block":
        break;
      case "table":
        break;
      case "link_to_page":
        lines.push(`${prefix}\u2192 [Linked page]`);
        break;
      case "table_of_contents":
        lines.push(`${prefix}[Table of Contents]`);
        break;
      case "breadcrumb":
        break; // skip breadcrumbs
      default:
        if (text.trim()) {
          lines.push(`${prefix}${text}`);
        }
    }

    // Process nested children (toggles, columns, synced blocks, tables, etc.)
    if (block._children && block._children.length > 0) {
      const childIndent =
        blockType === "column_list" || blockType === "column"
          ? indent
          : indent + 1;
      const childText = blocksToText(block._children, childIndent);
      if (childText.trim()) {
        lines.push(childText);
      }
    }
  }

  return lines.join("\n");
}

export const POST = withApiHandler<NotionImportInput>(
  async (request, body) => {
    // Rate limit: 15 imports per minute per IP
    const ip = getClientIp(request);
    const rl = rateLimit(`notion-import:${ip}`, 15, 60);
    if (!rl.allowed) {
      throw new AppError("RATE_LIMITED", `Rate limit exceeded. Try again in ${rl.resetInSeconds}s.`, 429);
    }

    const notionKey = process.env.NOTION_API_KEY;
    if (!notionKey) {
      throw new AppError("SERVICE_UNAVAILABLE", "Notion integration not configured. Add NOTION_API_KEY to your environment variables.", 503);
    }

    const pageId = extractPageId(body.pageUrl.trim());
    if (!pageId) {
      throw new AppError("VALIDATION_ERROR", "Could not extract a valid Notion page ID from the provided URL.", 400);
    }

    let page;
    let allBlocks: NotionBlock[];
    try {
      const notion = new Client({ auth: notionKey });

      // Fetch page metadata (title)
      page = await notion.pages.retrieve({ page_id: pageId });

      // Recursively fetch ALL blocks including nested children
      allBlocks = await fetchAllBlocks(notion, pageId);
    } catch (error) {
      console.error("Notion import error:", error);

      const notionError = error as { code?: string; status?: number };
      if (notionError.code === "object_not_found") {
        throw new AppError("NOT_FOUND", "Page not found. Make sure the Workflow X-Ray integration has been added to this page (page menu \u2192 Connections \u2192 add 'Workflow X-Ray').", 404);
      }
      if (notionError.status === 401) {
        throw new AppError("UNAUTHORIZED", "Notion connection expired. Ask your admin to reconnect the Workflow X-Ray integration.", 401);
      }
      if (notionError.status === 403) {
        throw new AppError("UNAUTHORIZED", "The Workflow X-Ray integration doesn't have access to this page. Add it via page menu \u2192 Connections.", 403);
      }
      throw new AppError("AI_ERROR", "Failed to import from Notion. Please try again.", 502);
    }

    let title = "Imported from Notion";
    const pageProps = (
      page as {
        properties?: Record<
          string,
          { title?: Array<{ plain_text: string }> }
        >;
      }
    ).properties;
    if (pageProps) {
      for (const val of Object.values(pageProps)) {
        if (val.title && Array.isArray(val.title)) {
          title = val.title.map((t) => t.plain_text).join("");
          break;
        }
      }
    }

    // Convert to readable text
    const content = blocksToText(allBlocks).trim();

    // Count total blocks including nested
    let totalBlocks = 0;
    function countBlocks(blocks: NotionBlock[]) {
      for (const b of blocks) {
        totalBlocks++;
        if (b._children) countBlocks(b._children);
      }
    }
    countBlocks(allBlocks);

    if (!content) {
      throw new AppError("VALIDATION_ERROR", "The Notion page appears to be empty or contains only unsupported block types.", 422);
    }

    // Content size check — truncate at word/line boundary if too large
    const MAX_CHARS = 30_000;
    const fullContent = `${title}\n\n${content}`;
    const truncated = fullContent.length > MAX_CHARS;
    let safeContent: string;
    if (truncated) {
      let cutPoint = fullContent.lastIndexOf("\n", MAX_CHARS);
      if (cutPoint < MAX_CHARS * 0.8) {
        cutPoint = fullContent.lastIndexOf(" ", MAX_CHARS);
      }
      if (cutPoint < MAX_CHARS * 0.8) {
        cutPoint = MAX_CHARS;
      }
      safeContent =
        fullContent.slice(0, cutPoint) +
        "\n\n[... Content truncated. The original page has " +
        fullContent.length.toLocaleString() +
        " characters. Only the first " +
        cutPoint.toLocaleString() +
        " characters were imported for analysis.]";
    } else {
      safeContent = fullContent;
    }

    return NextResponse.json({
      title,
      content: safeContent,
      pageId,
      blockCount: totalBlocks,
      truncated,
      originalLength: fullContent.length,
    });
  },
  { schema: NotionImportSchema }
);
