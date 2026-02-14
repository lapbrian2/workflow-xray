import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";

/**
 * Extract page ID from a Notion URL or raw ID string.
 * Supports formats:
 *   - https://www.notion.so/Page-Title-abc123def456
 *   - https://www.notion.so/workspace/Page-Title-abc123def456
 *   - abc123def456 (raw 32-char hex)
 *   - abc123de-f456-7890-abcd-ef1234567890 (UUID)
 */
function extractPageId(input: string): string | null {
  // Already a UUID with dashes
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(input)) return input;

  // 32-char hex without dashes
  const hexRegex = /^[0-9a-f]{32}$/i;
  if (hexRegex.test(input)) {
    // Convert to UUID format
    return `${input.slice(0, 8)}-${input.slice(8, 12)}-${input.slice(12, 16)}-${input.slice(16, 20)}-${input.slice(20)}`;
  }

  // Notion URL — extract the last 32 hex characters
  const urlMatch = input.match(/([0-9a-f]{32})\s*$/i);
  if (urlMatch) {
    const hex = urlMatch[1];
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Try extracting UUID from URL path
  const uuidInUrl = input.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  if (uuidInUrl) return uuidInUrl[1];

  return null;
}

/**
 * Recursively extract text content from Notion block children.
 */
function extractTextFromBlocks(blocks: Array<{ type: string; [key: string]: unknown }>): string {
  const lines: string[] = [];

  for (const block of blocks) {
    const blockType = block.type as string;
    const blockData = block[blockType] as {
      rich_text?: Array<{ plain_text: string }>;
      text?: Array<{ plain_text: string }>;
    } | undefined;

    if (!blockData) continue;

    const richText = blockData.rich_text || blockData.text;
    if (richText && Array.isArray(richText)) {
      const text = richText.map((t) => t.plain_text).join("");

      // Add formatting based on block type
      switch (blockType) {
        case "heading_1":
          lines.push(`\n# ${text}`);
          break;
        case "heading_2":
          lines.push(`\n## ${text}`);
          break;
        case "heading_3":
          lines.push(`\n### ${text}`);
          break;
        case "bulleted_list_item":
          lines.push(`- ${text}`);
          break;
        case "numbered_list_item":
          lines.push(`• ${text}`);
          break;
        case "to_do": {
          const checked = (block[blockType] as { checked?: boolean })?.checked;
          lines.push(`${checked ? "[x]" : "[ ]"} ${text}`);
          break;
        }
        case "toggle":
          lines.push(`> ${text}`);
          break;
        case "quote":
          lines.push(`> ${text}`);
          break;
        case "callout":
          lines.push(`> ${text}`);
          break;
        case "code":
          lines.push(`\`\`\`\n${text}\n\`\`\``);
          break;
        case "divider":
          lines.push("---");
          break;
        default:
          if (text.trim()) {
            lines.push(text);
          }
      }
    }

    // Handle divider blocks
    if (blockType === "divider") {
      lines.push("---");
    }
  }

  return lines.join("\n").trim();
}

export async function POST(request: NextRequest) {
  try {
    const notionKey = process.env.NOTION_API_KEY;

    if (!notionKey) {
      return NextResponse.json(
        {
          error: "Notion integration not configured. Add NOTION_API_KEY to your environment variables.",
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { pageUrl } = body;

    if (!pageUrl || typeof pageUrl !== "string") {
      return NextResponse.json(
        { error: "Provide a Notion page URL or ID" },
        { status: 400 }
      );
    }

    const pageId = extractPageId(pageUrl.trim());
    if (!pageId) {
      return NextResponse.json(
        { error: "Could not extract a valid Notion page ID from the provided URL" },
        { status: 400 }
      );
    }

    const notion = new Client({ auth: notionKey });

    // Fetch page metadata (title)
    const page = await notion.pages.retrieve({ page_id: pageId });

    let title = "Imported from Notion";
    const pageProps = (page as { properties?: Record<string, { title?: Array<{ plain_text: string }> }> }).properties;
    if (pageProps) {
      // Find the title property
      for (const val of Object.values(pageProps)) {
        if (val.title && Array.isArray(val.title)) {
          title = val.title.map((t) => t.plain_text).join("");
          break;
        }
      }
    }

    // Fetch all child blocks (paginated)
    const allBlocks: Array<{ type: string; [key: string]: unknown }> = [];
    let cursor: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const response = await notion.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
        page_size: 100,
      });

      allBlocks.push(
        ...response.results as Array<{ type: string; [key: string]: unknown }>
      );
      hasMore = response.has_more;
      cursor = response.next_cursor ?? undefined;
    }

    const content = extractTextFromBlocks(allBlocks);

    if (!content.trim()) {
      return NextResponse.json(
        { error: "The Notion page appears to be empty or contains only unsupported block types." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      title,
      content: `${title}\n\n${content}`,
      pageId,
      blockCount: allBlocks.length,
    });
  } catch (error) {
    console.error("Notion import error:", error);

    // Handle specific Notion API errors
    const notionError = error as { code?: string; status?: number };
    if (notionError.code === "object_not_found") {
      return NextResponse.json(
        {
          error:
            "Page not found. Make sure the Workflow X-Ray integration has been added to this page (page menu → Connections → add 'Workflow X-Ray').",
        },
        { status: 404 }
      );
    }

    if (notionError.status === 401) {
      return NextResponse.json(
        { error: "Notion API key is invalid or expired. Check your NOTION_API_KEY." },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to import from Notion",
      },
      { status: 500 }
    );
  }
}
