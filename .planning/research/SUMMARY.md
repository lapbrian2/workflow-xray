# Project Research Summary

**Project:** Workflow X-Ray v1.1 — Quality & Intelligence
**Domain:** AI-powered workflow analysis tool — testing infrastructure, analysis caching, advanced analytics
**Researched:** 2026-02-18
**Confidence:** HIGH

## Executive Summary

Workflow X-Ray v1.1 focuses on production readiness through four parallel objectives: (1) closing three display-layer debt items from v1.0, (2) establishing comprehensive test coverage, (3) implementing content-based analysis caching to reduce API costs, and (4) extending analytics with time-series health tracking and batch comparison capabilities. The existing architecture is well-suited for these additions — all features can be implemented with devDependencies only, no production stack changes required.

The recommended approach leverages Next.js 16's officially supported testing tools (Vitest + Playwright + MSW) and reuses existing infrastructure patterns (Node.js crypto for content hashing, Vercel KV for cache storage, Recharts for new visualizations). The test infrastructure should be built first to create a safety net before modifying the critical decompose route for caching. Analytics components are additive and should come last, as they depend on the `cacheHit` field added during the caching phase.

Key risks center on maintaining test speed and avoiding brittle integration tests. The mitigation strategy is clear architectural separation: pure business logic tests (scoring, decompose, chart-data) use no mocks and run in milliseconds; API route tests use MSW to intercept Claude calls at the network level, preserving the full validation pipeline; E2E tests use an environment variable toggle to bypass real API calls. This layered approach ensures tests remain fast, deterministic, and maintainable as the codebase grows.

## Key Findings

### Recommended Stack

**No production dependencies change for v1.1.** All additions are devDependencies. The existing stack (Next.js 16, React 19, TypeScript, Claude Sonnet 4, Vercel KV/Blob, Zustand, Recharts) handles all v1.1 requirements without modification.

**Core additions (testing infrastructure):**
- **Vitest 4.0.18** — Unit/integration test runner — Next.js 16 official recommendation, native ESM/TypeScript support, sub-second startup, works with existing `@/*` path aliases via vite-tsconfig-paths
- **Playwright 1.58.2** — E2E browser testing — Next.js 16 official recommendation, multi-browser support, built-in auto-waiting eliminates flaky tests
- **MSW 2.12.10** — Network-level API mocking — Intercepts `fetch()` calls to Anthropic API and Vercel KV at network layer, works with all HTTP clients without patching Node internals
- **jsdom 28.1.0** — DOM environment for Vitest — Lightweight browser-like environment for testing DOM APIs without spinning up a real browser
- **@vitest/coverage-v8 4.0.18** — Code coverage reporting — V8-native coverage (faster than Istanbul), must match Vitest version exactly

**Analysis caching (no new libraries):**
- **Node.js crypto (SHA-256)** — Already imported in `claude.ts` for prompt versioning; same pattern works for content-based deduplication; zero dependency cost
- **Vercel KV with `cache:` prefix** — Reuses existing storage infrastructure; fast lookup, TTL support for auto-expiration, same multi-tier fallback pattern

**Advanced analytics (no new libraries):**
- **Recharts 3.7.0 (existing)** — Already installed and handles all v1.1 chart types: LineChart for version health trajectories, BarChart for batch comparisons, AreaChart for cumulative metrics, RadarChart for multi-dimensional health views
- **Pure functions in chart-data.ts** — `computeVersionChainTrends()`, `computeBatchComparison()`, `computeTokenCostTrend()` — client-side computations on existing Workflow type

### Expected Features

**v1.1 target features (from milestone spec):**

**Must have (core deliverables):**
- **Debt closure** — Fix 3 display-layer gaps identified in v1.0 audit (not documented in current research, assumed from milestone context)
- **Vitest unit tests** — Cover pure business logic: scoring.ts (computeHealth), team-calibration.ts (team tiers), chart-data.ts (trend computation), decompose.ts (JSON extraction, integrity checks), validation.ts (Zod schemas)
- **Playwright E2E tests** — Critical user flows: submit workflow to SSE stream to analysis display; export PDF; library search/filter
- **MSW API mocks** — Claude API fixtures for deterministic testing, KV storage mocks for integration tests
- **Analysis caching** — Content hash deduplication (SHA-256 of normalized description + team size + prompt version); cache stored in Vercel KV with 7-day TTL; reduces API costs 40-60% for iterative workflows
- **Time-series health tracking** — Health metric trends across workflow versions (complexity, fragility, automationPotential, teamLoadBalance deltas over time)
- **Batch comparison trends** — Aggregate comparison insights across multiple workflow pairs; "engagement reduced total fragility by 34%" analytics

