import { describe, it, expect } from "vitest";
import { computeHealth } from "@/lib/scoring";
import type { Step, Gap } from "@/lib/types";
import { makeStep, makeGap, MOCK_STEPS, MOCK_GAPS } from "../mocks/fixtures";

describe("computeHealth", () => {
  it("returns all zeroes/defaults for empty inputs", () => {
    const result = computeHealth([], []);
    expect(result.complexity).toBe(0);
    expect(result.fragility).toBe(0);
    expect(result.automationPotential).toBe(0);
    // No owners + no teamSize => medium baseline = 60
    expect(result.teamLoadBalance).toBe(60);
  });

  it("computes correct values for basic step/gap inputs", () => {
    // 3 steps: depCount = 1 (step_b depends on step_a), uniqueLayers = 2 (human, cell)
    const steps: Step[] = [
      makeStep({ id: "a", layer: "human", automationScore: 40, dependencies: [], owner: "Alice" }),
      makeStep({ id: "b", layer: "cell", automationScore: 80, dependencies: ["a"], owner: "Bob" }),
      makeStep({ id: "c", layer: "human", automationScore: 60, dependencies: [], owner: "Charlie" }),
    ];
    // 2 gaps: 1 high, 1 medium; 1 single_dependency
    const gaps: Gap[] = [
      makeGap({ type: "bottleneck", severity: "high", stepIds: ["a"] }),
      makeGap({ type: "single_dependency", severity: "medium", stepIds: ["b"] }),
    ];

    const result = computeHealth(steps, gaps);

    // Complexity = min(100, 3*6 + 1*3 + 2*5) = min(100, 18+3+10) = 31
    expect(result.complexity).toBe(31);

    // Fragility (medium tier, multiplier=1.0):
    //   highGaps=1 => 20
    //   medGaps=1 => 10
    //   singleDepGaps=1 => 15
    //   lowAutoSteps (automationScore < 30) = 0 => 0
    //   rawFragility = 20 + 10 + 15 + 0 = 45
    //   fragility = min(100, round(45 * 1.0)) = 45
    expect(result.fragility).toBe(45);

    // Automation potential = avg(40, 80, 60) = 60
    expect(result.automationPotential).toBe(60);
  });

  it("applies solo team size calibration (teamSize=1)", () => {
    const steps: Step[] = [
      makeStep({ id: "a", automationScore: 40, dependencies: [], owner: "Solo" }),
      makeStep({ id: "b", automationScore: 80, dependencies: ["a"], owner: "Solo" }),
    ];
    const gaps: Gap[] = [
      makeGap({ type: "bottleneck", severity: "high", stepIds: ["a"] }),
    ];

    const result = computeHealth(steps, gaps, 1);

    // solo fragilityMultiplier = 1.8
    // highGaps=1 => 20, medGaps=0, singleDep=0
    // lowAutoSteps: automationScore < 30 => 0 (40, 80 both >= 30)
    // rawFragility = 20
    // fragility = min(100, round(20 * 1.8)) = 36
    expect(result.fragility).toBe(36);

    // Confidence should be high when teamSize is provided
    expect(result.confidence).toEqual({
      level: "high",
      reason: "Team size was explicitly provided",
    });

    // teamSize should be in result
    expect(result.teamSize).toBe(1);
  });

  it("applies large team size calibration (teamSize=25)", () => {
    const steps: Step[] = [
      makeStep({ id: "a", automationScore: 40, dependencies: [], owner: "Alice" }),
      makeStep({ id: "b", automationScore: 80, dependencies: ["a"], owner: "Bob" }),
    ];
    const gaps: Gap[] = [
      makeGap({ type: "bottleneck", severity: "high", stepIds: ["a"] }),
    ];

    const result = computeHealth(steps, gaps, 25);

    // large fragilityMultiplier = 0.8
    // rawFragility = 20
    // fragility = min(100, round(20 * 0.8)) = 16
    expect(result.fragility).toBe(16);

    // large loadBalanceBaseline = 70
    // Two steps, two different owners, perfectly balanced
    // counts = [1, 1], max=1, min=1, avg=1
    // teamLoadBalance = round(100 - ((1-1)/1)*25) = 100
    expect(result.teamLoadBalance).toBe(100);
  });

  it("returns inferred confidence when no teamSize provided", () => {
    const result = computeHealth(MOCK_STEPS, MOCK_GAPS);

    expect(result.confidence).toEqual({
      level: "inferred",
      reason: "No team size specified; using medium-team defaults",
    });
    expect(result.teamSize).toBeUndefined();
  });

  it("computes low teamLoadBalance when single owner has all steps", () => {
    const steps: Step[] = [
      makeStep({ id: "a", owner: "Solo", automationScore: 50, dependencies: [] }),
      makeStep({ id: "b", owner: "Solo", automationScore: 50, dependencies: [] }),
      makeStep({ id: "c", owner: "Solo", automationScore: 50, dependencies: [] }),
      makeStep({ id: "d", owner: "Solo", automationScore: 50, dependencies: [] }),
    ];

    const result = computeHealth(steps, []);

    // Single owner, 4 steps. uniqueOwners=1
    // teamLoadBalance = min(loadBalanceBaseline=60, round(100/4)) = min(60, 25) = 25
    expect(result.teamLoadBalance).toBe(25);
  });

  it("computes high teamLoadBalance when steps are evenly distributed", () => {
    const steps: Step[] = [
      makeStep({ id: "a", owner: "Alice", automationScore: 50, dependencies: [] }),
      makeStep({ id: "b", owner: "Bob", automationScore: 50, dependencies: [] }),
      makeStep({ id: "c", owner: "Charlie", automationScore: 50, dependencies: [] }),
    ];

    const result = computeHealth(steps, []);

    // 3 owners with 1 step each: counts=[1,1,1], max=1, min=1, avg=1
    // teamLoadBalance = round(100 - ((1-1)/1)*25) = 100
    expect(result.teamLoadBalance).toBe(100);
  });

  it("clamps all scores to 0-100 range for extreme inputs", () => {
    // Many steps with many dependencies and gaps to push scores high
    const steps: Step[] = Array.from({ length: 20 }, (_, i) =>
      makeStep({
        id: `step_${i}`,
        layer: (["human", "cell", "orchestration", "memory", "integration"] as const)[i % 5],
        automationScore: 10, // low => all count as lowAutoSteps
        dependencies: i > 0 ? [`step_${i - 1}`] : [],
        owner: "Same",
      })
    );

    const gaps: Gap[] = Array.from({ length: 10 }, (_, i) =>
      makeGap({
        type: "bottleneck",
        severity: "high",
        stepIds: [`step_${i}`],
      })
    );

    const result = computeHealth(steps, gaps);

    expect(result.complexity).toBeLessThanOrEqual(100);
    expect(result.complexity).toBeGreaterThanOrEqual(0);
    expect(result.fragility).toBeLessThanOrEqual(100);
    expect(result.fragility).toBeGreaterThanOrEqual(0);
    expect(result.automationPotential).toBeLessThanOrEqual(100);
    expect(result.automationPotential).toBeGreaterThanOrEqual(0);
    expect(result.teamLoadBalance).toBeLessThanOrEqual(100);
    expect(result.teamLoadBalance).toBeGreaterThanOrEqual(0);
  });

  it("uses MOCK_STEPS and MOCK_GAPS for integration-level scoring", () => {
    const result = computeHealth(MOCK_STEPS, MOCK_GAPS);

    // MOCK_STEPS: 4 steps, deps: [[], [step_1], [step_2], [step_3]] => depCount=3
    // uniqueLayers: human, cell, orchestration, integration => 4
    // complexity = min(100, 4*6 + 3*3 + 4*5) = min(100, 24+9+20) = 53
    expect(result.complexity).toBe(53);

    // highGaps=2, medGaps=1, singleDepGaps=1, lowAutoSteps=2 (scores 20,25)
    // rawFragility = 2*20 + 1*10 + 1*15 + 2*5 = 40+10+15+10 = 75
    // fragility = min(100, round(75 * 1.0)) = 75
    expect(result.fragility).toBe(75);

    // automationPotential = round((20+85+60+25)/4) = round(190/4) = round(47.5) = 48
    expect(result.automationPotential).toBe(48);
  });
});
