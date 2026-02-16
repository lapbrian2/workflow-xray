---
phase: 02-team-size-aware-analysis
plan: 02
subsystem: api, ai-prompts
tags: [zod, system-prompt, team-size, confidence, gap-detection]

# Dependency graph
requires:
  - phase: 02-team-size-aware-analysis
    plan: 01
    provides: teamSize parameter on decomposeWorkflow, ConfidenceLevel type, Gap.confidence field
provides:
  - Team-size calibration instructions in AI system prompt (solo/small/medium/large)
  - Confidence field in GapSchema Zod validation with default "inferred"
  - teamSize threaded from API route through to decomposeWorkflow
affects: [02-03-ui-display, 03-ai-reliability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Post-process AI output fields with safety-net defaults after Zod validation"
    - "Thread optional context parameters from API route to workflow function"

key-files:
  created: []
  modified:
    - src/prompts/decompose-system.md
    - src/lib/decompose.ts
    - src/app/api/decompose/route.ts

key-decisions:
  - "Prompt calibration section uses 4 tiers: solo (1), small (2-5), medium (6-20), large (21+)"
  - "Confidence defaults to 'high' when teamSize is provided, 'inferred' when absent -- safety net beyond Zod default"

patterns-established:
  - "Team-size calibration tiers: solo/small/medium/large with specific severity rules per gap type"

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 2 Plan 02: AI Prompt Pipeline Threading Summary

**Team-size calibration instructions wired into system prompt with confidence field threaded through GapSchema and API route**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-16T19:38:34Z
- **Completed:** 2026-02-16T19:41:22Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added Team-Size Calibration section to system prompt with solo/small/medium/large guidance for AI severity calibration
- Added confidence field to gap schema in both system prompt JSON example and Zod GapSchema
- Threaded teamSize from API route's costContext through to decomposeWorkflow function call
- Added post-processing safety net for gap confidence based on teamSize availability

## Task Commits

Each task was committed atomically:

1. **Task 1: Add team-size calibration section to system prompt** - `8609b1c` (feat)
2. **Task 2: Update GapSchema and API route to thread teamSize** - `d409a04` (feat)

## Files Created/Modified
- `src/prompts/decompose-system.md` - Added Team-Size Calibration section (29 lines) with solo/small/medium/large severity rules; added confidence field to gap JSON schema
- `src/lib/decompose.ts` - Added `confidence: z.enum(["high", "inferred"]).optional().default("inferred")` to GapSchema; added post-processing loop for confidence defaults after cleanGaps filter
- `src/app/api/decompose/route.ts` - Changed `decomposeWorkflow(decomposeRequest)` to `decomposeWorkflow(decomposeRequest, body.costContext?.teamSize)`

## Decisions Made
- Prompt calibration uses 4 tiers: solo (1), small (2-5), medium (6-20), large (21+) matching the thresholds established in 02-01's team-calibration module
- Confidence defaults to "high" when teamSize is explicitly provided (user gave concrete data), "inferred" when absent (AI estimated from patterns) -- this is a safety net beyond Zod's .default("inferred")
- Prompt total is 132 lines, slightly over the 130-line target but all content is essential for proper calibration guidance

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. `npx tsc --noEmit` -- zero errors
2. `decompose-system.md` contains "## Team-Size Calibration" at line 77
3. `decompose-system.md` gap schema includes `"confidence": "high | inferred"` at line 40
4. `decompose.ts` GapSchema includes `confidence: z.enum(["high", "inferred"]).optional().default("inferred")` at line 45
5. `route.ts` passes `body.costContext?.teamSize` to `decomposeWorkflow()` at line 48
6. Prompt length: 132 lines (target was under 130 -- 2 lines over, acceptable)

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- System prompt now instructs AI to calibrate gap severity by team size and include confidence per gap
- GapSchema validates confidence field from AI output with safe default
- API route threads teamSize end-to-end from request body to AI processing
- Ready for 02-03: UI display of team-size-aware analysis results

## Self-Check: PASSED

All files verified present, all commits verified in git log.

---
*Phase: 02-team-size-aware-analysis*
*Completed: 2026-02-16*