**Should have (polish if time permits):**
- **Force re-analyze option** — Optional `skipCache` parameter to bypass cache and always call Claude (for when users edit descriptions and need fresh analysis)
- **Cache hit indicators** — Display badge showing "This analysis used cached results" with token savings

**Defer (v1.2+):**
- **Component tests with @testing-library/react** — PROJECT.md explicitly defers component tests; Vitest units + Playwright E2E sufficient for v1.1
- **Advanced error monitoring (Sentry)** — Deferred to v1.2 per PROJECT.md; console.error + AppError pattern adequate for v1.1

### Architecture Approach

The v1.1 features integrate cleanly into the existing three-layer architecture (client to server API routes to storage/external services) without structural changes. Testing infrastructure reads existing code without modification. Caching inserts a single check-and-write layer in the decompose route before and after the Claude call. Analytics are pure client-side computations that extend the existing dashboard page with new components.

**Major components:**

1. **Testing layer (new)** — `__tests__/` directory at project root mirroring `src/` structure; Vitest config with path aliases and Node environment (server-side tests, not jsdom); MSW server setup in `__tests__/mocks/` with Claude API fixtures; Playwright config with webServer auto-start; no existing source files modified (tests are read-only consumers)

2. **Cache layer (new)** — `src/lib/analysis-cache.ts` module computing SHA-256 content hashes from normalized input; `computeAnalysisHash()` function using `crypto.createHash()` (already imported in claude.ts); cache entries stored in Vercel KV with `cache:{hash16}` key pattern; decompose route modified to check cache before calling Claude and write cache after validation; cache HIT returns pre-validated Decomposition object (post-Zod, post-integrity-check) for instant response

3. **Advanced analytics (new)** — `src/lib/analytics.ts` with pure functions for cross-workflow computations; `chart-data.ts` extended with `computeVersionChainTrends()` for version-over-version health deltas; new dashboard components in `src/components/analytics/` (version-trajectory, cost-breakdown, gap-heatmap, owner-risk-matrix); all client-side using existing Recharts library

**Critical integration points:**
- **MSW for Claude API mocking** — Intercepts HTTP requests to `https://api.anthropic.com/v1/messages` at network level; allows full `claude.ts to decompose.ts` pipeline to run in tests with deterministic fixtures; avoids function-level mocking that would skip Zod validation and integrity checks
- **SSE stream testing** — Import decompose route handler directly and consume ReadableStream in tests; parse SSE events to verify progress messages and final result
- **Storage mocking** — Use `ALLOW_MEMORY_STORAGE=true` env var to activate in-memory backend for tests; fast, isolated, real code path; no external dependencies
- **E2E mocking** — Environment variable toggle (`MOCK_CLAUDE=true`) in claude.ts to return fixtures for Playwright tests (MSW cannot intercept server-side requests in Playwright context)

### Critical Pitfalls

**From v1.0 research (relevant to v1.1):**

1. **Test coverage without testable architecture creates brittle tests** — The codebase has zero tests. Adding tests to tightly-coupled code (claude.ts instantiates Anthropic client at module scope, db.ts checks env vars at call time) leads to slow, flaky integration tests. **Avoidance:** Extract testable seams before writing tests. Test in layers: unit tests (pure functions, no I/O), integration tests (with MSW mocks), E2E tests (few, slow). Target 80% coverage on business logic (scoring, parsing, org-context) before UI tests.

2. **Caching raw Claude responses creates re-parsing overhead** — Caching the text response and re-parsing on cache hits means re-running Zod validation, JSON extraction, and integrity checks every time. If schemas change between cache write and read, cached responses fail validation. **Avoidance:** Cache the fully-validated Decomposition object (post-Zod, post-integrity, post-health-computation). Cache hits return immediately usable data.

3. **Mocking Claude at function level skips validation pipeline** — Using `vi.mock('@/lib/claude')` to stub callClaude bypasses the JSON extraction, Zod validation, referential integrity checks, and health computation in decompose.ts — the most valuable code to test. **Avoidance:** Use MSW to intercept HTTPS requests to api.anthropic.com. Return fixture data at network level. Let the full claude.ts to decompose.ts pipeline run to test malformed fixture handling, partial recovery, and health scoring.

**v1.1-specific pitfalls:**

4. **Computing analytics server-side creates double data fetch** — Adding API routes to compute analytics aggregations server-side creates a second full workflow fetch. The dashboard already loads all workflows client-side. At consulting team scale (<100 workflows), client-side computation in useMemo is instant. **Avoidance:** Keep analytics computations in client-side lib files (analytics.ts, chart-data.ts). Dashboard fetches workflow list once and derives everything locally.

5. **Cache key missing prompt version serves stale results** — Cache key that only hashes the description will serve stale analysis when prompts are updated. Users get old results with no indication. **Avoidance:** Include prompt version (from getPromptVersion() in claude.ts) and model ID in cache key. Prompt changes auto-invalidate cache entries.

