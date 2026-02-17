---
phase: 04-reporting-export
plan: 01
subsystem: pdf-export
tags: [jspdf, html-to-image, react-flow, pdf, viewport-capture]

# Dependency graph
requires:
  - phase: 01-infrastructure-security
    provides: jsPDF-based PDF export files (pdf-export.ts, pdf-compare-export.ts, pdf-batch-export.ts, pdf-remediation-export.ts)
provides:
  - Shared PDF color palette and utilities (pdf-shared.ts)
  - React Flow viewport capture as PNG data URL (flow-capture.ts)
  - Optional flow diagram embedding in single-workflow PDF
affects: [04-02-PLAN, any future PDF export work]

# Tech tracking
tech-stack:
  added: [html-to-image@1.11.11]
  patterns: [shared PDF constants module, optional image embedding in jsPDF]

key-files:
  created:
    - src/lib/pdf-shared.ts
    - src/lib/flow-capture.ts
  modified:
    - src/lib/pdf-export.ts
    - src/lib/pdf-compare-export.ts
    - src/lib/pdf-batch-export.ts
    - src/lib/pdf-remediation-export.ts
    - package.json

key-decisions:
  - "Minimal-risk refactor: import PDF_COLORS and parse utilities from shared module, keep local helpers that close over mutable y variable"
  - "html-to-image pinned to 1.11.11 (newer versions have confirmed export bugs per React Flow docs)"
  - "Flow diagram section placed between Health Score Dashboard and Workflow Steps for logical report flow"
  - "2x capture resolution (2048x1200) for sharp text in printed PDF output"

patterns-established:
  - "PDF_COLORS shared constant: all PDF files import color palette from pdf-shared.ts"
  - "Optional parameter pattern: flowImageDataUrl is optional, section only renders when provided"

# Metrics
duration: 14min
completed: 2026-02-17
---

# Phase 4 Plan 1: PDF Shared Utilities and Flow Diagram Summary

**Shared PDF color palette extracted to pdf-shared.ts, React Flow viewport capture via html-to-image, and optional flow diagram embedding in single-workflow PDF export**

## Performance

- **Duration:** 14 min
- **Started:** 2026-02-17T19:21:40Z
- **Completed:** 2026-02-17T19:35:28Z
- **Tasks:** 2
- **Files modified:** 8 (2 created, 6 modified including package.json)

## Accomplishments
- Extracted duplicated color definitions and parse utilities from 4 PDF files into shared pdf-shared.ts module
- Created flow-capture.ts with captureFlowAsDataUrl for rendering React Flow viewport as PNG data URL at 2x resolution
- Enhanced exportToPdf with optional flowImageDataUrl parameter that embeds a "Flow Diagram" section in the PDF
- All existing PDF output unchanged (backward compatible -- same drawing calls, imported constants)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract shared PDF helpers and install html-to-image** - `1153ffb` (feat)
2. **Task 2: Embed flow diagram in single-workflow PDF export** - `f3ed726` (feat)

## Files Created/Modified
- `src/lib/pdf-shared.ts` - Shared PDF_COLORS palette, PdfContext type, checkPageBreak, drawSectionHeader, drawHorizontalRule, parseHexColor, parseSeverityColor, parseLayerColor, createPdfContext
- `src/lib/flow-capture.ts` - captureFlowAsDataUrl using html-to-image toPng with React Flow viewport bounds
- `src/lib/pdf-export.ts` - Imports from pdf-shared.ts, added optional flowImageDataUrl param with Flow Diagram section
- `src/lib/pdf-compare-export.ts` - Imports PDF_COLORS and parseHexColor from pdf-shared.ts
- `src/lib/pdf-batch-export.ts` - Imports PDF_COLORS, parseSeverityColor, parseLayerColor from pdf-shared.ts
- `src/lib/pdf-remediation-export.ts` - Imports PDF_COLORS from pdf-shared.ts (with orange accent override)
- `package.json` - Added html-to-image@1.11.11 dependency

## Decisions Made
- **Minimal-risk refactor approach:** Imported PDF_COLORS and parse utility functions from shared module, but kept local checkPageBreak/drawSectionHeader/drawHorizontalRule helpers that close over mutable `y` variable. This avoids restructuring the control flow of each PDF file while still eliminating ~60 lines of duplicated color definitions.
- **html-to-image@1.11.11 pinned:** Per React Flow documentation, newer versions have confirmed export bugs. Pinned exact version for stability.
- **Flow diagram placement:** Between Health Score Dashboard and Workflow Steps. This provides the visual map early in the report alongside health overview, before step-level detail.
- **2x capture resolution:** 2048x1200 capture rendered at ~170x100mm in PDF ensures sharp text and edges in printed output.
- **Caller responsibility for capture:** exportToPdf accepts the data URL but does not perform capture itself. The component hosting both React Flow and the export button must call captureFlowAsDataUrl and pass the result.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed getViewportForBounds missing padding argument**
- **Found during:** Task 1
- **Issue:** @xyflow/system's getViewportForBounds requires 6 arguments (bounds, width, height, minZoom, maxZoom, padding), but the plan specified only 5
- **Fix:** Added `0.1` padding parameter (10% padding around node bounds)
- **Files modified:** src/lib/flow-capture.ts
- **Verification:** npx tsc --noEmit passes
- **Committed in:** 1153ffb (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary fix for API compatibility. No scope creep.

## Issues Encountered
- `npm run build` fails during static page generation due to ENOENT errors on temp files in `.next/` directory. This is a pre-existing issue caused by OneDrive path sync (project is in "New folder (3)" on OneDrive). TypeScript compilation succeeds ("Compiled successfully"). This is not caused by our changes and is reproducible on the prior commit.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- pdf-shared.ts provides shared utilities for any future PDF work
- flow-capture.ts is ready for use by UI components that host React Flow
- The caller site (component with export button) still needs to be updated to pass flowImageDataUrl to exportToPdf -- this is a UI concern for plan 04-02 or component-level work
- All 4 existing PDF exports maintain identical visual output

## Self-Check: PASSED

All 7 files verified present. Both commit hashes (1153ffb, f3ed726) found in git history.

---
*Phase: 04-reporting-export*
*Completed: 2026-02-17*
