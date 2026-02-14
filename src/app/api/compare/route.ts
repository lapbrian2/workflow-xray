import { NextRequest, NextResponse } from "next/server";
import type { Decomposition, CompareResult, Step, Gap } from "@/lib/types";

/**
 * Match steps by name similarity (since Claude generates unique IDs per run).
 * Normalizes names to lowercase for fuzzy matching.
 */
function normalizeStepName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findMatchingStep(
  step: Step,
  candidates: Step[]
): Step | undefined {
  const norm = normalizeStepName(step.name);
  return candidates.find(
    (c) => normalizeStepName(c.name) === norm
  );
}

/**
 * Create a gap fingerprint for matching across decompositions.
 * Gaps don't have IDs, so we match by type + description similarity.
 */
function gapFingerprint(gap: Gap): string {
  return `${gap.type}:${gap.description.toLowerCase().slice(0, 60)}`;
}

function compareDecompositions(
  before: Decomposition,
  after: Decomposition
): CompareResult {
  const matchedBeforeIds = new Set<string>();
  const matchedAfterIds = new Set<string>();

  // Step diffing — match by name
  const added: Step[] = [];
  const removed: Step[] = [];
  const modified: { step: Step; beforeStep: Step; changes: string[] }[] = [];
  const unchanged: Step[] = [];

  for (const afterStep of after.steps) {
    const beforeStep = findMatchingStep(afterStep, before.steps);
    if (!beforeStep) {
      added.push(afterStep);
      continue;
    }

    matchedBeforeIds.add(beforeStep.id);
    matchedAfterIds.add(afterStep.id);

    const changes: string[] = [];
    if (beforeStep.name !== afterStep.name) changes.push("name");
    if (beforeStep.layer !== afterStep.layer) changes.push("layer");
    if (beforeStep.owner !== afterStep.owner) changes.push("owner");
    if (beforeStep.automationScore !== afterStep.automationScore)
      changes.push("automationScore");
    if (beforeStep.description !== afterStep.description)
      changes.push("description");
    if (JSON.stringify(beforeStep.tools) !== JSON.stringify(afterStep.tools))
      changes.push("tools");
    if (JSON.stringify(beforeStep.inputs) !== JSON.stringify(afterStep.inputs))
      changes.push("inputs");
    if (JSON.stringify(beforeStep.outputs) !== JSON.stringify(afterStep.outputs))
      changes.push("outputs");

    if (changes.length > 0) {
      modified.push({ step: afterStep, beforeStep, changes });
    } else {
      unchanged.push(afterStep);
    }
  }

  // Steps in before that weren't matched → removed
  for (const beforeStep of before.steps) {
    if (!matchedBeforeIds.has(beforeStep.id)) {
      removed.push(beforeStep);
    }
  }

  // Gap diffing — match by type + description fingerprint
  const beforeGapPrints = new Map<string, Gap>();
  before.gaps.forEach((g) => beforeGapPrints.set(gapFingerprint(g), g));

  const afterGapPrints = new Map<string, Gap>();
  after.gaps.forEach((g) => afterGapPrints.set(gapFingerprint(g), g));

  const gapsResolved: Gap[] = [];
  const gapsNew: Gap[] = [];
  const gapsPersistent: Gap[] = [];

  for (const [fp, gap] of beforeGapPrints) {
    if (afterGapPrints.has(fp)) {
      gapsPersistent.push(gap);
    } else {
      gapsResolved.push(gap);
    }
  }
  for (const [fp, gap] of afterGapPrints) {
    if (!beforeGapPrints.has(fp)) {
      gapsNew.push(gap);
    }
  }

  // Health delta
  const healthDelta = {
    complexity: after.health.complexity - before.health.complexity,
    fragility: after.health.fragility - before.health.fragility,
    automationPotential:
      after.health.automationPotential - before.health.automationPotential,
    teamLoadBalance:
      after.health.teamLoadBalance - before.health.teamLoadBalance,
  };

  // Build rich summary
  const parts: string[] = [];
  if (gapsResolved.length)
    parts.push(`${gapsResolved.length} gap${gapsResolved.length > 1 ? "s" : ""} resolved`);
  if (gapsNew.length)
    parts.push(`${gapsNew.length} new gap${gapsNew.length > 1 ? "s" : ""} introduced`);
  if (healthDelta.automationPotential !== 0) {
    const dir = healthDelta.automationPotential > 0 ? "improved" : "decreased";
    parts.push(
      `automation ${dir} by ${Math.abs(healthDelta.automationPotential)}%`
    );
  }
  if (healthDelta.fragility !== 0) {
    const dir = healthDelta.fragility < 0 ? "reduced" : "increased";
    parts.push(
      `fragility ${dir} by ${Math.abs(healthDelta.fragility)} points`
    );
  }
  if (added.length) parts.push(`${added.length} step${added.length > 1 ? "s" : ""} added`);
  if (removed.length) parts.push(`${removed.length} step${removed.length > 1 ? "s" : ""} removed`);

  const summary =
    parts.length > 0 ? parts.join(", ") + "." : "No significant changes detected.";

  return {
    added,
    removed,
    modified,
    unchanged,
    gapsResolved,
    gapsNew,
    gapsPersistent,
    healthDelta,
    healthBefore: before.health,
    healthAfter: after.health,
    summary,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { before, after } = await request.json();
    if (!before || !after) {
      return NextResponse.json(
        { error: "Both before and after decompositions are required" },
        { status: 400 }
      );
    }
    const result = compareDecompositions(before, after);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Compare error:", error);
    return NextResponse.json(
      { error: "Comparison failed" },
      { status: 500 }
    );
  }
}
