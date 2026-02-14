import type { Step, Gap, HealthMetrics } from "./types";

export function computeHealth(steps: Step[], gaps: Gap[]): HealthMetrics {
  // Complexity: based on number of steps, dependencies, and layer variety
  const stepCount = steps.length;
  const depCount = steps.reduce((sum, s) => sum + s.dependencies.length, 0);
  const uniqueLayers = new Set(steps.map((s) => s.layer)).size;
  const complexity = Math.min(
    100,
    Math.round(stepCount * 6 + depCount * 3 + uniqueLayers * 5)
  );

  // Fragility: based on single dependencies, bottlenecks, and low automation
  const highSeverityGaps = gaps.filter((g) => g.severity === "high").length;
  const mediumSeverityGaps = gaps.filter((g) => g.severity === "medium").length;
  const singleDepGaps = gaps.filter(
    (g) => g.type === "single_dependency"
  ).length;
  const lowAutoSteps = steps.filter((s) => s.automationScore < 30).length;
  const fragility = Math.min(
    100,
    Math.round(
      highSeverityGaps * 20 +
        mediumSeverityGaps * 10 +
        singleDepGaps * 15 +
        lowAutoSteps * 5
    )
  );

  // Automation potential: average automation score
  const avgAutomation =
    steps.length > 0
      ? Math.round(
          steps.reduce((sum, s) => sum + s.automationScore, 0) / steps.length
        )
      : 0;

  // Team load balance: how evenly distributed owners are
  const owners = steps.map((s) => s.owner).filter(Boolean) as string[];
  let teamLoadBalance = 100;
  if (owners.length > 0) {
    const ownerCounts: Record<string, number> = {};
    owners.forEach((o) => {
      ownerCounts[o] = (ownerCounts[o] || 0) + 1;
    });
    const counts = Object.values(ownerCounts);
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    // Perfect balance = 100, completely imbalanced = low score
    if (avg > 0) {
      teamLoadBalance = Math.round(100 - ((max - min) / avg) * 25);
      teamLoadBalance = Math.max(0, Math.min(100, teamLoadBalance));
    }
  }

  return {
    complexity,
    fragility,
    automationPotential: avgAutomation,
    teamLoadBalance,
  };
}
