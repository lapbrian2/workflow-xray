import { describe, it, expect, beforeEach } from "vitest";
import {
  computeAnalysisHash,
  getCachedAnalysis,
  setCachedAnalysis,
  type CacheEntry,
} from "@/lib/analysis-cache";
import type { Decomposition } from "@/lib/types";
import type { DecomposeMetadata } from "@/lib/decompose";

// ─── Test fixtures ───

const baseDecomposition: Decomposition = {
  id: "test_decomp_1",
  title: "Test Workflow",
  steps: [
    {
      id: "step_1",
      name: "Step One",
      description: "First step",
      owner: "Engineer",
      layer: "human",
      inputs: ["input_1"],
      outputs: ["output_1"],
      tools: ["tool_1"],
      automationScore: 50,
      dependencies: [],
    },
  ],
  gaps: [],
  health: {
    complexity: 50,
    fragility: 40,
    automationPotential: 60,
    teamLoadBalance: 70,
  },
};

const baseMetadata: DecomposeMetadata = {
  promptVersion: "abc123",
  modelUsed: "claude-sonnet-4-20250514",
  inputTokens: 500,
  outputTokens: 300,
};

const baseStages = [{ name: "Stage 1", owner: "Alice", tools: "Jira", inputs: "ticket", outputs: "result" }];
const baseCostContext = { teamSize: 5, hourlyRate: 100, hoursPerStep: 2 };

// ─── Hash computation tests ───

describe("computeAnalysisHash", () => {
  it("returns a 16-character hex string", () => {
    const hash = computeAnalysisHash(
      { description: "Test workflow description", stages: baseStages, costContext: baseCostContext },
      "prompt_v1",
      "claude-sonnet-4-20250514"
    );
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is deterministic — same inputs produce same hash", () => {
    const input = {
      description: "Identical workflow",
      stages: baseStages,
      costContext: baseCostContext,
    };
    const hash1 = computeAnalysisHash(input, "v1", "model-a");
    const hash2 = computeAnalysisHash(input, "v1", "model-a");
    expect(hash1).toBe(hash2);
  });

  it("produces different hash for different description", () => {
    const hash1 = computeAnalysisHash(
      { description: "Workflow A", stages: [], costContext: {} },
      "v1",
      "model-a"
    );
    const hash2 = computeAnalysisHash(
      { description: "Workflow B", stages: [], costContext: {} },
      "v1",
      "model-a"
    );
    expect(hash1).not.toBe(hash2);
  });

  it("produces different hash for different teamSize", () => {
    const hash1 = computeAnalysisHash(
      { description: "Same workflow", stages: [], costContext: { teamSize: 3 } },
      "v1",
      "model-a"
    );
    const hash2 = computeAnalysisHash(
      { description: "Same workflow", stages: [], costContext: { teamSize: 10 } },
      "v1",
      "model-a"
    );
    expect(hash1).not.toBe(hash2);
  });

  it("produces different hash for different promptVersion", () => {
    const hash1 = computeAnalysisHash(
      { description: "Same workflow", stages: [], costContext: {} },
      "prompt_v1",
      "model-a"
    );
    const hash2 = computeAnalysisHash(
      { description: "Same workflow", stages: [], costContext: {} },
      "prompt_v2",
      "model-a"
    );
    expect(hash1).not.toBe(hash2);
  });

  it("produces different hash for different modelId", () => {
    const hash1 = computeAnalysisHash(
      { description: "Same workflow", stages: [], costContext: {} },
      "v1",
      "claude-sonnet-4-20250514"
    );
    const hash2 = computeAnalysisHash(
      { description: "Same workflow", stages: [], costContext: {} },
      "v1",
      "claude-opus-4-20250514"
    );
    expect(hash1).not.toBe(hash2);
  });

  it("normalizes whitespace — leading/trailing/internal variations produce same hash", () => {
    const hash1 = computeAnalysisHash(
      { description: "  Hello   world  ", stages: [], costContext: {} },
      "v1",
      "model-a"
    );
    const hash2 = computeAnalysisHash(
      { description: "Hello world", stages: [], costContext: {} },
      "v1",
      "model-a"
    );
    expect(hash1).toBe(hash2);
  });

  it("does NOT include hourlyRate or hoursPerStep in hash", () => {
    const hash1 = computeAnalysisHash(
      { description: "Same", stages: [], costContext: { teamSize: 5, hourlyRate: 50, hoursPerStep: 2 } },
      "v1",
      "m"
    );
    const hash2 = computeAnalysisHash(
      { description: "Same", stages: [], costContext: { teamSize: 5, hourlyRate: 200, hoursPerStep: 10 } },
      "v1",
      "m"
    );
    expect(hash1).toBe(hash2);
  });

  it("handles undefined stages as empty array", () => {
    const hash1 = computeAnalysisHash(
      { description: "Test", stages: undefined, costContext: {} },
      "v1",
      "m"
    );
    const hash2 = computeAnalysisHash(
      { description: "Test", stages: [], costContext: {} },
      "v1",
      "m"
    );
    expect(hash1).toBe(hash2);
  });
});

