// Team-size-aware calibration: tier classification and threshold multipliers
// Smaller teams feel fragility and bottlenecks more acutely; larger teams
// need higher load-balance baselines to stay effective.

export type TeamTier = "solo" | "small" | "medium" | "large";

export interface TeamThresholds {
  /** Amplifies fragility score for smaller teams (>1 = harsher, <1 = lenient) */
  fragilityMultiplier: number;
  /** Amplifies bottleneck impact for smaller teams */
  bottleneckMultiplier: number;
  /** Adjusts expected load-balance baseline (higher = stricter balance expectation) */
  loadBalanceBaseline: number;
}

/**
 * Classify a numeric team size into a tier.
 *
 * - solo: 1 person (or fewer — defensive)
 * - small: 2-5 people
 * - medium: 6-20 people
 * - large: 21+ people
 */
export function getTeamTier(teamSize: number): TeamTier {
  if (teamSize <= 1) return "solo";
  if (teamSize <= 5) return "small";
  if (teamSize <= 20) return "medium";
  return "large";
}

/**
 * Threshold multipliers per team tier.
 *
 * Medium tier uses 1.0 multipliers — the neutral baseline.
 * This means passing no teamSize (which defaults to medium)
 * produces identical scores to the original formula.
 */
export const THRESHOLDS: Record<TeamTier, TeamThresholds> = {
  solo: { fragilityMultiplier: 1.8, bottleneckMultiplier: 1.5, loadBalanceBaseline: 30 },
  small: { fragilityMultiplier: 1.4, bottleneckMultiplier: 1.3, loadBalanceBaseline: 50 },
  medium: { fragilityMultiplier: 1.0, bottleneckMultiplier: 1.0, loadBalanceBaseline: 60 },
  large: { fragilityMultiplier: 0.8, bottleneckMultiplier: 0.8, loadBalanceBaseline: 70 },
};

/**
 * Get the threshold multipliers for a given team size.
 *
 * If teamSize is undefined or null, returns medium-team defaults
 * (multiplier 1.0), ensuring backward compatibility.
 */
export function getThresholds(teamSize?: number | null): TeamThresholds {
  if (teamSize === undefined || teamSize === null) {
    return THRESHOLDS.medium;
  }
  return THRESHOLDS[getTeamTier(teamSize)];
}
