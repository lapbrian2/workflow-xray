import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { withApiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/api-errors";
import { CompareSchema } from "@/lib/validation";
import type { CompareInput } from "@/lib/validation";
import type { Decomposition, CompareResult, Step, Gap } from "@/lib/types";

// ── Fuzzy matching utilities ──

/** Levenshtein distance between two strings */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // Use single-row DP for memory efficiency
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,     // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Jaccard similarity on word sets (0..1) */
function jaccardWords(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Normalized Levenshtein similarity (0..1) */
function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a.toLowerCase(), b.toLowerCase()) / maxLen;
}

/**
 * Combined similarity score for two step names.
 * Weights: 40% Levenshtein, 40% Jaccard word overlap, 20% position proximity
 */
function stepSimilarity(
  a: Step,
  b: Step,
  aIndex: number,
  bIndex: number,
  totalA: number,
  totalB: number
): number {
  const levSim = levenshteinSimilarity(a.name, b.name);
  const jacSim = jaccardWords(a.name, b.name);

  // Position similarity: how close are they in relative order?
  const posA = totalA > 1 ? aIndex / (totalA - 1) : 0.5;
  const posB = totalB > 1 ? bIndex / (totalB - 1) : 0.5;
  const posSim = 1 - Math.abs(posA - posB);

  return levSim * 0.4 + jacSim * 0.4 + posSim * 0.2;
}

const MATCH_THRESHOLD = 0.55; // Minimum similarity to consider a match

/**
 * Find best matching step using fuzzy scoring.
 * Returns the best match above threshold, avoiding duplicates.
 */
function findBestMatch(
  step: Step,
  stepIndex: number,
  candidates: Step[],
  alreadyMatched: Set<string>,
  totalSteps: number,
  totalCandidates: number
): { match: Step; score: number } | null {
  let bestMatch: Step | null = null;
  let bestScore = 0;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (alreadyMatched.has(candidate.id)) continue;

    const score = stepSimilarity(
      step, candidate,
      stepIndex, i,
      totalSteps, totalCandidates
    );

    if (score > bestScore && score >= MATCH_THRESHOLD) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  return bestMatch ? { match: bestMatch, score: bestScore } : null;
}

/**
 * Create a gap fingerprint for matching across decompositions.
 * Uses type + normalized keywords for more robust matching.
 */
function gapFingerprint(gap: Gap): string {
  // Extract meaningful words from description, sort for order-independence
  const words = gap.description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3) // Skip short words
    .sort()
    .slice(0, 8) // Take top 8 content words
    .join(",");
  return `${gap.type}:${words}`;
}

function compareDecompositions(
  before: Decomposition,
  after: Decomposition
): CompareResult {
  const matchedBeforeIds = new Set<string>();

  // Step diffing — fuzzy match by name + position
  const added: Step[] = [];
  const removed: Step[] = [];
  const modified: { step: Step; beforeStep: Step; changes: string[] }[] = [];
  const unchanged: Step[] = [];

  // First pass: find best matches for each "after" step
  for (let i = 0; i < after.steps.length; i++) {
    const afterStep = after.steps[i];
    const result = findBestMatch(
      afterStep, i,
      before.steps, matchedBeforeIds,
      after.steps.length, before.steps.length
    );

    if (!result) {
      added.push(afterStep);
      continue;
    }

    const beforeStep = result.match;
    matchedBeforeIds.add(beforeStep.id);

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

  // Gap diffing — match by type + keyword fingerprint
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

export const POST = withApiHandler<CompareInput>(
  async (request, body) => {
    // Rate limit: 20 comparisons per minute per IP
    const ip = getClientIp(request);
    const rl = rateLimit(`compare:${ip}`, 20, 60);
    if (!rl.allowed) {
      throw new AppError("RATE_LIMITED", `Rate limit exceeded. Try again in ${rl.resetInSeconds}s.`, 429);
    }

    const result = compareDecompositions(
      body.before as unknown as Decomposition,
      body.after as unknown as Decomposition
    );
    return NextResponse.json(result);
  },
  { schema: CompareSchema }
);
