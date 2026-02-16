---
phase: 02-team-size-aware-analysis
plan: 01
subsystem: scoring
tags: [team-calibration, health-metrics, fragility, confidence, backward-compatible]

# Dependency graph
requires:
  - phase: 01-infrastructure-security
    provides: scoring.ts computeHealth(), types.ts HealthMetrics/Gap, decompose.ts decomposeWorkflow()
provides:
  - Team tier classification (solo/small/medium/large) with threshold multipliers
  - Team-size-aware health computation (fragility and load balance scaling)
  - ConfidenceLevel type and confidence metadata on HealthMetrics and Gap
  - teamSize parameter threading through decomposeWorkflow to computeHealth
affects: [02-02, 02-03, api-routes, prompt-engineering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional parameter extension for backward compatibility (teamSize?: number)"
    - "Multiplier-based calibration with neutral baseline (1.0x = no change)"
    - "Confidence metadata pattern (level + reason string)"

key-files:
  created:
    - src/lib/team-calibration.ts
  modified:
    - src/lib/types.ts
    - src/lib/scoring.ts
    - src/lib/decompose.ts

key-decisions:
  - "Medium tier uses 1.0 multipliers as neutral baseline -- no teamSize produces mathematically identical scores to the original formula (except edge cases with no owners or single owner, which now use tier-aware baselines)"
  - "getThresholds(undefined) returns medium defaults, ensuring backward compatibility without conditional logic in computeHealth"
  - "Confidence is always returned (inferred when no teamSize, high when explicit) so consumers always have metadata"

patterns-established:
  - "Team-tier multiplier pattern: classify teamSize into tier, look up thresholds, apply multipliers before clamping"
  - "Optional field extension: all new HealthMetrics/Gap fields are optional with ? to avoid breaking existing stored workflows"

# Metrics
duration: 9min
completed: 2026-02-16
---

# Phase 2 Plan 1: Team-Size-Aware Scoring Engine Summary

**Team tier classification (solo/small/medium/large) with fragility and load-balance multipliers threaded through computeHealth and decomposeWorkflow -- backward compatible when no teamSize provided**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-16T19:24:28Z
- **Completed:** 2026-02-16T19:33:16Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created team-calibration module with tier classification and threshold multipliers (solo=1.8x, small=1.4x, medium=1.0x, large=0.8x fragility)
- Extended HealthMetrics and Gap types with optional confidence and teamSize fields
- Updated computeHealth() to apply team-tier multipliers to fragility and load-balance scores
- Threaded teamSize parameter through decomposeWorkflow() to computeHealth()
- Verified backward compatibility: computeHealth(steps, gaps) with no teamSize returns identical fragility scores to the original formula

## Task Commits

Each task was committed atomically:

1. **Task 1: Create team-calibration module and extend types** - `fbecc20` (feat)
2. **Task 2: Update computeHealth() and decomposeWorkflow() with team-size threading** - `6cd5e85` (feat)

## Files Created/Modified
- `src/lib/team-calibration.ts` - Team tier classification (getTeamTier), threshold constants (THRESHOLDS), and threshold lookup (getThresholds)
- `src/lib/types.ts` - Added ConfidenceLevel type, optional teamSize/confidence on HealthMetrics, optional confidence on Gap
- `src/lib/scoring.ts` - Added teamSize parameter, applies fragilityMultiplier and loadBalanceBaseline from team thresholds, returns confidence metadata
- `src/lib/decompose.ts` - Added teamSize parameter to decomposeWorkflow(), threads it to computeHealth()

## Decisions Made
- Medium tier uses 1.0 multipliers as the neutral baseline -- this means `getThresholds(undefined)` returns multipliers that produce mathematically identical scores to the pre-change formula for the common case (multiple owners)
- Confidence is always returned in the result (level: "inferred" when no teamSize, "high" when explicit), so downstream consumers always have metadata without null checks
- The `getThresholds` function accepts `null` in addition to `undefined` for defensive programming when callers pass through nullable values

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification Results

1. `npx tsc --noEmit` passes with zero errors
2. Existing code importing HealthMetrics, Gap, computeHealth, or decomposeWorkflow compiles without modification
3. `computeHealth(steps, gaps)` (no teamSize) returns fragility=55 matching the raw formula (1*20 + 1*10 + 1*15 + 2*5 = 55 with 1.0x multiplier)
4. `computeHealth(steps, gaps, 3)` returns fragility=77, `computeHealth(steps, gaps, 50)` returns fragility=44 -- small team scores higher fragility than large team
5. getTeamTier correctly classifies: 1=solo, 3=small, 10=medium, 25=large

## Next Phase Readiness
- Team calibration module ready for use by Phase 2 Plans 2 and 3
- API routes (decompose, crawl-site) call decomposeWorkflow without teamSize, so they continue working unchanged
- Next step: wire teamSize from API request body through to decomposeWorkflow (likely Plan 2 or 3)

## Self-Check: PASSED

- All 4 source files exist on disk
- All 2 task commits verified in git log (fbecc20, 6cd5e85)
- TypeScript compiles with zero errors

---
*Phase: 02-team-size-aware-analysis*
*Completed: 2026-02-16*
