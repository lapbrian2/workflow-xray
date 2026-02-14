import { NextRequest, NextResponse } from "next/server";
import type { Decomposition, CompareResult, Step } from "@/lib/types";

function compareDecompositions(
  before: Decomposition,
  after: Decomposition
): CompareResult {
  const beforeIds = new Set(before.steps.map((s) => s.id));
  const afterIds = new Set(after.steps.map((s) => s.id));

  const added: Step[] = after.steps.filter((s) => !beforeIds.has(s.id));
  const removed: Step[] = before.steps.filter((s) => !afterIds.has(s.id));

  const modified: { step: Step; changes: string[] }[] = [];
  for (const afterStep of after.steps) {
    if (!beforeIds.has(afterStep.id)) continue;
    const beforeStep = before.steps.find((s) => s.id === afterStep.id);
    if (!beforeStep) continue;

    const changes: string[] = [];
    if (beforeStep.name !== afterStep.name) changes.push("name");
    if (beforeStep.layer !== afterStep.layer) changes.push("layer");
    if (beforeStep.owner !== afterStep.owner) changes.push("owner");
    if (beforeStep.automationScore !== afterStep.automationScore)
      changes.push("automationScore");
    if (JSON.stringify(beforeStep.tools) !== JSON.stringify(afterStep.tools))
      changes.push("tools");

    if (changes.length > 0) {
      modified.push({ step: afterStep, changes });
    }
  }

  const healthDelta = {
    complexity: after.health.complexity - before.health.complexity,
    fragility: after.health.fragility - before.health.fragility,
    automationPotential:
      after.health.automationPotential - before.health.automationPotential,
    teamLoadBalance:
      after.health.teamLoadBalance - before.health.teamLoadBalance,
  };

  const parts: string[] = [];
  if (added.length) parts.push(`${added.length} step(s) added`);
  if (removed.length) parts.push(`${removed.length} step(s) removed`);
  if (modified.length) parts.push(`${modified.length} step(s) modified`);
  const summary = parts.length > 0 ? parts.join(", ") + "." : "No changes detected.";

  return { added, removed, modified, healthDelta, summary };
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
