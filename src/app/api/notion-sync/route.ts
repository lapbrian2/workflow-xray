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

    // Build page content — a summary of the X-Ray results
    const stepsContent = steps
      .map(
        (s, i) =>
          `${i + 1}. **${s.name}** — ${s.description.slice(0, 100)}${s.description.length > 100 ? "..." : ""} (${s.automationScore}% automatable${s.owner ? `, owner: ${s.owner}` : ""})`
      )
      .join("\n");

    const gapsContent =
      gaps.length > 0
        ? gaps
            .map(
              (g) =>
                `- **${GAP_LABELS[g.type]}** (${g.severity}): ${g.description.slice(0, 100)}${g.description.length > 100 ? "..." : ""}`
            )
            .join("\n")
        : "No gaps detected.";

    const pageContent = `## Workflow Steps\n${stepsContent}\n\n## Gaps Identified\n${gapsContent}\n\n## Health Scores\n- Complexity: ${health.complexity}/100\n- Fragility: ${health.fragility}/100\n- Automation Potential: ${health.automationPotential}%\n- Team Load Balance: ${health.teamLoadBalance}/100\n\n---\n*Synced from Workflow X-Ray on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}*`;

    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: properties as Record<string, never>,
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: pageContent,
                },
              },
            ],
          },
        },
      ],
    });

    return NextResponse.json({
      success: true,
      notionUrl: `https://notion.so/${(response as { id: string }).id.replace(/-/g, "")}`,
      pageId: (response as { id: string }).id,
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
