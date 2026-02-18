---
phase: 05-debt-closure-test-infrastructure
plan: 03
subsystem: testing
tags: [vitest, msw, playwright, e2e, decompose, mock-claude, integration-tests]

# Dependency graph
requires:
  - phase: 05-debt-closure-test-infrastructure
    plan: 02
    provides: "Vitest + MSW test infrastructure, factory fixtures, network-level Anthropic API mocking"
provides:
  - "10 decompose pipeline integration tests covering JSON extraction, partial recovery, referential integrity, and team size"
  - "MOCK_CLAUDE env toggle for zero-cost E2E testing without real Claude API calls"
  - "Playwright E2E test covering full submit-analyze-view-export critical path"
  - "test:e2e script for running E2E tests"
affects: [06-caching, 07-analytics]

# Tech tracking
tech-stack:
  added: ["@playwright/test"]
  patterns: [MOCK_CLAUDE-toggle, playwright-e2e, decompose-pipeline-integration-tests]

key-files:
  created:
    - __tests__/lib/decompose.test.ts
    - playwright.config.ts
    - e2e/submit-workflow.spec.ts
  modified:
    - src/lib/claude.ts
    - package.json
    - package-lock.json

key-decisions:
  - "Dummy ANTHROPIC_API_KEY in tests to pass SDK client-side header validation before MSW intercepts"
  - "MOCK_CLAUDE toggle as early-return in each callClaude* function rather than MSW for E2E (Next.js server runs in separate process)"
  - "Playwright webServer env object for cross-platform compatibility instead of inline env vars in command"

patterns-established:
  - "MOCK_CLAUDE=true env toggle bypasses all Claude API calls with deterministic responses"
  - "E2E tests in e2e/ directory using Playwright with webServer auto-start"
  - "Decompose pipeline tests use server.use() per-test overrides for custom response scenarios"

# Metrics
duration: 12min
completed: 2026-02-18
---

# Phase 5 Plan 3: Decompose Pipeline Tests and E2E Summary

**10 decompose pipeline integration tests with MSW network interception plus Playwright E2E test covering the full submit-analyze-view-export flow using MOCK_CLAUDE toggle**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-18T12:59:41Z
- **Completed:** 2026-02-18T13:11:28Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- 10 decompose pipeline tests covering happy path, partial recovery, total failure, 4 referential integrity scenarios (duplicates, invalid deps, self-refs, cycles), team size integration, and 2 JSON extraction strategies -- all using MSW network-level interception
- MOCK_CLAUDE env toggle added to claude.ts with deterministic mock responses for decompose, extraction, and remediation functions
- Playwright E2E test covering the full critical path: navigate to home, enter workflow description, click Decompose, observe SSE progress, view results page with steps/gaps/tabs, and export PDF download
- Total test suite now at 41 unit/integration tests across 4 suites, plus 1 E2E test

## Task Commits

Each task was committed atomically:

1. **Task 1: Decompose pipeline unit tests with MSW** - `7fab428` (test)
2. **Task 2: MOCK_CLAUDE toggle, Playwright config, and E2E test** - `15510c9` (feat)

## Files Created/Modified
- `__tests__/lib/decompose.test.ts` - 10 integration tests for decomposeWorkflow pipeline using MSW
- `src/lib/claude.ts` - Added MOCK_CLAUDE toggle with getMockDecomposeResponse, getMockExtractionResponse, getMockRemediationResponse
- `playwright.config.ts` - Playwright configuration with webServer auto-start, MOCK_CLAUDE env, cross-platform env handling
- `e2e/submit-workflow.spec.ts` - E2E test for full submit-analyze-view-export flow
- `package.json` - Added test:e2e script, @playwright/test dev dependency
- `package-lock.json` - Lockfile updated

## Decisions Made
- Set dummy ANTHROPIC_API_KEY in test environment because the Anthropic SDK validates API key headers client-side before making the HTTP request (before MSW can intercept). This is a non-functional key that satisfies SDK validation while MSW handles the actual response.
- Used MOCK_CLAUDE env toggle (early-return in each callClaude function) for E2E testing instead of MSW because the Next.js dev server runs as a separate process from Playwright and MSW only intercepts within the Node.js process where it's initialized.
- Used Playwright webServer `env` object rather than inline env vars in `command` for cross-platform Windows/Linux/Mac compatibility.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added ANTHROPIC_API_KEY env var to test setup**
- **Found during:** Task 1 (decompose pipeline tests)
- **Issue:** All 10 tests failed with "Could not resolve authentication method" -- the Anthropic SDK validates API key headers before making the HTTP request, so MSW never gets a chance to intercept
- **Fix:** Added `process.env.ANTHROPIC_API_KEY = "test-key-for-msw"` in test beforeAll
- **Files modified:** `__tests__/lib/decompose.test.ts`
- **Verification:** All 10 tests pass after the fix
- **Committed in:** `7fab428` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for SDK compatibility. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required
None - no external service configuration required. All tests run with mock data.

## Next Phase Readiness
- Complete test safety net established: 41 unit/integration tests + 1 E2E test
- All 4 core lib modules have test coverage (scoring, team-calibration, chart-data, decompose)
- MOCK_CLAUDE toggle available for any future E2E testing needs
- Playwright infrastructure ready for additional E2E scenarios
- Phase 5 is now complete -- ready for Phase 6 (Caching)

## Self-Check: PASSED

- All 5 key files verified present on disk
- Both task commits verified in git log (7fab428, 15510c9)

---
*Phase: 05-debt-closure-test-infrastructure*
*Completed: 2026-02-18*
