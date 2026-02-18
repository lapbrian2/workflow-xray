# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Teams can submit any workflow description and receive an accurate, actionable diagnostic -- with team-size-aware analysis -- that reveals bottlenecks, gaps, and automation opportunities they couldn't see before.
**Current focus:** Phase 7: Advanced Analytics (v1.1)

## Current Position

Phase: 7 of 7 (Advanced Analytics)
Plan: 2 plans in 2 waves — ready to execute
Status: Planned (verified 4/4 ANLZ requirements)
Last activity: 2026-02-18 — Phase 7 planned (07-01 analytics engine + charts, 07-02 cost/heatmap + dashboard)

Progress: [████████████████████████████░░] 90% (v1.0: 11/11) | v1.1: [████████░░] 5/7 (Phase 7 planned)

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 11 (4 Phase 1 + 3 Phase 2 + 2 Phase 3 + 2 Phase 4)
- Average duration: ~8 min/plan
- Total execution time: ~92 min

**v1.1:**
- 05-01: 8 min, 3 tasks, 4 files modified
- 05-02: 9 min, 3 tasks, 10 files modified
- 05-03: 12 min, 2 tasks, 6 files modified
- 06-01: 5 min, 3 tasks (TDD), 4 files modified
- 06-02: 5 min, 2 tasks, 4 files modified

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.1 Roadmap]: Debt closure combined with test infrastructure (Phase 5) so debt fixes become first test targets
- [v1.1 Roadmap]: Caching before analytics because ANLZ-03 depends on cacheHit field added in Phase 6
- [v1.1 Roadmap]: All analytics client-side (no server routes) to avoid double data fetch
- [05-01]: Used direct toPng capture instead of captureFlowAsDataUrl to avoid node-position dependency
- [05-01]: Confidence badges positioned to left of score value using font measurement for alignment
- [05-02]: Node environment (not jsdom) for pure function tests -- no DOM needed
- [05-02]: MSW at network level for Anthropic API mocking -- enables decompose pipeline tests in 05-03
- [05-02]: Factory pattern (makeStep/makeGap/makeWorkflow) for reusable test data
- [05-03]: Dummy ANTHROPIC_API_KEY in tests to pass SDK client-side header validation before MSW intercepts
- [05-03]: MOCK_CLAUDE toggle as early-return in callClaude functions for E2E (Next.js server separate process from Playwright)
- [05-03]: Playwright webServer env object for cross-platform compatibility
- [06-01]: Test file at __tests__/lib/ (project convention) not src/__tests__/ (plan path)
- [06-01]: Hash excludes hourlyRate/hoursPerStep (display-only, don't affect Claude analysis)
- [06-01]: 7-day TTL for KV cache; hitCount incremented on read for accurate tracking
- [06-02]: cachedAt added to Workflow type in Task 1 (moved from Task 2) due to compilation dependency
- [06-02]: Fresh workflow ID generated per cached submission (each submission = distinct KV entry)
- [06-02]: Cache write non-critical (try/catch, logged, never blocks user)

### Pending Todos

None.

### Blockers/Concerns

- Vercel KV race conditions on workflow:ids array (identified in v1.0, not yet fixed)
- Per-isolate rate limiting ineffective in production (deferred, acceptable at team scale)
- OneDrive path causes npm run build static generation failures (TypeScript compiles fine)

## Session Continuity

Last session: 2026-02-18
Stopped at: Phase 7 planned (2 plans, 2 waves, verified). Next: execute Phase 7.
Resume file: None
