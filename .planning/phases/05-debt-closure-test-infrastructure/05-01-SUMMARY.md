---
phase: 05-debt-closure-test-infrastructure
plan: 01
subsystem: ui, api, pdf
tags: [react, pdf, jspdf, team-calibration, partial-results, html-to-image]

# Dependency graph
requires:
  - phase: 02-team-size-aware-analysis
    provides: "Team calibration module (getTeamTier) and team-aware health scores"
  - phase: 03-ai-reliability
    provides: "Partial result recovery (_partial/_recoveryReason from decomposeWorkflow)"
  - phase: 04-reporting-export
    provides: "PDF export infrastructure (exportToPdf, flow-capture, pdf-shared)"
provides:
  - "Partial result warning banner on xray page"
  - "Team calibration context section in PDF exports"
  - "Confidence badges (calibrated/estimated) next to PDF health scores"
  - "Flow diagram capture wired into PDF export button"
affects: [05-debt-closure-test-infrastructure]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional banner rendering based on workflow flags (_partial)"
    - "Dynamic import of html-to-image for flow capture in handleExportPdf"

key-files:
  created: []
  modified:
    - "src/lib/types.ts"
    - "src/app/api/decompose/route.ts"
    - "src/app/xray/[id]/page.tsx"
    - "src/lib/pdf-export.ts"

key-decisions:
  - "Used direct toPng capture instead of captureFlowAsDataUrl to avoid node-position dependency"
  - "Confidence badges positioned to left of score value using font measurement for alignment"

patterns-established:
  - "data-testid attributes on conditional UI banners for future testing"

# Metrics
duration: 8min
completed: 2026-02-18
---

# Phase 5 Plan 01: Display-Layer Debt Closure Summary

**Partial result warning banner, team calibration context in PDF exports, and flow diagram capture wired to PDF export button**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-18T12:42:03Z
- **Completed:** 2026-02-18T12:50:07Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Workflow type extended with `_partial` and `_recoveryReason` fields, persisted through the decompose API route
- Amber warning banner renders on xray page when viewing partial/recovered analysis results
- PDF exports include a Team Calibration Context section showing team size, tier, and calibration notes (conditional on teamSize)
- Confidence badges (calibrated/estimated) appear next to each health score bar in the PDF
- Flow diagram capture via html-to-image toPng integrated into the PDF export button with graceful fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Add partial result warning banner and persist _partial flag** - `c6aefc3` (feat)
2. **Task 2: Add team context and confidence indicators to PDF exports** - `19803f4` (feat)
3. **Task 3: Wire flow diagram capture to PDF export button** - `51530a6` (feat)

## Files Created/Modified
- `src/lib/types.ts` - Added _partial and _recoveryReason optional fields to Workflow interface
- `src/app/api/decompose/route.ts` - Spread _partial/_recoveryReason into saved workflow object
- `src/app/xray/[id]/page.tsx` - Partial warning banner + flow capture in handleExportPdf
- `src/lib/pdf-export.ts` - Team Calibration Context section + confidence badges on health scores

## Decisions Made
- Used direct `toPng` capture of `.react-flow__viewport` instead of `captureFlowAsDataUrl` to avoid requiring accurate React Flow node positions from outside the XRayViz component
- Confidence badges use font measurement (`getTextWidth`) for precise positioning to the left of health score values

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All three display-layer debt items closed
- Ready for 05-02 (test infrastructure setup) and 05-03 execution
- No blockers identified

## Self-Check: PASSED

- [x] src/lib/types.ts - FOUND
- [x] src/app/api/decompose/route.ts - FOUND
- [x] src/app/xray/[id]/page.tsx - FOUND
- [x] src/lib/pdf-export.ts - FOUND
- [x] 05-01-SUMMARY.md - FOUND
- [x] Commit c6aefc3 - FOUND
- [x] Commit 19803f4 - FOUND
- [x] Commit 51530a6 - FOUND

---
*Phase: 05-debt-closure-test-infrastructure*
*Completed: 2026-02-18*
