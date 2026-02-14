import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import type { RemediationPlan } from "@/lib/types";
import { TASK_PRIORITY_LABELS, TASK_EFFORT_LABELS, GAP_LABELS } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 syncs per minute per IP
    const ip = getClientIp(request);
    const rl = rateLimit(`remediation-notion:${ip}`, 10, 60);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { "Retry-After": String(rl.resetInSeconds) } }
      );
    }

    const notionKey = process.env.NOTION_API_KEY;
    if (!notionKey) {
      return NextResponse.json(
        { error: "Notion integration not configured." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const plan: RemediationPlan = body.plan;
    const gaps: { type: string; severity: string }[] = Array.isArray(body.gaps) ? body.gaps : [];

    if (!plan || !plan.phases || !Array.isArray(plan.phases) || plan.phases.length === 0) {
      return NextResponse.json(
        { error: "Invalid remediation plan data. Plan must have at least one phase." },
        { status: 400 }
      );
    }

    const notion = new Client({ auth: notionKey });

    // Build Notion blocks for the remediation plan
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const children: any[] = [];

    // ── Executive Summary ──
    children.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Executive Summary" } }],
      },
    });

    children.push({
      object: "block",
      type: "callout",
      callout: {
        rich_text: [
          { type: "text", text: { content: plan.summary } },
        ],
        icon: { type: "emoji", emoji: "📋" },
        color: "blue_background",
      },
    });

    // ── Phase sections ──
    const totalTasks = plan.phases.reduce((s, p) => s + p.tasks.length, 0);
    children.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          { type: "text", text: { content: `${plan.phases.length} phases · ${totalTasks} tasks` }, annotations: { bold: true } },
        ],
      },
    });

    for (const phase of plan.phases) {
      children.push({
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [
            { type: "text", text: { content: `${phase.name}` } },
            { type: "text", text: { content: ` — ${phase.timeframe}` }, annotations: { italic: true } },
          ],
        },
      });

      if (phase.description) {
        children.push({
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              { type: "text", text: { content: phase.description }, annotations: { italic: true } },
            ],
          },
        });
      }

      // Tasks as to-do items
      for (const task of phase.tasks) {
        const priorityEmoji = task.priority === "critical" ? "🔴" : task.priority === "high" ? "🟠" : task.priority === "medium" ? "🔵" : "🟢";

        children.push({
          object: "block",
          type: "to_do",
          to_do: {
            rich_text: [
              { type: "text", text: { content: `${priorityEmoji} ${task.title}` }, annotations: { bold: true } },
              { type: "text", text: { content: ` [${TASK_PRIORITY_LABELS[task.priority]}]` }, annotations: { } },
            ],
            checked: task.status === "completed",
          },
        });

        // Description
        const desc = task.description.length > 200
          ? task.description.slice(0, 200) + "..."
          : task.description;
        children.push({
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              { type: "text", text: { content: desc } },
            ],
          },
        });

        // Meta line
        const meta: string[] = [];
        if (task.owner) meta.push(`Owner: ${task.owner}`);
        meta.push(`Effort: ${TASK_EFFORT_LABELS[task.effort]}`);
        if (task.tools.length > 0) meta.push(`Tools: ${task.tools.join(", ")}`);

        children.push({
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              { type: "text", text: { content: meta.join(" · ") }, annotations: { italic: true } },
            ],
          },
        });

        // Success metric
        if (task.successMetric) {
          children.push({
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [
                { type: "text", text: { content: "✅ " } },
                { type: "text", text: { content: task.successMetric }, annotations: { italic: true } },
              ],
            },
          });
        }

        // Addressed gaps
        if (task.gapIds.length > 0) {
          const gapNames = task.gapIds
            .map((idx) => {
              const g = gaps[idx];
              if (!g) return null;
              return GAP_LABELS[g.type as keyof typeof GAP_LABELS] || g.type;
            })
            .filter(Boolean)
            .join(", ");
          if (gapNames) {
            children.push({
              object: "block",
              type: "paragraph",
              paragraph: {
                rich_text: [
                  { type: "text", text: { content: `Addresses: ${gapNames}` }, annotations: { italic: true } },
                ],
              },
            });
          }
        }
      }
    }

    // ── Projected Impact ──
    if (plan.projectedImpact.length > 0) {
      children.push({
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "Projected Impact" } }],
        },
      });

      for (const impact of plan.projectedImpact) {
        children.push({
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [
              { type: "text", text: { content: impact.metricName }, annotations: { bold: true } },
              { type: "text", text: { content: `: ${impact.currentValue} → ${impact.projectedValue}` } },
              { type: "text", text: { content: ` (${impact.confidence} confidence)` }, annotations: { italic: true } },
            ],
          },
        });
      }
    }

    // ── Footer ──
    children.push({
      object: "block",
      type: "divider",
      divider: {},
    });

    const syncTimestamp = new Date().toLocaleString("en-US", {
      month: "long", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
    });

    children.push({
      object: "block",
      type: "callout",
      callout: {
        rich_text: [
          { type: "text", text: { content: `Generated by Workflow X-Ray on ${syncTimestamp}. This is a remediation plan, not the diagnostic.` } },
        ],
        icon: { type: "emoji", emoji: "⚠️" },
        color: "gray_background",
      },
    });

    // Create page in the configured Notion database
    const databaseId = process.env.NOTION_XRAY_DATABASE_ID;
    if (!databaseId) {
      return NextResponse.json(
        { error: "Notion database not configured. Set NOTION_XRAY_DATABASE_ID." },
        { status: 503 }
      );
    }

    // Look up the database to get the title property name
    let titlePropertyName = "Name"; // sensible default
    try {
      const dbInfo = await notion.databases.retrieve({ database_id: databaseId });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const props = (dbInfo as any).properties || {};
      for (const [key, val] of Object.entries(props)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((val as any).type === "title") {
          titlePropertyName = key;
          break;
        }
      }
    } catch {
      // If we can't retrieve DB info, fall through with default
    }

    // Create the page
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        [titlePropertyName]: {
          title: [{ text: { content: plan.title } }],
        },
      },
      children: children.slice(0, 100), // Notion max 100 blocks per create
      icon: { type: "emoji", emoji: "🔧" },
    });

    const pageId = (response as { id: string }).id;

    // Append remaining blocks if > 100
    for (let i = 100; i < children.length; i += 100) {
      try {
        await notion.blocks.children.append({
          block_id: pageId,
          children: children.slice(i, i + 100),
        });
      } catch (appendError) {
        console.error(`[Notion] Failed to append blocks ${i}-${i + 100}:`, appendError);
        // Page was created — return partial success
        return NextResponse.json({
          success: true,
          partial: true,
          notionUrl: `https://notion.so/${pageId.replace(/-/g, "")}`,
          pageId,
          warning: "Page created but some content blocks failed to sync.",
        });
      }
    }

    return NextResponse.json({
      success: true,
      notionUrl: `https://notion.so/${pageId.replace(/-/g, "")}`,
      pageId,
    });
  } catch (error) {
    console.error("Remediation Notion sync error:", error);

    const notionError = error as { code?: string; status?: number };
    if (notionError.code === "object_not_found" || notionError.status === 404) {
      return NextResponse.json(
        { error: "Notion page not found. The parent X-Ray page may have been deleted." },
        { status: 404 }
      );
    }
    if (notionError.status === 401) {
      return NextResponse.json(
        { error: "Notion connection expired. Ask your admin to reconnect." },
        { status: 401 }
      );
    }
    if (notionError.status === 403) {
      return NextResponse.json(
        { error: "The integration doesn't have access to this Notion page." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Failed to sync remediation plan to Notion." },
      { status: 500 }
    );
  }
}
