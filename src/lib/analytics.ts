import type { Workflow, GapType, Severity } from "@/lib/types";
import { GAP_LABELS } from "@/lib/types";

// ─── Cost Constants ───
const COST_PER_MTOK_INPUT = 3.0; // $/MTok for Claude Sonnet
const COST_PER_MTOK_OUTPUT = 15.0; // $/MTok for Claude Sonnet

// ─── Exported Types ───

export interface VersionTrajectoryPoint {
  version: number;
  label: string;
  createdAt: string;
  complexity: number;
  fragility: number;
  automationPotential: number;
  teamLoadBalance: number;
  overallHealth: number;
}

export interface WeeklyTrendPoint {
  date: string;
  label: string;
  count: number;
  avgComplexity: number;
  avgFragility: number;
  avgAutomation: number;
  avgTeamBalance: number;
  avgOverallHealth: number;
}

export interface BatchTrendData {
  weeklyTrends: WeeklyTrendPoint[];
  versionedWorkflowCount: number;
  averageHealthImprovement: number;
  totalWorkflows: number;
}

export interface CostAnalyticsData {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  totalAnalyses: number;
  cacheHits: number;
  cacheMisses: number;
  estimatedSavings: number;
  costPerAnalysis: number;
}

export interface GapPatternData {
  type: GapType;
  label: string;
  total: number;
  severities: { high: number; medium: number; low: number };
  workflowsAffected: number;
  percentAffected: number;
  impactedRoles: string[];
}

// ─── 1. Version Trajectory ───

/**
 * Computes chronologically ordered health scores for a single workflow's
 * version chain. Walks parentId links to find the root, then collects
 * all descendants sharing that root.
 */
export function computeVersionTrajectory(
  workflows: Workflow[],
  workflowId: string
): VersionTrajectoryPoint[] {
  if (workflows.length === 0) return [];

  const byId = new Map<string, Workflow>();
  workflows.forEach((w) => byId.set(w.id, w));

  const target = byId.get(workflowId);
  if (!target) return [];

  // Walk parentId up to find the root
  let rootId = workflowId;
  let current = target;
  while (current.parentId && byId.has(current.parentId)) {
    rootId = current.parentId;
    current = byId.get(current.parentId)!;
  }

  // Collect all workflows in this version chain via BFS from root
  const chain: Workflow[] = [];
  const visited = new Set<string>();
  const queue = [rootId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const w = byId.get(id);
    if (!w) continue;
    chain.push(w);

    // Find children (workflows whose parentId === this id)
    for (const candidate of workflows) {
      if (candidate.parentId === id && !visited.has(candidate.id)) {
        queue.push(candidate.id);
      }
    }
  }

  // Sort by version (ascending), fallback to createdAt
  chain.sort((a, b) => {
    const va = a.version ?? 0;
    const vb = b.version ?? 0;
    if (va !== vb) return va - vb;
    return a.createdAt.localeCompare(b.createdAt);
  });

  return chain.map((w, i) => {
    const h = w.decomposition.health;
    const overallHealth = Math.round(
      (h.complexity + (100 - h.fragility) + h.automationPotential + h.teamLoadBalance) / 4
    );
    return {
      version: w.version ?? i + 1,
      label: `v${w.version ?? i + 1}`,
      createdAt: w.createdAt,
      complexity: h.complexity,
      fragility: h.fragility,
      automationPotential: h.automationPotential,
      teamLoadBalance: h.teamLoadBalance,
      overallHealth,
    };
  });
}

// ─── 2. Batch Trends ───

/**
 * Aggregates health metrics across ALL workflows to show library-wide trends.
 * Groups by ISO week and computes per-period averages. Also calculates
 * versioned workflow stats and average health improvement across chains.
 */
