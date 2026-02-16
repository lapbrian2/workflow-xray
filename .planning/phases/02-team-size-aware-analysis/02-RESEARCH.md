# Phase 2: Team-Size-Aware Analysis - Research

**Researched:** 2026-02-16
**Domain:** Team-size-aware AI analysis calibration, prompt engineering, health scoring, UI integration
**Confidence:** HIGH

## Summary

Phase 2 requires threading team size through the entire analysis pipeline: submission form, API route, AI prompt, health scoring, gap severity calibration, results display, and confidence indicators. The good news is that the existing codebase already has substantial infrastructure for this. The `CostContext` type already includes `teamSize` and `teamContext` fields. The submission form already has input fields for both. The API route already injects a `## Team & Cost Context` block into the prompt. The Workflow type already persists `costContext` to storage (KV/Blob).

What is **missing** is the actual calibration logic: the `computeHealth()` function in `scoring.ts` uses fixed formulas with no team-size awareness, the `decompose-system.md` prompt has no instructions to vary gap severity or scores by team size, the results display shows no team-size context or confidence indicators, and gap severity is entirely determined by Claude without team-size-specific guidance in the prompt.

**Primary recommendation:** This phase is 80% prompt engineering + scoring logic changes, 15% UI display work, and 5% form/validation adjustments (since the form already exists). Focus effort on (1) the scoring calibration in `scoring.ts`, (2) prompt instructions in `decompose-system.md`, (3) confidence indicator UI in results components, and (4) team context banner on the results page.

## Standard Stack

### Core

No new libraries are needed. This phase modifies existing code only.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.x | UI components | Already in use |
| Zod (v4) | 4.x | Input validation | Already in use, uses `error` param not `message` |
| Next.js 16 | 16.x | App Router, API routes | Already in use |
| Anthropic SDK | latest | Claude API calls | Already in use via `claude.ts` |

### Supporting

No new supporting libraries needed.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hardcoded team-size thresholds | ML-trained calibration model | Overkill for v1; hardcoded thresholds with 3-4 breakpoints (solo/small/medium/large) are sufficient and explainable |
| Server-side gap severity recalibration | Letting Claude do all calibration via prompt | Hybrid is better: Claude handles nuanced severity in context, `computeHealth()` applies deterministic threshold shifts |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure

No new files are strictly necessary. All changes can be made within existing files:

```
src/
├── lib/
│   ├── scoring.ts            # MODIFY: Add team-size-aware threshold functions
│   ├── types.ts              # MODIFY: Add confidence field to Gap and HealthMetrics
│   ├── decompose.ts          # MODIFY: Pass teamSize to computeHealth()
│   ├── validation.ts         # MINOR: Already validates teamSize, no changes needed
│   └── team-calibration.ts   # NEW (optional): Extract team-size logic to dedicated module
├── prompts/
│   └── decompose-system.md   # MODIFY: Add team-size-aware gap severity instructions
├── components/
│   ├── health-card.tsx        # MODIFY: Add team-size context banner
│   ├── gap-card.tsx           # MODIFY: Add confidence indicator per gap
│   ├── gap-analysis.tsx       # MODIFY: Add team context header
│   └── confidence-badge.tsx   # NEW: Reusable confidence indicator component
├── app/
│   ├── api/decompose/route.ts # MODIFY: Pass teamSize to decomposeWorkflow, forward to scoring
│   └── xray/[id]/page.tsx     # MODIFY: Display team-size context banner in header
```

### Pattern 1: Team-Size Tier Classification

**What:** Classify team size into tiers that drive threshold adjustments rather than using raw numbers directly. This makes the calibration explainable and testable.

**When to use:** Whenever team size needs to affect a score or severity.

