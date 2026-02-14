import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import type { Workflow, GapType, Gap } from "@/lib/types";
import { GAP_LABELS } from "@/lib/types";

const GAP_TYPE_TO_NOTION: Record<GapType, string> = {
  bottleneck: "Manual Bottleneck",
  context_loss: "Context Loss",
  single_dependency: "Single-Person Dependency",
  manual_overhead: "Manual Overhead",
  missing_feedback: "Missing Feedback",
  missing_fallback: "Missing Fallback",
  scope_ambiguity: "Scope Ambiguity",
};

function getStatus(fragility: number): string {
  if (fragility > 70) return "Critical";
  if (fragility > 40) return "Needs Attention";
  return "Healthy";
}

function getBusiestOwner(steps: Workflow["decomposition"]["steps"]): string {
  const counts: Record<string, number> = {};
  for (const step of steps) {
    const owner = step.owner || "Unassigned";
    counts[owner] = (counts[owner] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return "—";
  return `${sorted[0][0]} (${sorted[0][1]} steps)`;
}

function getTopGap(gaps: Gap[]): string | null {
  // Sort by severity: high > medium > low
  const severityOrder = { high: 3, medium: 2, low: 1 };
  const sorted = [...gaps].sort(
    (a, b) => severityOrder[b.severity] - severityOrder[a.severity]
  );
  if (sorted.length === 0) return null;
  return GAP_TYPE_TO_NOTION[sorted[0].type] || null;
}

function estimateROISummary(gaps: Gap[], costContext?: Workflow["costContext"]): string {
  const bottlenecks = gaps.filter(
    (g) => g.severity === "high" || g.type === "bottleneck" || g.type === "manual_overhead"
  );
  if (bottlenecks.length === 0) return "Low waste detected";

  const rate = costContext?.hourlyRate ?? 50;
  const lowHrs = bottlenecks.length * 2;
  const highHrs = bottlenecks.length * 6;
  const lowAnnual = Math.round(lowHrs * rate * 52);
  const highAnnual = Math.round(highHrs * rate * 52);

  return `$${(lowAnnual / 1000).toFixed(0)}K–$${(highAnnual / 1000).toFixed(0)}K/yr savings potential`;
}

export async function POST(request: NextRequest) {
  try {
    const notionKey = process.env.NOTION_API_KEY;
    const databaseId = process.env.NOTION_XRAY_DATABASE_ID;

    if (!notionKey || !databaseId) {
      return NextResponse.json(
        {
          error: "Notion integration not configured. Add NOTION_API_KEY and NOTION_XRAY_DATABASE_ID to your environment variables.",
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const workflow: Workflow = body.workflow;

    if (!workflow || !workflow.decomposition) {
      return NextResponse.json(
        { error: "Invalid workflow data" },
        { status: 400 }
      );
    }

    const notion = new Client({ auth: notionKey });
    const { decomposition, costContext } = workflow;
    const { health, steps, gaps } = decomposition;

    const topGap = getTopGap(gaps);
    const appUrl = body.appUrl || `https://workflow-xray.vercel.app/xray/${workflow.id}`;

    // Build Notion properties
    const properties: Record<string, unknown> = {
      Workflow: {
        title: [{ text: { content: decomposition.title } }],
      },
      Status: {
        select: { name: getStatus(health.fragility) },
      },
      Steps: {
        number: steps.length,
      },
      Gaps: {
        number: gaps.length,
      },
      "Automation %": {
        number: health.automationPotential / 100, // Notion expects 0.49 not 49
      },
      Fragility: {
        number: health.fragility,
      },
      Complexity: {
        number: health.complexity,
      },
      "Team Balance": {
        number: health.teamLoadBalance,
      },
      "Busiest Owner": {
        rich_text: [{ text: { content: getBusiestOwner(steps) } }],
      },
      "ROI Estimate": {
        rich_text: [
          { text: { content: estimateROISummary(gaps, costContext) } },
        ],
      },
      Version: {
        number: workflow.version || 1,
      },
      "Last Analyzed": {
        date: {
          start: new Date(workflow.createdAt).toISOString().split("T")[0],
        },
      },
      "App Link": {
        url: appUrl,
      },
    };

    // Only add Top Gap if it matches an option
    if (topGap) {
      properties["Top Gap"] = { select: { name: topGap } };
    }

    // Add optional properties if provided
    if (body.department) {
      properties["Department"] = { select: { name: body.department } };
    }
    if (body.client) {
      properties["Client"] = {
        rich_text: [{ text: { content: body.client } }],
      };
    }

    // Build page content as proper Notion blocks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const children: any[] = [];

    // ── Workflow Steps section ──
    children.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Workflow Steps" } }],
      },
    });

    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const desc = s.description.length > 120
        ? s.description.slice(0, 120) + "..."
        : s.description;
      const meta = [
        `${s.automationScore}% automatable`,
        s.owner ? `owner: ${s.owner}` : null,
        s.layer ? `layer: ${s.layer}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      children.push({
        object: "block",
        type: "numbered_list_item",
        numbered_list_item: {
          rich_text: [
            { type: "text", text: { content: s.name }, annotations: { bold: true } },
            { type: "text", text: { content: ` — ${desc}` } },
            { type: "text", text: { content: `\n${meta}` }, annotations: { italic: true, color: "gray" } },
          ],
        },
      });
    }

    // ── Gaps section ──
    children.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Gaps Identified" } }],
      },
    });

    if (gaps.length > 0) {
      for (const g of gaps) {
        const desc = g.description.length > 140
          ? g.description.slice(0, 140) + "..."
          : g.description;
        const severityEmoji = g.severity === "high" ? "🔴" : g.severity === "medium" ? "🟡" : "🟢";

        children.push({
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [
              { type: "text", text: { content: `${severityEmoji} ${GAP_LABELS[g.type]}` }, annotations: { bold: true } },
              { type: "text", text: { content: ` (${g.severity})` }, annotations: { italic: true } },
              { type: "text", text: { content: ` — ${desc}` } },
            ],
          },
        });

        // Add suggestion as a nested child if available
        if (g.suggestion) {
          const suggText = g.suggestion.length > 200
            ? g.suggestion.slice(0, 200) + "..."
            : g.suggestion;
          children.push({
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [
                { type: "text", text: { content: "💡 " } },
                { type: "text", text: { content: suggText }, annotations: { italic: true, color: "gray" } },
              ],
            },
          });
        }
      }
    } else {
      children.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            { type: "text", text: { content: "No gaps detected." }, annotations: { italic: true, color: "gray" } },
          ],
        },
      });
    }

    // ── Health Scores section ──
    children.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Health Scores" } }],
      },
    });

    const healthItems = [
      { label: "Complexity", value: health.complexity, suffix: "/100" },
      { label: "Fragility", value: health.fragility, suffix: "/100" },
      { label: "Automation Potential", value: health.automationPotential, suffix: "%" },
      { label: "Team Load Balance", value: health.teamLoadBalance, suffix: "/100" },
    ];

    for (const item of healthItems) {
      const bar = "█".repeat(Math.round(item.value / 10)) + "░".repeat(10 - Math.round(item.value / 10));
      children.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [
            { type: "text", text: { content: `${item.label}: ` }, annotations: { bold: true } },
            { type: "text", text: { content: `${item.value}${item.suffix}` } },
            { type: "text", text: { content: `  ${bar}` }, annotations: { code: true } },
          ],
        },
      });
    }

    // ── ROI Summary ──
    const roiSummary = estimateROISummary(gaps, costContext);
    if (roiSummary !== "Low waste detected") {
      children.push({
        object: "block",
        type: "callout",
        callout: {
          rich_text: [
            { type: "text", text: { content: `ROI Estimate: ${roiSummary}` }, annotations: { bold: true } },
          ],
          icon: { type: "emoji", emoji: "💰" },
          color: "yellow_background",
        },
      });
    }

    // ── Divider + timestamp ──
    children.push({
      object: "block",
      type: "divider",
      divider: {},
    });

    children.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          {
            type: "text",
            text: {
              content: `Synced from Workflow X-Ray on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
            },
            annotations: { italic: true, color: "gray" },
          },
          { type: "text", text: { content: "  " } },
          {
            type: "text",
            text: { content: "Open in X-Ray →", link: { url: appUrl } },
            annotations: { color: "blue" },
          },
        ],
      },
    });

    // If notionPageId is provided, update the existing page instead of creating new
    const existingPageId = body.notionPageId;

    let responsePageId: string;

    if (existingPageId) {
      // Update existing page properties
      await notion.pages.update({
        page_id: existingPageId,
        properties: properties as Record<string, never>,
      });

      // Delete existing children blocks and replace with new ones
      // First, get existing children
      const existingBlocks = await notion.blocks.children.list({
        block_id: existingPageId,
        page_size: 100,
      });

      // Delete old blocks
      for (const block of existingBlocks.results) {
        try {
          await notion.blocks.delete({ block_id: (block as { id: string }).id });
        } catch {
          // Some blocks may not be deletable — skip
        }
      }

      // Append new children
      // Notion allows max 100 children per append call
      for (let i = 0; i < children.length; i += 100) {
        await notion.blocks.children.append({
          block_id: existingPageId,
          children: children.slice(i, i + 100),
        });
      }

      responsePageId = existingPageId;
    } else {
      // Create a new page
      const response = await notion.pages.create({
        parent: { database_id: databaseId },
        properties: properties as Record<string, never>,
        children,
      });
      responsePageId = (response as { id: string }).id;
    }

    return NextResponse.json({
      success: true,
      notionUrl: `https://notion.so/${responsePageId.replace(/-/g, "")}`,
      pageId: responsePageId,
      updated: !!existingPageId,
    });
  } catch (error) {
    console.error("Notion sync error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to sync to Notion",
      },
      { status: 500 }
    );
  }
}