export function computeBatchTrends(workflows: Workflow[]): BatchTrendData {
  if (workflows.length === 0) {
    return {
      weeklyTrends: [],
      versionedWorkflowCount: 0,
      averageHealthImprovement: 0,
      totalWorkflows: 0,
    };
  }

  // Filter to valid workflows with health data
  const valid = workflows.filter(
    (w) =>
      w.decomposition &&
      w.decomposition.health &&
      typeof w.decomposition.health.complexity === "number"
  );

  // ── Weekly bucketing (same ISO week start as chart-data.ts) ──
  const buckets: Record<string, Workflow[]> = {};
  valid.forEach((w) => {
    const d = new Date(w.createdAt);
    const weekStart = new Date(d);
    const dayOfWeek = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - ((dayOfWeek + 6) % 7));
    const key = weekStart.toISOString().split("T")[0];
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(w);
  });

  const sorted = Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b));

  const weeklyTrends: WeeklyTrendPoint[] = sorted.map(([date, periodWorkflows]) => {
    const n = periodWorkflows.length;
    const sum = periodWorkflows.reduce(
      (acc, w) => ({
        complexity: acc.complexity + w.decomposition.health.complexity,
        fragility: acc.fragility + w.decomposition.health.fragility,
        automationPotential: acc.automationPotential + w.decomposition.health.automationPotential,
        teamLoadBalance: acc.teamLoadBalance + w.decomposition.health.teamLoadBalance,
      }),
      { complexity: 0, fragility: 0, automationPotential: 0, teamLoadBalance: 0 }
    );

    const avgComplexity = Math.round(sum.complexity / n);
    const avgFragility = Math.round(sum.fragility / n);
    const avgAutomation = Math.round(sum.automationPotential / n);
    const avgTeamBalance = Math.round(sum.teamLoadBalance / n);
    const avgOverallHealth = Math.round(
      (avgComplexity + (100 - avgFragility) + avgAutomation + avgTeamBalance) / 4
    );

    return {
      date,
      label: new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      count: n,
      avgComplexity,
      avgFragility,
      avgAutomation,
      avgTeamBalance,
      avgOverallHealth,
    };
  });

  // ── Versioned workflow stats ──
  const versionedWorkflowCount = valid.filter((w) => w.parentId).length;

  // ── Average health improvement across version chains ──
  // Find all root workflows (no parentId) that have children
  const byId = new Map<string, Workflow>();
  valid.forEach((w) => byId.set(w.id, w));

  const roots = new Set<string>();
  valid.forEach((w) => {
    if (w.parentId) {
      // Walk up to root
      let rootId = w.id;
      let cur = w;
      while (cur.parentId && byId.has(cur.parentId)) {
        rootId = cur.parentId;
        cur = byId.get(cur.parentId)!;
      }
      roots.add(rootId);
    }
  });

  let totalDelta = 0;
  let chainCount = 0;

  roots.forEach((rootId) => {
    // Collect chain
    const chain: Workflow[] = [];
    const visited = new Set<string>();
    const queue = [rootId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const w = byId.get(id);
      if (!w) continue;
      chain.push(w);
      for (const candidate of valid) {
        if (candidate.parentId === id && !visited.has(candidate.id)) {
          queue.push(candidate.id);
        }
      }
    }

    if (chain.length < 2) return;

    // Sort by version
    chain.sort((a, b) => {
      const va = a.version ?? 0;
      const vb = b.version ?? 0;
      if (va !== vb) return va - vb;
      return a.createdAt.localeCompare(b.createdAt);
    });

    const healthOf = (w: Workflow) => {
      const h = w.decomposition.health;
      return Math.round(
        (h.complexity + (100 - h.fragility) + h.automationPotential + h.teamLoadBalance) / 4
      );
    };

    const first = healthOf(chain[0]);
    const last = healthOf(chain[chain.length - 1]);
    totalDelta += last - first;
    chainCount++;
  });

  const averageHealthImprovement = chainCount > 0 ? Math.round(totalDelta / chainCount) : 0;

  return {
    weeklyTrends,
    versionedWorkflowCount,
    averageHealthImprovement,
    totalWorkflows: workflows.length,
  };
}

// ─── 3. Cost Analytics ───

/**
 * Sums token usage and computes estimated costs across all workflows.
 * Uses Claude Sonnet pricing constants for cost estimation.
 */
export function computeCostAnalytics(workflows: Workflow[]): CostAnalyticsData {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalAnalyses = 0;
  let cacheHits = 0;

  workflows.forEach((w) => {
    totalAnalyses++;

    if (w.cacheHit === true) {
      cacheHits++;
    }

    if (w.tokenUsage) {
      totalInputTokens += w.tokenUsage.inputTokens;
      totalOutputTokens += w.tokenUsage.outputTokens;
    }
  });

  const cacheMisses = totalAnalyses - cacheHits;

  const totalCost =
    (totalInputTokens / 1_000_000) * COST_PER_MTOK_INPUT +
    (totalOutputTokens / 1_000_000) * COST_PER_MTOK_OUTPUT;

  // Cost per non-cached analysis (to estimate savings)
  const costPerAnalysis = cacheMisses > 0 ? totalCost / cacheMisses : 0;
  const estimatedSavings = cacheHits * costPerAnalysis;

  return {
    totalInputTokens,
    totalOutputTokens,
    totalCost,
    totalAnalyses,
    cacheHits,
    cacheMisses,
    estimatedSavings,
    costPerAnalysis,
  };
}

// ─── 4. Gap Patterns ───

/**
 * Flattens all gaps across workflows, groups by type, and computes
 * severity breakdowns, affected workflow percentages, and impacted roles.
 */
export function computeGapPatterns(workflows: Workflow[]): GapPatternData[] {
  if (workflows.length === 0) return [];

  const typeMap = new Map<
    GapType,
    {
      total: number;
      severities: { high: number; medium: number; low: number };
      workflowIds: Set<string>;
      roles: Set<string>;
    }
  >();

  workflows.forEach((w) => {
    w.decomposition.gaps.forEach((gap) => {
      let entry = typeMap.get(gap.type);
      if (!entry) {
        entry = {
          total: 0,
          severities: { high: 0, medium: 0, low: 0 },
          workflowIds: new Set(),
          roles: new Set(),
        };
        typeMap.set(gap.type, entry);
      }

      entry.total++;
      entry.severities[gap.severity as Severity]++;
      entry.workflowIds.add(w.id);

      if (gap.impactedRoles) {
        gap.impactedRoles.forEach((role) => entry!.roles.add(role));
      }
    });
  });

  const totalWorkflows = workflows.length;

  const results: GapPatternData[] = [];
  typeMap.forEach((data, type) => {
    results.push({
      type,
      label: GAP_LABELS[type] || type,
      total: data.total,
      severities: { ...data.severities },
      workflowsAffected: data.workflowIds.size,
      percentAffected: Math.round((data.workflowIds.size / totalWorkflows) * 100),
      impactedRoles: Array.from(data.roles).sort(),
    });
  });

  // Sort by total count descending
  results.sort((a, b) => b.total - a.total);

  return results;
}