**Example:**
```typescript
// src/lib/team-calibration.ts (or inline in scoring.ts)

export type TeamTier = "solo" | "small" | "medium" | "large";

export function getTeamTier(teamSize: number): TeamTier {
  if (teamSize <= 1) return "solo";
  if (teamSize <= 5) return "small";
  if (teamSize <= 20) return "medium";
  return "large";
}

export interface TeamThresholds {
  fragilityMultiplier: number;      // Amplifies fragility for small teams
  singleDepSeverityFloor: Severity; // Minimum severity for single_dependency gaps
  bottleneckMultiplier: number;     // Amplifies bottleneck impact for small teams
  loadBalanceBaseline: number;      // Expected balance score baseline
}

const THRESHOLDS: Record<TeamTier, TeamThresholds> = {
  solo:   { fragilityMultiplier: 1.8, singleDepSeverityFloor: "high",   bottleneckMultiplier: 1.5, loadBalanceBaseline: 30 },
  small:  { fragilityMultiplier: 1.4, singleDepSeverityFloor: "high",   bottleneckMultiplier: 1.3, loadBalanceBaseline: 50 },
  medium: { fragilityMultiplier: 1.0, singleDepSeverityFloor: "medium", bottleneckMultiplier: 1.0, loadBalanceBaseline: 60 },
  large:  { fragilityMultiplier: 0.8, singleDepSeverityFloor: "low",    bottleneckMultiplier: 0.8, loadBalanceBaseline: 70 },
};

export function getThresholds(teamSize?: number): TeamThresholds {
  if (!teamSize) return THRESHOLDS.medium; // Default: no team size = medium assumptions
  return THRESHOLDS[getTeamTier(teamSize)];
}
```

### Pattern 2: Confidence Indicators on AI Output

**What:** Each section of analysis output (health scores, individual gaps, recommendations) gets a confidence level based on how much information was available vs. inferred.

**When to use:** For TEAM-05 (confidence indicators).

**Example:**
```typescript
// Extend existing types
export type ConfidenceLevel = "high" | "inferred";

export interface ConfidenceMetadata {
  level: ConfidenceLevel;
  reason: string; // e.g. "Team size provided" or "Team size not specified; using medium-team defaults"
}

// On HealthMetrics, add optional confidence:
export interface HealthMetrics {
  complexity: number;
  fragility: number;
  automationPotential: number;
  teamLoadBalance: number;
  teamSize?: number;                    // TEAM-04: store for display
  confidence?: ConfidenceMetadata;      // TEAM-05: confidence indicator
}

// On Gap, add optional confidence:
export interface Gap {
  // ... existing fields ...
  confidence?: ConfidenceLevel;         // TEAM-05: per-gap confidence
}
```

### Pattern 3: Prompt-Driven Severity Calibration

**What:** The system prompt instructs Claude to factor team size into gap severity assignment, so that the same structural issue gets different severity based on team capacity.

**When to use:** For TEAM-02 and TEAM-03.

**Example prompt addition for decompose-system.md:**
```markdown
## Team-Size Calibration

When team context is provided, calibrate your gap severity and analysis:

### Solo / 1-person team:
- single_dependency: ALWAYS "high" (the entire workflow depends on one person by definition, but flag when there's no documentation or fallback)
- bottleneck: Severity is "high" if it blocks the solo operator for >2 hrs
- Avoid suggesting delegation or cross-training (there's no one to delegate to)
- Focus suggestions on automation, documentation, and async tooling

### Small team (2-5 people):
- single_dependency: "high" if the person covers 50%+ of steps
- bottleneck: "high" if it blocks 2+ downstream steps
- Focus on cross-training and documentation

### Medium team (6-20 people):
- Use standard severity calibration
- single_dependency: "medium" unless the person is on 60%+ of steps
- Suggest role-based ownership and rotation

### Large team (21+ people):
- single_dependency: Usually "low" unless the person controls a critical chokepoint
- bottleneck: Focus on process bottlenecks over individual ones
- Suggest workflow automation and self-service tooling

When no team size is provided, use medium-team defaults and note your assumptions.

For each gap, include a "confidence" field ("high" or "inferred"):
- "high": Gap is clearly evidenced from the workflow description
- "inferred": Gap is estimated based on typical patterns for this team size
```

### Anti-Patterns to Avoid

