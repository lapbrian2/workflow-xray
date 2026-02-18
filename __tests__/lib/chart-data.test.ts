import { describe, it, expect } from "vitest";
import { computeHealthTrends } from "@/lib/chart-data";
import type { Workflow } from "@/lib/types";
import { makeWorkflow, MOCK_WORKFLOWS } from "../mocks/fixtures";

describe("computeHealthTrends", () => {
  it("returns empty array for empty input", () => {
    expect(computeHealthTrends([])).toEqual([]);
  });

  it("returns empty array when no workflows have valid decomposition/health", () => {
    const workflows = [
      // Workflow with no decomposition health values
      {
        id: "wf_bad",
        description: "No health",
        decomposition: {
          id: "d_bad",
          title: "Bad",
          steps: [],
          gaps: [],
          health: {} as never,
        },
        createdAt: "2026-01-10T10:00:00Z",
        updatedAt: "2026-01-10T10:00:00Z",
      } as Workflow,
    ];
    expect(computeHealthTrends(workflows)).toEqual([]);
  });

  it("returns one trend point for a single workflow", () => {
    const workflow = makeWorkflow({
      id: "wf_single",
      createdAt: "2026-01-15T10:00:00Z", // Thursday
      updatedAt: "2026-01-15T10:00:00Z",
      decomposition: {
        id: "d_single",
        title: "Single",
        steps: [],
        gaps: [],
        health: {
          complexity: 60,
          fragility: 30,
          automationPotential: 70,
          teamLoadBalance: 80,
        },
      },
    });

    const result = computeHealthTrends([workflow]);

    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(1);
    expect(result[0].complexity).toBe(60);
    expect(result[0].fragility).toBe(30);
    expect(result[0].automationPotential).toBe(70);
    expect(result[0].teamLoadBalance).toBe(80);

    // overallHealth = round((60 + (100-30) + 70 + 80) / 4) = round((60+70+70+80)/4) = round(280/4) = 70
    expect(result[0].overallHealth).toBe(70);
  });

  it("averages health scores for two workflows in the same week", () => {
    // Both in the same Monday-start week (Jan 5, 2026 is a Monday)
    const wfA = makeWorkflow({
      id: "wf_a",
      createdAt: "2026-01-06T10:00:00Z", // Tuesday
      decomposition: {
        id: "da",
        title: "A",
        steps: [],
        gaps: [],
        health: {
          complexity: 60,
          fragility: 40,
          automationPotential: 80,
          teamLoadBalance: 70,
        },
      },
    });

    const wfB = makeWorkflow({
      id: "wf_b",
      createdAt: "2026-01-08T14:00:00Z", // Thursday, same week
      decomposition: {
        id: "db",
        title: "B",
        steps: [],
        gaps: [],
        health: {
          complexity: 80,
          fragility: 20,
          automationPotential: 60,
          teamLoadBalance: 90,
        },
      },
    });

    const result = computeHealthTrends([wfA, wfB]);

    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
    // Averaged: complexity=(60+80)/2=70, fragility=(40+20)/2=30
    expect(result[0].complexity).toBe(70);
    expect(result[0].fragility).toBe(30);
    // automationPotential=(80+60)/2=70, teamLoadBalance=(70+90)/2=80
    expect(result[0].automationPotential).toBe(70);
    expect(result[0].teamLoadBalance).toBe(80);
  });

  it("groups multi-week data into chronological trend points", () => {
    // MOCK_WORKFLOWS: 4 workflows across 3 weeks (2 in week 1)
    const result = computeHealthTrends(MOCK_WORKFLOWS);

    expect(result).toHaveLength(3);

    // Week 1: 2 workflows (wf_week1_a + wf_week1_b)
    expect(result[0].count).toBe(2);
    // Week 2: 1 workflow
    expect(result[1].count).toBe(1);
    // Week 3: 1 workflow
    expect(result[2].count).toBe(1);

    // Verify chronological order
    expect(result[0].date < result[1].date).toBe(true);
    expect(result[1].date < result[2].date).toBe(true);

    // Week 1 averages: complexity=(40+60)/2=50, fragility=(30+50)/2=40
    expect(result[0].complexity).toBe(50);
    expect(result[0].fragility).toBe(40);
  });

  it("groups by month when granularity is 'month'", () => {
    // Create workflows in Jan and Feb
    const workflows = [
      makeWorkflow({
        id: "wf_jan",
        createdAt: "2026-01-15T10:00:00Z",
        decomposition: {
          id: "dj",
          title: "January",
          steps: [],
          gaps: [],
          health: { complexity: 40, fragility: 30, automationPotential: 50, teamLoadBalance: 60 },
        },
      }),
      makeWorkflow({
        id: "wf_jan2",
        createdAt: "2026-01-25T10:00:00Z",
        decomposition: {
          id: "dj2",
          title: "January 2",
          steps: [],
          gaps: [],
          health: { complexity: 60, fragility: 40, automationPotential: 70, teamLoadBalance: 80 },
        },
      }),
      makeWorkflow({
        id: "wf_feb",
        createdAt: "2026-02-10T10:00:00Z",
        decomposition: {
          id: "df",
          title: "February",
          steps: [],
          gaps: [],
          health: { complexity: 80, fragility: 20, automationPotential: 90, teamLoadBalance: 50 },
        },
      }),
    ];

    const result = computeHealthTrends(workflows, "month");

    expect(result).toHaveLength(2);
    // January bucket: 2 workflows
    expect(result[0].count).toBe(2);
    expect(result[0].date).toBe("2026-01-01");
    // February bucket: 1 workflow
    expect(result[1].count).toBe(1);
    expect(result[1].date).toBe("2026-02-01");
  });

  it("computes overallHealth correctly using the formula", () => {
    const workflow = makeWorkflow({
      id: "wf_formula",
      createdAt: "2026-01-06T10:00:00Z",
      decomposition: {
        id: "df",
        title: "Formula Test",
        steps: [],
        gaps: [],
        health: {
          complexity: 50,
          fragility: 60,
          automationPotential: 70,
          teamLoadBalance: 80,
        },
      },
    });

    const result = computeHealthTrends([workflow]);

    // overallHealth = round((complexity + (100 - fragility) + automationPotential + teamLoadBalance) / 4)
    // = round((50 + 40 + 70 + 80) / 4) = round(240 / 4) = 60
    expect(result[0].overallHealth).toBe(60);
  });

  it("generates date labels in 'Mon Day' format", () => {
    const workflow = makeWorkflow({
      id: "wf_label",
      createdAt: "2026-01-15T10:00:00Z",
      decomposition: {
        id: "dl",
        title: "Label Test",
        steps: [],
        gaps: [],
        health: { complexity: 50, fragility: 50, automationPotential: 50, teamLoadBalance: 50 },
      },
    });

    const result = computeHealthTrends([workflow]);

    // The label is generated from the week-start date using toLocaleDateString
    // We verify it has a month abbreviation and day number
    expect(result[0].label).toMatch(/[A-Z][a-z]{2}\s+\d{1,2}/);
  });

  it("groups a Wednesday workflow into the preceding Monday week bucket", () => {
    // Jan 7, 2026 is a Wednesday. The preceding Monday is Jan 5.
    const workflow = makeWorkflow({
      id: "wf_wed",
      createdAt: "2026-01-07T10:00:00Z", // Wednesday
      decomposition: {
        id: "dw",
        title: "Wednesday",
        steps: [],
        gaps: [],
        health: { complexity: 50, fragility: 50, automationPotential: 50, teamLoadBalance: 50 },
      },
    });

    const result = computeHealthTrends([workflow]);

    // The date key should be the preceding Monday: 2026-01-05
    expect(result[0].date).toBe("2026-01-05");
  });
});
