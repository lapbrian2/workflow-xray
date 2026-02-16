---
phase: 02-team-size-aware-analysis
plan: 03
subsystem: ui
tags: [react, confidence-badge, team-context, conditional-rendering]

# Dependency graph
requires:
  - phase: 02-team-size-aware-analysis
    provides: ConfidenceLevel type, Gap.confidence, HealthMetrics.teamSize, HealthMetrics.confidence, CostContext.teamSize/teamContext
provides:
  - ConfidenceBadge reusable component for high/inferred confidence display
  - Team context banners in gap-analysis, health-card, and xray results page
  - Confidence indicators on individual gap cards
affects: [02-team-size-aware-analysis, ui, reporting, pdf-export]

# Tech tracking
tech-stack:
  added: []
  patterns: [conditional-rendering-for-backward-compat, inline-styles-with-css-variables]

key-files:
  created:
    - src/components/confidence-badge.tsx
  modified:
    - src/components/gap-card.tsx
    - src/components/gap-analysis.tsx
    - src/components/health-card.tsx
    - src/app/xray/[id]/page.tsx

key-decisions:
  - "ConfidenceBadge uses cursor:help when context tooltip is provided for discoverability"
  - "All team context rendering is conditional to maintain backward compatibility with pre-existing workflows"

patterns-established:
  - "Confidence badge pattern: reusable component for high/inferred indicators across the app"
  - "Team context banner pattern: consistent blue-tinted info bar for team-size calibration messaging"

# Metrics
duration: 4min
completed: 2026-02-16
---

# Phase 2 Plan 3: Team-Size UI Layer Summary

**ConfidenceBadge component and team-size context banners across gap-analysis, health-card, and xray results page with fully conditional rendering**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-16T19:39:09Z
- **Completed:** 2026-02-16T19:43:40Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created ConfidenceBadge reusable component with high (green) and inferred (amber) visual indicators
- Integrated confidence badges into gap-card headers, showing per-gap confidence when available
- Added team-size calibration context banners to gap-analysis, health-card, and the main xray results page
- All new UI is conditionally rendered -- old workflows without team-size data render identically

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ConfidenceBadge and update gap-card** - `919e532` (feat)
2. **Task 2: Add team context to gap-analysis, health-card, and xray page** - `84602f8` (feat)

## Files Created/Modified
- `src/components/confidence-badge.tsx` - NEW: Reusable badge showing "High Confidence" (green) or "Inferred" (amber) with tooltip support
- `src/components/gap-card.tsx` - Added ConfidenceBadge import and conditional rendering in header between gap type label and severity pill
- `src/components/gap-analysis.tsx` - Added teamSize/teamContext props and team calibration header banner
- `src/components/health-card.tsx` - Added teamSize/confidence props, ConfidenceBadge import, and calibration context line after Health Breakdown label
- `src/app/xray/[id]/page.tsx` - Added team context banner, passes teamSize/teamContext to GapAnalysis and teamSize/confidence to HealthCard

## Decisions Made
- Used `cursor: "help"` on ConfidenceBadge when a context tooltip is provided, improving discoverability of the tooltip
- All rendering uses conditional guards (`gap.confidence &&`, `teamSize &&`, `workflow.costContext?.teamSize &&`) to ensure zero visual changes for workflows without team-size data

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UI layer for team-size-aware analysis is complete
- ConfidenceBadge is reusable for any future component needing confidence indicators
- Phase 2 plans are complete (01: scoring engine, 02: prompt integration, 03: UI layer)

## Self-Check: PASSED

All files verified present. All commit hashes verified in git log.

---
*Phase: 02-team-size-aware-analysis*
*Completed: 2026-02-16*