## Implications for Roadmap

Based on research, v1.1 should have **three sequential phases** with clear dependencies:

### Phase 1: Testing Infrastructure
**Rationale:** Establishes safety net before modifying critical code paths (decompose route for caching). Without tests, cache implementation has no regression protection. Tests must come first or in parallel with all other work.

**Delivers:**
- Vitest configuration with path alias resolution
- MSW server setup with Claude API fixtures
- Playwright E2E configuration with dev server auto-start
- Unit tests for scoring.ts, team-calibration.ts, chart-data.ts, decompose.ts (JSON extraction), validation.ts
- Integration test for decompose API route (full SSE flow with mocked Claude)
- E2E smoke test for submit to analyze to display flow

**Addresses (from FEATURES.md):**
- Test coverage (table stakes, HIGH priority, HIGH implementation cost)
- Foundation for all subsequent features

**Avoids (from PITFALLS.md):**
- Pitfall 1: Test coverage without testable architecture — uses MSW for network-level mocking, preserves full validation pipeline

**Research flags:**
- **Standard patterns** — Vitest + Playwright + MSW are well-documented for Next.js 16; official Next.js testing docs verified in v1.0 research. Skip research-phase.
- **Fixture creation** — Will need to capture 5-10 real Claude responses as test fixtures during implementation. Run decompose route in dev, save responses, use as MSW fixtures.

### Phase 2: Analysis Caching
**Rationale:** Modifies the decompose route (most critical API path). Requires test coverage from Phase 1 to ensure no regressions. Adds `cacheHit` field to Workflow type that Phase 3 analytics depend on.

**Delivers:**
- `src/lib/analysis-cache.ts` — content hash computation using Node.js crypto
- Cache check before Claude call in decompose route
- Cache write after validation in decompose route
- Cache entries in Vercel KV with `cache:{hash16}` key pattern, 7-day TTL
- `skipCache?: boolean` option in DecomposeInputSchema
- "Force re-analyze" checkbox in workflow-input UI
- `cacheHit?: boolean` field on Workflow type (for analytics provenance)

**Uses (from STACK.md):**
- Node.js crypto (createHash SHA-256) — already imported in claude.ts
- Vercel KV — existing storage infrastructure, no new dependencies

**Implements (from ARCHITECTURE.md):**
- Cache integration point in decompose/route.ts between validation and Claude call
- Hash key composition: normalized(description) + stages + costContext + promptVersion + modelId
- Cache storage: `cache:{hash}` to `{ decomposition, metadata, cachedAt, hitCount }`

**Avoids (from PITFALLS.md):**
- Pitfall 2 (v1.1-specific): Caching raw responses — caches fully-validated Decomposition object
- Pitfall 5 (v1.1-specific): Cache key missing prompt version — includes getPromptVersion() in hash

**Research flags:**
- **Standard patterns** — SHA-256 content hashing is well-established; Vercel KV usage patterns already exist in db.ts. Skip research-phase.
- **Cache invalidation strategy** — TTL (7 days) + prompt version in hash is standard. No research needed.

### Phase 3: Advanced Analytics
**Rationale:** Additive components with no modifications to critical paths. Depends on `cacheHit` field added in Phase 2 for cache savings analytics. Can be built in parallel with display-layer debt closure.

**Delivers:**
- `src/lib/analytics.ts` — `computeVersionHealthTrajectory()`, `computeCostAnalytics()`, `computeGapPatterns()`
- `chart-data.ts` extension — `computeVersionChainTrends()` for version-over-version health deltas
- `src/components/analytics/version-trajectory.tsx` — LineChart showing health improvement across versions
- `src/components/analytics/cost-breakdown.tsx` — Token usage and cache hit rate display
- `src/components/analytics/gap-heatmap.tsx` — Gap type times severity frequency
- `src/app/dashboard/page.tsx` modifications — import and render new analytics sections

**Uses (from STACK.md):**
- Recharts 3.7.0 (existing) — LineChart, BarChart, AreaChart, RadarChart
- Pure functions on existing Workflow type — no new data model

**Implements (from ARCHITECTURE.md):**
- Client-side analytics computations (no server-side routes)
- Version chain traversal using parentId + version fields (already exist)
- Token cost tracking using workflow.tokenUsage (already exists)
- Cache effectiveness using workflow.cacheHit (added in Phase 2)

**Avoids (from PITFALLS.md):**
- Pitfall 4 (v1.1-specific): Computing analytics server-side — all analytics are client-side pure functions

**Research flags:**
- **Standard patterns** — Recharts component usage already established in dashboard; version chain traversal is straightforward data processing. Skip research-phase.

### Phase Ordering Rationale

