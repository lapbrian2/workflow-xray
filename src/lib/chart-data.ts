import type { Workflow } from "@/lib/types";

export interface HealthTrendPoint {
  date: string; // ISO date (start of period)
  label: string; // Display label (e.g. "Jan 15")
  count: number; // Number of workflows in this period
  complexity: number; // Average complexity score (0-100)
  fragility: number; // Average fragility score (0-100)
  automationPotential: number; // Average automation potential (0-100)
  teamLoadBalance: number; // Average team load balance (0-100)
  overallHealth: number; // Composite health score (0-100)
}

/**
 * Derives health trend data from workflows by grouping them into time buckets
 * and computing per-period average health scores.
 *
 * Uses per-period averages (not cumulative) so that the chart shows actual
 * trends in workflow health over time.
 */
export function computeHealthTrends(
  workflows: Workflow[],
  granularity: "week" | "month" = "week"
): HealthTrendPoint[] {
  if (workflows.length === 0) return [];

  // Filter to only workflows with decomposition and health scores
  const valid = workflows.filter(
    (w) =>
      w.decomposition &&
      w.decomposition.health &&
      typeof w.decomposition.health.complexity === "number"
  );
  if (valid.length === 0) return [];

  // Group workflows by time period
  const buckets: Record<string, Workflow[]> = {};

  valid.forEach((w) => {
    const d = new Date(w.createdAt);
    let key: string;

    if (granularity === "week") {
      const weekStart = new Date(d);
      const dayOfWeek = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - ((dayOfWeek + 6) % 7));
      key = weekStart.toISOString().split("T")[0];
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    }

    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(w);
  });

  // Sort buckets chronologically and compute per-period averages
  const sorted = Object.entries(buckets).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return sorted.map(([date, periodWorkflows]) => {
    const n = periodWorkflows.length;
    const sum = periodWorkflows.reduce(
      (acc, w) => ({
        complexity: acc.complexity + w.decomposition.health.complexity,
        fragility: acc.fragility + w.decomposition.health.fragility,
        automationPotential:
          acc.automationPotential +
          w.decomposition.health.automationPotential,
        teamLoadBalance:
          acc.teamLoadBalance + w.decomposition.health.teamLoadBalance,
      }),
      {
        complexity: 0,
        fragility: 0,
        automationPotential: 0,
        teamLoadBalance: 0,
      }
    );

    const complexity = Math.round(sum.complexity / n);
    const fragility = Math.round(sum.fragility / n);
    const automationPotential = Math.round(sum.automationPotential / n);
    const teamLoadBalance = Math.round(sum.teamLoadBalance / n);
    const overallHealth = Math.round(
      (complexity + (100 - fragility) + automationPotential + teamLoadBalance) /
        4
    );

    return {
      date,
      label: new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      count: n,
      complexity,
      fragility,
      automationPotential,
      teamLoadBalance,
      overallHealth,
    };
  });
}
