import { listWorkflows } from "./db";
import type { Workflow, GapType } from "./types";
import { GAP_LABELS } from "./types";

export interface OrgContext {
  workflowCount: number;
  avgAutomation: number;
  topGapType: { type: string; label: string; count: number } | null;
  topOwners: { name: string; stepCount: number }[];
  avgFragility: number;
  similarWorkflows: string[];
}

/**
 * Build organizational context from the saved workflow library.
 * This gets injected into Claude's prompt for richer, pattern-aware analysis.
 */
export async function buildOrgContext(
  currentDescription?: string
): Promise<OrgContext | null> {
  let workflows: Workflow[];
  try {
    workflows = await listWorkflows();
  } catch {
    return null;
  }

  if (workflows.length === 0) return null;

  // Average automation score
  const avgAutomation = Math.round(
    workflows.reduce(
      (sum, w) => sum + w.decomposition.health.automationPotential,
      0
    ) / workflows.length
  );

  // Average fragility
  const avgFragility = Math.round(
    workflows.reduce(
      (sum, w) => sum + w.decomposition.health.fragility,
      0
    ) / workflows.length
  );

  // Most common gap type
  const gapCounts: Record<string, number> = {};
  workflows.forEach((w) =>
    w.decomposition.gaps.forEach((g) => {
      gapCounts[g.type] = (gapCounts[g.type] || 0) + 1;
    })
  );
  const topGapEntry = Object.entries(gapCounts).sort(
    (a, b) => b[1] - a[1]
  )[0];
  const topGapType = topGapEntry
    ? {
        type: topGapEntry[0],
        label: GAP_LABELS[topGapEntry[0] as GapType] || topGapEntry[0],
        count: topGapEntry[1],
      }
    : null;

  // Most common owners
  const ownerCounts: Record<string, number> = {};
  workflows.forEach((w) =>
    w.decomposition.steps.forEach((s) => {
      if (s.owner) ownerCounts[s.owner] = (ownerCounts[s.owner] || 0) + 1;
    })
  );
  const topOwners = Object.entries(ownerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, stepCount]) => ({ name, stepCount }));

  // Find similar workflows by keyword overlap
  let similarWorkflows: string[] = [];
  if (currentDescription) {
    const keywords = currentDescription
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4);
    if (keywords.length > 0) {
      similarWorkflows = workflows
        .filter((w) => {
          const desc = w.description.toLowerCase();
          const matchCount = keywords.filter((k) => desc.includes(k)).length;
          return matchCount >= Math.min(3, keywords.length * 0.3);
        })
        .map((w) => w.decomposition.title)
        .slice(0, 3);
    }
  }

  return {
    workflowCount: workflows.length,
    avgAutomation,
    avgFragility,
    topGapType,
    topOwners,
    similarWorkflows,
  };
}

/**
 * Format OrgContext into a prompt section for Claude.
 */
export function formatOrgContextForPrompt(ctx: OrgContext): string {
  const lines: string[] = [
    `\n## Organizational Context`,
    `This team has analyzed ${ctx.workflowCount} workflow${ctx.workflowCount !== 1 ? "s" : ""} previously.`,
    `\nRecurring patterns detected:`,
  ];

  if (ctx.topOwners.length > 0) {
    ctx.topOwners.forEach((o) => {
      lines.push(
        `- ${o.name} appears as owner in ${o.stepCount} steps across saved workflows`
      );
    });
  }

  if (ctx.topGapType) {
    lines.push(
      `- Most common gap type: ${ctx.topGapType.label} (${ctx.topGapType.count} occurrences)`
    );
  }

  lines.push(
    `- Average automation across all workflows: ${ctx.avgAutomation}%`
  );
  lines.push(`- Average fragility across all workflows: ${ctx.avgFragility}%`);

  if (ctx.similarWorkflows.length > 0) {
    lines.push(
      `- Flagged workflows with similar structure: ${ctx.similarWorkflows.join(", ")}`
    );
  }

  lines.push(
    `\nUse this context to enrich your analysis. Flag when this workflow shares patterns with previous ones.`
  );

  return lines.join("\n");
}