// ─── Cache get/set tests ───

describe("getCachedAnalysis / setCachedAnalysis", () => {
  beforeEach(() => {
    // Reset in-memory cache between tests by clearing the global store
    const g = globalThis as unknown as { __analysisCacheStore?: Map<string, unknown> };
    if (g.__analysisCacheStore) {
      g.__analysisCacheStore.clear();
    }
  });

  it("returns null on cache miss", async () => {
    const result = await getCachedAnalysis("nonexistent_hash");
    expect(result).toBeNull();
  });

  it("roundtrips — set then get returns the entry", async () => {
    const entry: CacheEntry = {
      hash: "abc123def456",
      decomposition: baseDecomposition,
      metadata: baseMetadata,
      cachedAt: new Date().toISOString(),
      hitCount: 0,
    };
    await setCachedAnalysis("abc123def456", entry);
    const result = await getCachedAnalysis("abc123def456");
    expect(result).not.toBeNull();
    expect(result!.hash).toBe("abc123def456");
    expect(result!.decomposition.title).toBe("Test Workflow");
    expect(result!.metadata.promptVersion).toBe("abc123");
  });

  it("increments hitCount on repeated gets", async () => {
    const entry: CacheEntry = {
      hash: "hit_counter_test",
      decomposition: baseDecomposition,
      metadata: baseMetadata,
      cachedAt: new Date().toISOString(),
      hitCount: 0,
    };
    await setCachedAnalysis("hit_counter_test", entry);

    const first = await getCachedAnalysis("hit_counter_test");
    expect(first!.hitCount).toBe(1);

    const second = await getCachedAnalysis("hit_counter_test");
    expect(second!.hitCount).toBe(2);

    const third = await getCachedAnalysis("hit_counter_test");
    expect(third!.hitCount).toBe(3);
  });

  it("stores cachedAt as ISO string", async () => {
    const now = new Date().toISOString();
    const entry: CacheEntry = {
      hash: "timestamp_test",
      decomposition: baseDecomposition,
      metadata: baseMetadata,
      cachedAt: now,
      hitCount: 0,
    };
    await setCachedAnalysis("timestamp_test", entry);
    const result = await getCachedAnalysis("timestamp_test");
    expect(result!.cachedAt).toBe(now);
  });

  it("stores full decomposition and metadata", async () => {
    const entry: CacheEntry = {
      hash: "full_data_test",
      decomposition: baseDecomposition,
      metadata: baseMetadata,
      cachedAt: new Date().toISOString(),
      hitCount: 0,
    };
    await setCachedAnalysis("full_data_test", entry);
    const result = await getCachedAnalysis("full_data_test");
    expect(result!.decomposition.steps).toHaveLength(1);
    expect(result!.decomposition.health.complexity).toBe(50);
    expect(result!.metadata.inputTokens).toBe(500);
    expect(result!.metadata.outputTokens).toBe(300);
  });
});