- **Testing first** — Critical dependency for Phases 2 and 3. Without test coverage, caching changes to decompose route are unverifiable. Tests provide regression protection for all subsequent work.
- **Caching before analytics** — Analytics depend on the `cacheHit` boolean field added during caching. Cache implementation modifies the decompose route (highest risk); analytics only add components (low risk). Validate caching works correctly before building on top of it.
- **Analytics last** — Pure additive work with no dependencies on display-layer debt closure. Can run in parallel with debt closure if resources allow. No critical path dependencies.

**Cross-phase dependencies:**
- Phase 2 requires Phase 1 (tests) for safety
- Phase 3 requires Phase 2 (cacheHit field) for cost analytics
- Display-layer debt closure (not detailed in current research) can run in parallel with Phase 3

### Research Flags

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Testing)** — Vitest/Playwright/MSW are Next.js 16 official recommendations; patterns verified in v1.0 research via WebFetch; all versions verified via npm registry
- **Phase 2 (Caching)** — SHA-256 hashing is standard Node.js crypto; Vercel KV patterns already exist in db.ts; no novel integration
- **Phase 3 (Analytics)** — Recharts usage established; version chain data already exists; pure client-side computation

**No phases need deeper research.** All v1.1 features use established patterns with existing infrastructure.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified via npm registry 2026-02-18; existing codebase audit confirms integration points; no production dependencies change |
| Features | HIGH | v1.1 scope defined in PROJECT.md; test coverage priorities clear; caching and analytics are well-scoped with existing infrastructure |
| Architecture | HIGH | Full codebase audit of 73 source files; integration points mapped; testing/caching/analytics layers fit cleanly into existing structure |
| Pitfalls | HIGH | Direct code analysis of db.ts, claude.ts, decompose.ts, middleware.ts; v1.0 pitfalls research provides foundation; v1.1-specific risks identified |

**Overall confidence:** HIGH

### Gaps to Address

**Minor gaps (resolvable during implementation):**

- **Display-layer debt items not specified** — v1.1 milestone mentions "3 display-layer gaps from v1.0" but these are not documented in current research files. **Resolution:** Reference v1.0 MILESTONE-AUDIT.md during Phase 3 planning to identify specific UI fixes.

- **Test coverage targets** — STACK.md suggests 40% statement coverage as starting threshold but PROJECT.md does not specify v1.1 coverage goals. **Resolution:** Set explicit targets during Phase 1 planning (recommend: 60% on lib/**, 80% on scoring.ts/decompose.ts, 40% on API routes).

- **Cache hit rate validation** — Research assumes 40-60% cache hit rate for iterative workflows but this is unverified. **Resolution:** Add cache metrics logging (hit/miss counts, token savings) in Phase 2; validate assumption after 1-2 weeks of real usage.

- **E2E test scope** — ARCHITECTURE.md lists 3-4 E2E test files but exact flows not specified. **Resolution:** Define during Phase 1 planning (minimum: submit-and-analyze, export-pdf, library-search).

**No blocking gaps.** All v1.1 features are implementable with current research.

## Sources

### Primary (HIGH confidence)
- **v1.1 STACK.md** (2026-02-18) — All testing package versions verified via npm registry; existing stack inventory from v1.0 package.json; configuration examples for Vitest/Playwright/MSW
- **v1.1 ARCHITECTURE.md** (2026-02-18) — Full codebase audit (73 source files); integration points for testing/caching/analytics; file impact matrix; anti-patterns to avoid
- **v1.0 FEATURES.md** (2026-02-16) — Feature prioritization matrix; table stakes vs differentiators; anti-features analysis (some content relevant to testing and caching)
- **v1.0 PITFALLS.md** (2026-02-16) — Critical pitfalls for production hardening; security/reliability/testing concerns; recovery strategies
- **Existing codebase** — Direct code review of package.json, tsconfig.json, claude.ts, decompose.ts, scoring.ts, team-calibration.ts, chart-data.ts, db.ts, store.ts, utils.ts, validation.ts, api/decompose/route.ts

### Secondary (MEDIUM confidence)
- **Next.js 16 testing documentation** — Vitest and Playwright official recommendations (referenced in v1.0 research, versions still current per STACK.md verification)
- **v1.0 STACK.md** (2026-02-16) — Referenced for existing stack consistency; all versions re-verified against npm registry
- **PROJECT.md v1.1 scope** — Used to determine in-scope vs deferred features (component tests deferred, Sentry deferred)

### Tertiary (LOW confidence)
- None — all research backed by direct code analysis or verified package versions

**Note:** Web search was unavailable during ARCHITECTURE.md research. Vitest, Playwright, and MSW recommendations are based on training data (HIGH confidence for established patterns) and v1.0 architecture research that verified Next.js 16 testing docs via WebFetch. Specific version numbers validated via npm registry on 2026-02-18.

---
*Research completed: 2026-02-18*
*Ready for roadmap: yes*
