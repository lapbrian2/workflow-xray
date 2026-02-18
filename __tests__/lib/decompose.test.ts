import { describe, it, expect, vi, beforeAll } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/server";
import { MOCK_DECOMPOSE_RESPONSE } from "../mocks/fixtures";

// Set env vars before any module imports:
// - ANTHROPIC_API_KEY: dummy key so SDK passes client-side header validation (MSW intercepts the actual request)
// - ALLOW_MEMORY_STORAGE: so listWorkflows (called by buildOrgContext) uses in-memory backend
beforeAll(() => {
  process.env.ANTHROPIC_API_KEY = "test-key-for-msw";
  process.env.ALLOW_MEMORY_STORAGE = "true";
});

// Helper to build a Claude API message response
function makeCloudeResponse(text: string) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-20250514",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

describe("decomposeWorkflow", () => {
  // Import lazily so env vars are set first
  let decomposeWorkflow: typeof import("@/lib/decompose").decomposeWorkflow;

  beforeAll(async () => {
    const mod = await import("@/lib/decompose");
    decomposeWorkflow = mod.decomposeWorkflow;
  });

  it("a. happy path - valid response returns full decomposition", async () => {
    // Default MSW handler returns MOCK_DECOMPOSE_RESPONSE wrapped in code fences
    const result = await decomposeWorkflow({ description: "Test workflow" });

    expect(result.id).toBeTypeOf("string");
    expect(result.title).toBe(MOCK_DECOMPOSE_RESPONSE.title);
    expect(result.steps).toHaveLength(MOCK_DECOMPOSE_RESPONSE.steps.length);
    expect(result.gaps).toHaveLength(MOCK_DECOMPOSE_RESPONSE.gaps.length);
    expect(result.health).toBeDefined();
    expect(result.health.complexity).toBeTypeOf("number");
    expect(result.health.fragility).toBeTypeOf("number");
    expect(result.health.automationPotential).toBeTypeOf("number");
    expect(result.health.teamLoadBalance).toBeTypeOf("number");
    expect(result._partial).toBe(false);
    expect(result._meta).toBeDefined();
    expect(result._meta.inputTokens).toBeTypeOf("number");
    expect(result._meta.outputTokens).toBeTypeOf("number");
  });

  it("b. partial recovery - malformed JSON with invalid layer", async () => {
    const malformedResponse = {
      title: "Malformed Workflow",
      steps: [
        {
          id: "step_1",
          name: "Step One",
          description: "A step",
          owner: "Engineer",
          layer: "unknown_layer", // invalid layer
          inputs: ["a"],
          outputs: ["b"],
          tools: ["t"],
          automationScore: 50,
          dependencies: [],
        },
      ],
      gaps: [
        {
          type: "bottleneck",
          severity: "high",
          stepIds: ["step_1"],
          // missing 'description' field -- will be recovered with ""
          suggestion: "Fix it",
        },
      ],
    };

    server.use(
      http.post("https://api.anthropic.com/v1/messages", () => {
        return HttpResponse.json(
          makeCloudeResponse(
            "```json\n" + JSON.stringify(malformedResponse) + "\n```"
          )
        );
      })
    );

    const result = await decomposeWorkflow({ description: "Test workflow" });

    expect(result._partial).toBe(true);
    expect(result._recoveryReason).toBeTypeOf("string");
    expect(result._recoveryReason!.length).toBeGreaterThan(0);
    // Invalid layer should be recovered to default "human"
    expect(result.steps[0].layer).toBe("human");
    // Health should still be computed
    expect(result.health).toBeDefined();
    expect(result.health.complexity).toBeTypeOf("number");
  });

  it("c. total failure - no JSON in response", async () => {
    server.use(
      http.post("https://api.anthropic.com/v1/messages", () => {
        return HttpResponse.json(
          makeCloudeResponse(
            "I cannot analyze this workflow. Please provide more detail."
          )
        );
      })
    );

    const result = await decomposeWorkflow({ description: "Test workflow" });

    expect(result._partial).toBe(true);
    expect(result._recoveryReason).toContain("Could not extract");
    expect(result.steps).toHaveLength(0);
    expect(result.gaps).toHaveLength(0);
  });

  it("d. referential integrity - duplicate step IDs", async () => {
    const responseWithDuplicates = {
      title: "Duplicate Steps",
      steps: [
        {
          id: "step_1",
          name: "First",
          description: "First occurrence",
          owner: "A",
          layer: "human",
          inputs: [],
          outputs: [],
          tools: [],
          automationScore: 50,
          dependencies: [],
        },
        {
          id: "step_1",
          name: "Duplicate",
          description: "Duplicate occurrence",
          owner: "B",
          layer: "cell",
          inputs: [],
          outputs: [],
          tools: [],
          automationScore: 60,
          dependencies: [],
        },
        {
          id: "step_2",
          name: "Third",
          description: "Unique step",
          owner: "C",
          layer: "orchestration",
          inputs: [],
          outputs: [],
          tools: [],
          automationScore: 70,
          dependencies: [],
        },
      ],
      gaps: [],
    };

    server.use(
      http.post("https://api.anthropic.com/v1/messages", () => {
        return HttpResponse.json(
          makeCloudeResponse(
            "```json\n" + JSON.stringify(responseWithDuplicates) + "\n```"
          )
        );
      })
    );

    const result = await decomposeWorkflow({ description: "Test workflow" });

    // Only first occurrence of step_1 should be kept
    const stepIds = result.steps.map((s) => s.id);
    expect(stepIds).toEqual(["step_1", "step_2"]);
    expect(result.steps.find((s) => s.id === "step_1")!.name).toBe("First");
  });

  it("e. referential integrity - invalid dependency references", async () => {
    const responseWithInvalidDeps = {
      title: "Invalid Deps",
      steps: [
        {
          id: "step_1",
          name: "Step One",
          description: "First step",
          owner: "A",
          layer: "human",
          inputs: [],
          outputs: [],
          tools: [],
          automationScore: 50,
          dependencies: ["step_nonexistent", "step_2"],
        },
        {
          id: "step_2",
          name: "Step Two",
          description: "Second step",
          owner: "B",
          layer: "cell",
          inputs: [],
          outputs: [],
          tools: [],
          automationScore: 60,
          dependencies: [],
        },
      ],
      gaps: [],
    };

    server.use(
      http.post("https://api.anthropic.com/v1/messages", () => {
        return HttpResponse.json(
          makeCloudeResponse(
            "```json\n" + JSON.stringify(responseWithInvalidDeps) + "\n```"
          )
        );
      })
    );

    const result = await decomposeWorkflow({ description: "Test workflow" });

    // step_nonexistent should be removed, step_2 should remain
    expect(result.steps[0].dependencies).toEqual(["step_2"]);
  });

  it("f. referential integrity - self-referencing dependency", async () => {
    const responseWithSelfRef = {
      title: "Self Ref",
      steps: [
        {
          id: "step_1",
          name: "Self Referencing",
          description: "References itself",
          owner: "A",
          layer: "human",
          inputs: [],
          outputs: [],
          tools: [],
          automationScore: 50,
          dependencies: ["step_1"],
        },
      ],
      gaps: [],
    };

    server.use(
      http.post("https://api.anthropic.com/v1/messages", () => {
        return HttpResponse.json(
          makeCloudeResponse(
            "```json\n" + JSON.stringify(responseWithSelfRef) + "\n```"
          )
        );
      })
    );

    const result = await decomposeWorkflow({ description: "Test workflow" });

    // Self-reference should be removed
    expect(result.steps[0].dependencies).toEqual([]);
  });

  it("g. circular dependency detection", async () => {
    const responseWithCycle = {
      title: "Circular Deps",
      steps: [
        {
          id: "step_a",
          name: "A",
          description: "Step A",
          owner: "A",
          layer: "human",
          inputs: [],
          outputs: [],
          tools: [],
          automationScore: 50,
          dependencies: ["step_c"],
        },
        {
          id: "step_b",
          name: "B",
          description: "Step B",
          owner: "B",
          layer: "cell",
          inputs: [],
          outputs: [],
          tools: [],
          automationScore: 60,
          dependencies: ["step_a"],
        },
        {
          id: "step_c",
          name: "C",
          description: "Step C",
          owner: "C",
          layer: "orchestration",
          inputs: [],
          outputs: [],
          tools: [],
          automationScore: 70,
          dependencies: ["step_b"],
        },
      ],
      gaps: [],
    };

    server.use(
      http.post("https://api.anthropic.com/v1/messages", () => {
        return HttpResponse.json(
          makeCloudeResponse(
            "```json\n" + JSON.stringify(responseWithCycle) + "\n```"
          )
        );
      })
    );

    const result = await decomposeWorkflow({ description: "Test workflow" });

    // At least one edge should be removed to break the cycle A->C->B->A
    // Collect all dependencies
    const allDeps = result.steps.flatMap((s) =>
      s.dependencies.map((d) => `${s.id}->${d}`)
    );
    // Should NOT have all three edges (that would be a cycle)
    const hasFull =
      allDeps.includes("step_a->step_c") &&
      allDeps.includes("step_b->step_a") &&
      allDeps.includes("step_c->step_b");
    expect(hasFull).toBe(false);
    // No error should be thrown
    expect(result.steps).toHaveLength(3);
  });

  it("h. team size integration - small team vs medium team fragility", async () => {
    // Small team (3 people) should have higher fragility due to fragilityMultiplier=1.4
    const smallTeamResult = await decomposeWorkflow(
      { description: "Test workflow" },
      3
    );

    // Medium team (10 people) should have lower fragility with multiplier=1.0
    const mediumTeamResult = await decomposeWorkflow(
      { description: "Test workflow" },
      10
    );

    // Both should have valid health scores
    expect(smallTeamResult.health.teamSize).toBe(3);
    expect(mediumTeamResult.health.teamSize).toBe(10);

    // Small team should have >= fragility compared to medium team
    // (fragilityMultiplier 1.4 vs 1.0 amplifies the raw fragility)
    expect(smallTeamResult.health.fragility).toBeGreaterThanOrEqual(
      mediumTeamResult.health.fragility
    );
  });

  it("i. code fence extraction", async () => {
    const validResponse = {
      title: "Fenced Response",
      steps: [
        {
          id: "step_1",
          name: "Step",
          description: "A step",
          owner: "A",
          layer: "human",
          inputs: [],
          outputs: [],
          tools: [],
          automationScore: 50,
          dependencies: [],
        },
      ],
      gaps: [],
    };

    server.use(
      http.post("https://api.anthropic.com/v1/messages", () => {
        return HttpResponse.json(
          makeCloudeResponse(
            "Here is the analysis:\n```json\n" +
              JSON.stringify(validResponse) +
              "\n```\nThat's the result."
          )
        );
      })
    );

    const result = await decomposeWorkflow({ description: "Test workflow" });

    expect(result.title).toBe("Fenced Response");
    expect(result.steps).toHaveLength(1);
    expect(result._partial).toBe(false);
  });

  it("j. direct JSON extraction (no code fence)", async () => {
    const validResponse = {
      title: "Direct JSON",
      steps: [
        {
          id: "step_1",
          name: "Step",
          description: "A step",
          owner: "A",
          layer: "human",
          inputs: [],
          outputs: [],
          tools: [],
          automationScore: 50,
          dependencies: [],
        },
      ],
      gaps: [],
    };

    server.use(
      http.post("https://api.anthropic.com/v1/messages", () => {
        return HttpResponse.json(
          makeCloudeResponse(JSON.stringify(validResponse))
        );
      })
    );

    const result = await decomposeWorkflow({ description: "Test workflow" });

    expect(result.title).toBe("Direct JSON");
    expect(result.steps).toHaveLength(1);
    expect(result._partial).toBe(false);
  });
});