- **Linear scaling by team size:** Do NOT multiply scores by `teamSize / 10` or similar. Team dynamics are non-linear. A 2-person team is not 5x more fragile than a 10-person team in a simple ratio. Use tiers with tested multipliers.
- **Overriding Claude's severity entirely on the server:** The prompt should guide Claude to produce team-calibrated severities. The server-side `computeHealth()` applies additional threshold adjustments, but should not wholesale replace Claude's nuanced gap severity.
- **Making team size required:** It must remain optional. When absent, use medium-team defaults and flag confidence as "inferred."
- **Changing the Zod schema for Gap to require confidence:** The confidence field must be optional (`z.enum([...]).optional()`) since Claude may not always return it, and existing stored workflows lack it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Team-size validation | Custom number validation | Existing Zod schema in `validation.ts` already validates `teamSize: z.number().int().min(1).max(10000).optional()` | Already done |
| Prompt injection for team context | New prompt composition system | Existing pattern in `api/decompose/route.ts` lines 26-37 that builds `enrichedDescription` with `## Team & Cost Context` | Proven pattern, just needs strengthening |
| Confidence display UI | Complex tooltip/popover system | Simple inline badge component with color coding | YAGNI - a colored badge with label is sufficient for v1 |

**Key insight:** The existing codebase has 70% of the plumbing in place. The `CostContext` type, form inputs, API enrichment, and storage all exist. The work is in making the analysis pipeline actually USE the team size to produce different results.

## Common Pitfalls

### Pitfall 1: Prompt Bloat Breaking JSON Output

**What goes wrong:** Adding too many team-size instructions to `decompose-system.md` pushes the response closer to the max_tokens limit (currently 4096) or confuses Claude into producing explanation text instead of pure JSON.
**Why it happens:** The prompt already has 100+ lines of instruction. Every addition is a token cost and a potential source of instruction-following degradation.
**How to avoid:** Keep team-size additions to 15-25 lines max. Test with real workflows at team sizes 1, 3, 10, 50 to verify JSON output remains clean. Consider raising `max_tokens` to 5120 if needed.
**Warning signs:** Claude responses start with text before JSON, or JSON is truncated.

### Pitfall 2: Breaking Existing Workflows on Load

**What goes wrong:** Adding new required fields to `HealthMetrics` or `Gap` types causes TypeScript errors when rendering old workflows that lack these fields.
**Why it happens:** Stored workflows in KV/Blob were saved without `confidence` or `teamSize` fields.
**How to avoid:** All new fields MUST be optional (`?` in TypeScript, `.optional()` in Zod). Display components must null-check: `{health.confidence && <ConfidenceBadge ... />}`. Never assume new fields exist on loaded data.
**Warning signs:** Runtime errors on the xray/[id] page when viewing older workflows.

### Pitfall 3: Scoring Regression for Uncalibrated Workflows

**What goes wrong:** Changing `computeHealth()` scoring formulas causes all existing workflows to show different health scores when viewed, even though nothing about the workflow changed.
**Why it happens:** Health scores are computed at analysis time and stored. But if `computeHealth()` changes, re-analysis would yield different scores, confusing version comparisons.
**How to avoid:** When `teamSize` is NOT provided, `computeHealth()` must return exactly the same scores as the current formula (multiplier = 1.0). Only apply team-size adjustments when `teamSize` is explicitly passed. This maintains backward compatibility.
**Warning signs:** Version comparison (compare-view.tsx) shows health deltas that come from formula changes, not workflow changes.

### Pitfall 4: Gap Confidence Field Not Returned by Claude

**What goes wrong:** The prompt asks Claude to return a `confidence` field on each gap, but Claude sometimes omits optional fields.
**Why it happens:** Claude follows the schema in the prompt, but optional fields are often dropped, especially under token pressure.
**How to avoid:** Add `confidence` to the `GapSchema` in `decompose.ts` as `.optional().default("inferred")`. If Claude omits it, Zod fills in the default. On the server side, also apply a post-processing step: if teamSize was provided but a gap lacks confidence, default to "high"; if no teamSize, default to "inferred".
**Warning signs:** All gaps show "inferred" even when team size was explicitly provided.

### Pitfall 5: Team Size Input Gets Lost in the Structured Form Path

**What goes wrong:** The team size input is inside the `costContext` collapsible section. Users in structured mode may not see it. More importantly, the cost context is sent alongside description/stages, but the existing structured-form path generates description text from stages only.
**Why it happens:** The `costContext` is already optional and collapsible. It works identically for both freeform and structured modes since it's in the parent `WorkflowInput` component. But TEAM-01's success criteria says "user can enter team size on the workflow submission form before running analysis" -- this is already true today in the collapsible "Context" section.
**How to avoid:** For Phase 2, consider promoting team size from the collapsible section to a more visible position, OR keep it where it is but ensure the collapsible section auto-opens when coming from a flow that emphasizes team size. The current UX is functional but not prominent.
**Warning signs:** Users don't notice the team size input and analyze without it, getting generic results.

