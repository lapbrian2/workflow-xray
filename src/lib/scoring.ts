import type { Step, Gap, HealthMetrics } from "./types";
import { getThresholds } from "./team-calibration";

export function computeHealth(
  steps: Step[],
  gaps: Gap[],
  teamSize?: number
): HealthMetrics {
  const thresholds = getThresholds(teamSize);

  // Complexity: based on number of steps, dependencies, and layer variety
  const stepCount = steps.length;
  const depCount = steps.reduce((sum, s) => sum + s.dependencies.length, 0);
  const uniqueLayers = new Set(steps.map((s) => s.layer)).size;
  const complexity = Math.min(
    100,
    Math.round(stepCount * 6 + depCount * 3 + uniqueLayers * 5)
  );

  // Fragility: based on single dependencies, bottlenecks, and low automation
  // Apply team-tier multiplier (1.0 for medium = no change = backward compatible)
  const highSeverityGaps = gaps.filter((g) => g.severity === "high").length;
  const mediumSeverityGaps = gaps.filter((g) => g.severity === "medium").length;
  const singleDepGaps = gaps.filter(
    (g) => g.type === "single_dependency"
  ).length;
  const lowAutoSteps = steps.filter((s) => s.automationScore < 30).length;
  const rawFragility =
    highSeverityGaps * 20 +
    mediumSeverityGaps * 10 +
    singleDepGaps * 15 +
    lowAutoSteps * 5;
  const fragility = Math.min(
    100,
    Math.round(rawFragility * thresholds.fragilityMultiplier)
  );

  // Automation potential: average automation score
  const avgAutomation =
    steps.length > 0
      ? Math.round(
          steps.reduce((sum, s) => sum + s.automationScore, 0) / steps.length
        )
      : 0;

  // Team load balance: how evenly distributed owners are
  // Uses team-tier baseline instead of hardcoded values
  const owners = steps.map((s) => s.owner).filter(Boolean) as string[];
  let teamLoadBalance: number;
  if (owners.length === 0) {
    // No ownership assigned — use team-tier baseline
    teamLoadBalance = thresholds.loadBalanceBaseline;
  } else {
    const ownerCounts: Record<string, number> = {};
    owners.forEach((o) => {
      ownerCounts[o] = (ownerCounts[o] || 0) + 1;
    });
    const counts = Object.values(ownerCounts);
    const uniqueOwners = counts.length;

    if (uniqueOwners === 1) {
      // Single owner for all steps — worst balance, capped at tier baseline
      teamLoadBalance = Math.min(
        thresholds.loadBalanceBaseline,
        Math.round(100 / owners.length)
      );
    } else {
      const max = Math.max(...counts);
      const min = Math.min(...counts);
      const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
      // Perfect balance = 100, completely imbalanced = low score
      teamLoadBalance = Math.round(100 - ((max - min) / avg) * 25);
      teamLoadBalance = Math.max(0, Math.min(100, teamLoadBalance));
    }
  }

  return {
    complexity,
    fragility,
    automationPotential: avgAutomation,
    teamLoadBalance,
    ...(teamSize !== undefined ? { teamSize } : {}),
    confidence: teamSize !== undefined
      ? { level: "high" as const, reason: "Team size was explicitly provided" }
      : { level: "inferred" as const, reason: "No team size specified; using medium-team defaults" },
  };
}
