# Roadmap: Workflow X-Ray

## Milestones

- ✅ **v1.0 Consulting-Grade Diagnostic Engine** — Phases 1-4 (shipped 2026-02-17) | [Archive](milestones/v1.0-ROADMAP.md)
- **v1.1 Quality & Intelligence** — Phases 5-7 (in progress)

## Phases

<details>
<summary>v1.0 Consulting-Grade Diagnostic Engine (Phases 1-4) — SHIPPED 2026-02-17</summary>

- [x] Phase 1: Infrastructure & Security (4/4 plans) — completed 2026-02-16
- [x] Phase 2: Team-Size-Aware Analysis (3/3 plans) — completed 2026-02-16
- [x] Phase 3: AI Reliability (2/2 plans) — completed 2026-02-17
- [x] Phase 4: Reporting & Export (2/2 plans) — completed 2026-02-17

</details>

### v1.1 Quality & Intelligence

**Milestone Goal:** Close v1.0 tech debt, establish test coverage for core logic and critical user flows, add analysis caching to reduce API costs, and deepen dashboard analytics with time-series trends and batch comparison insights.

- [ ] **Phase 5: Debt Closure & Test Infrastructure** - Fix v1.0 display gaps and establish comprehensive test coverage as a safety net for all subsequent work
- [ ] **Phase 6: Analysis Caching** - Eliminate duplicate API costs by caching validated analysis results keyed by content hash
- [ ] **Phase 7: Advanced Analytics** - Deliver time-series health tracking, batch comparison trends, cost insights, and gap frequency analysis on the dashboard

## Phase Details

### Phase 5: Debt Closure & Test Infrastructure
**Goal**: Users see accurate, complete UI (partial warnings, team context in PDFs, flow diagrams in exports) and developers have a comprehensive test suite protecting core business logic and critical user flows
**Depends on**: Phase 4 (v1.0 complete)
**Requirements**: DEBT-01, DEBT-02, DEBT-03, TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06
**Success Criteria** (what must be TRUE):
  1. Xray page displays a visible warning banner when the user views a partial or recovered analysis, so they know results may be incomplete
  2. PDF exports include team size tier, calibration context, and confidence indicators next to every health score and recommendation
  3. Single-workflow PDF exports contain the captured flow diagram image (not a placeholder or missing section)
  4. Running `npx vitest` executes unit tests for scoring, decompose pipeline, chart-data computation, and team calibration -- all pass with coverage reported
  5. Running `npx playwright test` executes an E2E test that submits a workflow, observes SSE progress, views results, and exports a PDF -- all steps pass without hitting the real Claude API
**Plans:** 3 plans

Plans:
- [ ] 05-01-PLAN.md — Close v1.0 display debt (partial warning, PDF team context, flow diagram wiring)
- [ ] 05-02-PLAN.md — Vitest + MSW infrastructure and unit tests for scoring, calibration, chart data
- [ ] 05-03-PLAN.md — Decompose pipeline tests with MSW and Playwright E2E test

### Phase 6: Analysis Caching
**Goal**: Identical workflow submissions skip the Claude API call entirely and return cached results instantly, reducing API costs and response time for repeated analyses
**Depends on**: Phase 5 (test coverage provides regression safety for decompose route modifications)
**Requirements**: CACH-01, CACH-02, CACH-03, CACH-04
**Success Criteria** (what must be TRUE):
  1. Submitting the same workflow description and team size twice returns results on the second submission without a Claude API call (observable by instant response and no SSE streaming delay)
  2. Cached entries auto-expire after 7 days -- a cache entry older than 7 days triggers a fresh analysis on next submission
  3. User can check a "Force re-analysis" option before submitting to bypass cache and get fresh results from Claude
  4. Results page clearly indicates whether analysis was served from cache or generated fresh, including when the cached analysis was originally created
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

### Phase 7: Advanced Analytics
**Goal**: Dashboard delivers deeper operational intelligence -- version health trajectories, batch comparison trends, API cost breakdowns with cache savings, and gap frequency patterns across all analyzed workflows
**Depends on**: Phase 6 (cacheHit field on Workflow type needed for cost/savings analytics)
**Requirements**: ANLZ-01, ANLZ-02, ANLZ-03, ANLZ-04
**Success Criteria** (what must be TRUE):
  1. Dashboard shows a line chart tracking health score changes across versions for any workflow that has been re-analyzed (version chain trajectory)
  2. Dashboard shows aggregate comparison trends across all analyzed workflows -- batch-level insights like "average fragility decreased 20% this week"
  3. Dashboard shows API cost breakdown with token usage and cache hit savings clearly highlighted (e.g., "42 analyses, 18 cache hits, ~$3.20 saved")
  4. Dashboard shows a gap frequency heatmap revealing which gap types (handoff, documentation, automation, etc.) appear most often across the entire workflow library
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD

## Progress

**Execution Order:** Phase 5 -> Phase 6 -> Phase 7

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Infrastructure & Security | v1.0 | 4/4 | Complete | 2026-02-16 |
| 2. Team-Size-Aware Analysis | v1.0 | 3/3 | Complete | 2026-02-16 |
| 3. AI Reliability | v1.0 | 2/2 | Complete | 2026-02-17 |
| 4. Reporting & Export | v1.0 | 2/2 | Complete | 2026-02-17 |
| 5. Debt Closure & Test Infrastructure | v1.1 | 0/3 | Planned | - |
| 6. Analysis Caching | v1.1 | 0/? | Not started | - |
| 7. Advanced Analytics | v1.1 | 0/? | Not started | - |