## Code Examples

### Current: How Team Context Flows Through the System

The existing flow (verified from codebase):

```
[workflow-input.tsx]                [api/decompose/route.ts]
   costContext: {                      enrichedDescription +=
     teamSize: 3,                        "\n\n## Team & Cost Context"
     teamContext: "..."                   "Team size: 3 people"
   }                                     "Adapt your analysis..."
        |                                       |
        v                                       v
   POST /api/decompose              decomposeWorkflow(request)
   body: { description,                        |
           costContext }                        v
                                    callClaude(prompt)
                                    → decompose-system.md (system)
                                    → enrichedDescription (user)
                                               |
                                               v
                                    computeHealth(steps, gaps)
                                    // NOTE: teamSize NOT passed here
                                    // scoring is team-size-UNAWARE
                                               |
                                               v
                                    workflow.costContext = body.costContext
                                    // teamSize IS persisted to storage
```

### Needed: Pass teamSize to computeHealth()

```typescript
// decompose.ts - modify decomposeWorkflow signature
export async function decomposeWorkflow(
  request: DecomposeRequest,
  teamSize?: number   // NEW parameter
): Promise<Decomposition & { _meta: DecomposeMetadata }> {
  // ... existing code ...
  const health = computeHealth(validated.steps, cleanGaps, teamSize);
  // ...
}

// scoring.ts - modify computeHealth signature
export function computeHealth(
  steps: Step[],
  gaps: Gap[],
  teamSize?: number    // NEW parameter
): HealthMetrics {
  const thresholds = getThresholds(teamSize);
  // Apply thresholds.fragilityMultiplier, etc.
  // ...
}
```

### Needed: Confidence Badge Component

```typescript
// components/confidence-badge.tsx
interface ConfidenceBadgeProps {
  level: "high" | "inferred";
  context?: string; // tooltip text
}

export default function ConfidenceBadge({ level, context }: ConfidenceBadgeProps) {
  const isHigh = level === "high";
  return (
    <span
      title={context}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "2px 8px",
        borderRadius: 10,
        background: isHigh ? "var(--success-bg-light)" : "rgba(212,160,23,0.08)",
        color: isHigh ? "var(--color-success)" : "var(--color-warning)",
        border: `1px solid ${isHigh ? "rgba(23,165,137,0.2)" : "rgba(212,160,23,0.2)"}`,
      }}
    >
      {isHigh ? "High Confidence" : "Inferred"}
    </span>
  );
}
```

### Needed: Team Context Banner on Results Page

