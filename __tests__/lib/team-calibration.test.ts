import { describe, it, expect } from "vitest";
import { getTeamTier, getThresholds, THRESHOLDS } from "@/lib/team-calibration";

describe("getTeamTier", () => {
  it("returns 'solo' for teamSize 1", () => {
    expect(getTeamTier(1)).toBe("solo");
  });

  it("returns 'solo' for teamSize 0 (edge: zero/negative)", () => {
    expect(getTeamTier(0)).toBe("solo");
  });

  it("returns 'small' for teamSize 3", () => {
    expect(getTeamTier(3)).toBe("small");
  });

  it("returns 'small' for teamSize 5 (boundary)", () => {
    expect(getTeamTier(5)).toBe("small");
  });

  it("returns 'medium' for teamSize 6 (boundary)", () => {
    expect(getTeamTier(6)).toBe("medium");
  });

  it("returns 'medium' for teamSize 20 (boundary)", () => {
    expect(getTeamTier(20)).toBe("medium");
  });

  it("returns 'large' for teamSize 21 (boundary)", () => {
    expect(getTeamTier(21)).toBe("large");
  });

  it("returns 'large' for teamSize 100", () => {
    expect(getTeamTier(100)).toBe("large");
  });
});

describe("getThresholds", () => {
  it("returns medium thresholds for undefined teamSize", () => {
    const result = getThresholds(undefined);
    expect(result).toEqual(THRESHOLDS.medium);
    expect(result.fragilityMultiplier).toBe(1.0);
    expect(result.bottleneckMultiplier).toBe(1.0);
    expect(result.loadBalanceBaseline).toBe(60);
  });

  it("returns medium thresholds for null teamSize", () => {
    const result = getThresholds(null);
    expect(result).toEqual(THRESHOLDS.medium);
  });

  it("returns solo thresholds for teamSize 1", () => {
    const result = getThresholds(1);
    expect(result).toEqual(THRESHOLDS.solo);
    expect(result.fragilityMultiplier).toBe(1.8);
    expect(result.bottleneckMultiplier).toBe(1.5);
    expect(result.loadBalanceBaseline).toBe(30);
  });

  it("returns medium thresholds for teamSize 10", () => {
    const result = getThresholds(10);
    expect(result).toEqual(THRESHOLDS.medium);
    expect(result.fragilityMultiplier).toBe(1.0);
  });

  it("returns large thresholds for teamSize 50", () => {
    const result = getThresholds(50);
    expect(result).toEqual(THRESHOLDS.large);
    expect(result.fragilityMultiplier).toBe(0.8);
    expect(result.bottleneckMultiplier).toBe(0.8);
    expect(result.loadBalanceBaseline).toBe(70);
  });
});