```typescript
// Inside xray/[id]/page.tsx, after the header title, before tabs:
{workflow.costContext?.teamSize && (
  <div style={{
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    background: "rgba(45,125,210,0.04)",
    border: "1px solid rgba(45,125,210,0.12)",
    borderRadius: "var(--radius-sm)",
    marginBottom: 16,
  }}>
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "var(--color-info)" }}>
      Calibrated for {workflow.costContext.teamSize}-person team
    </span>
    {workflow.costContext.teamContext && (
      <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--color-muted)" }}>
        ({workflow.costContext.teamContext})
      </span>
    )}
    <ConfidenceBadge level="high" context="Team size was explicitly provided" />
  </div>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed health formulas | Team-size-calibrated formulas | Phase 2 (this phase) | Scores vary meaningfully by team size |
| Claude determines severity freely | Claude receives team-size-specific severity guidance | Phase 2 (this phase) | Same workflow yields different gap severities at different team sizes |
| No confidence indicators | Per-section confidence badges | Phase 2 (this phase) | Users understand what's certain vs. estimated |

**Deprecated/outdated:**
- Nothing deprecated. Phase 1 infrastructure is stable and this phase builds on it.

## Open Questions

1. **Should team size be promoted to a top-level, always-visible field on the submission form?**
   - What we know: It currently exists inside a collapsible "Context (optional)" section alongside hourlyRate, hoursPerStep, and teamContext.
   - What's unclear: Whether making it more prominent (e.g., above the text area) would improve adoption vs. overwhelming the user.
   - Recommendation: Keep it where it is for Phase 2, but add a subtle hint/tooltip near the submit button: "Add team size for calibrated results." This preserves the clean UI while nudging discovery.

2. **How should computeHealth() handle teamSize when scoring backwards-compatible workflows?**
   - What we know: Existing stored workflows have health scores baked in. computeHealth() is only called during analysis, not on page load. So old workflows keep their old scores.
   - What's unclear: Should the compare view re-compute health with the new formula for fair comparison?
   - Recommendation: Do NOT re-compute. Stored scores are the scores. This avoids confusion. If a user re-analyzes with a team size, the new version's scores reflect the calibration. Version comparison shows the delta.

3. **Should gap severity recalibration happen in Claude's prompt, in server-side post-processing, or both?**
   - What we know: Currently Claude assigns severity freely. The server could override/adjust after the fact.
   - What's unclear: Whether Claude's prompt-guided severity is reliable enough without server correction.
   - Recommendation: BOTH. The prompt guides Claude to calibrate severity per team tier. The server-side `computeHealth()` applies multipliers to the fragility/teamLoadBalance scores based on team size. Do NOT override individual gap severities server-side (that would disconnect the displayed severity from the gap's own description). Instead, let the health scores reflect team-size awareness while gap severities come from Claude's calibrated judgment.

4. **What constitutes "visibly different" scores (Success Criteria #2)?**
   - What we know: SC#2 says "team size 3 produces visibly different health metric scores than team size 50."
   - What's unclear: Exact target deltas.
   - Recommendation: For fragility, a 3-person team should score 15-30 points higher than a 50-person team on the same workflow (because fragility is worse for small teams). For teamLoadBalance, the gap should be 10-20 points. Test with 3 reference workflows and tune multipliers until the delta is noticeable but not absurd.

5. **How to handle the `confidence` field Claude may or may not return?**
   - What we know: The existing GapSchema in decompose.ts uses `z.enum(["low", "medium", "high"])` for severity. We can add `confidence: z.enum(["high", "inferred"]).optional().default("inferred")`.
   - What's unclear: Whether Claude will reliably produce this field when instructed.
   - Recommendation: Add it to the Zod schema with `.optional().default("inferred")`. Add a post-processing step: if teamSize was provided and the gap description clearly references team-size factors, upgrade confidence to "high". This gives a safety net.

## Sources

### Primary (HIGH confidence)

- **Codebase inspection** (all files read directly):
  - `src/lib/types.ts` - CostContext already has teamSize, teamContext
  - `src/lib/scoring.ts` - computeHealth() uses fixed formulas, no teamSize param
  - `src/lib/decompose.ts` - decomposeWorkflow() calls computeHealth() without teamSize
  - `src/app/api/decompose/route.ts` - Already injects team context into prompt text (lines 26-37)
  - `src/components/workflow-input.tsx` - Team size input already exists (lines 280-305)
  - `src/lib/validation.ts` - teamSize validated: `z.number().int().min(1).max(10000).optional()`
  - `src/prompts/decompose-system.md` - No team-size calibration instructions currently
  - `src/components/health-card.tsx` - No team-size display or confidence indicators
  - `src/components/gap-card.tsx` - No confidence indicators per gap
  - `src/app/xray/[id]/page.tsx` - No team-size context display

### Secondary (MEDIUM confidence)

- **Pattern analysis** from existing codebase conventions:
  - All components use inline styles (no CSS modules or Tailwind)
  - Color system uses CSS custom properties (var(--color-*))
  - Font system: var(--font-mono) for labels/data, var(--font-body) for prose, var(--font-display) for headings
  - Consistent animation patterns: fadeIn, staggerFadeIn, fadeInUp
  - Badge/tag pattern used extensively for metadata display

### Tertiary (LOW confidence)

- None. All findings are from direct codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed, all changes are to existing files
- Architecture: HIGH - Existing patterns (CostContext flow, prompt enrichment, Zod validation) directly inform the implementation approach
- Pitfalls: HIGH - All pitfalls identified from direct code analysis (backward compatibility, Zod defaults, prompt token limits)
- Scoring calibration multipliers: MEDIUM - The specific numbers (1.8x for solo, 0.8x for large) are educated estimates that need testing and tuning

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days - stable domain, no external dependency changes expected)
