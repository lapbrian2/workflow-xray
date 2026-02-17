# Roadmap: Workflow X-Ray

## Overview

This milestone hardens Workflow X-Ray from a working prototype into a reliable, consulting-grade diagnostic engine. The journey moves through four phases: locking down infrastructure and security so data never silently disappears and unauthorized access is blocked; delivering the milestone's headline feature of team-size-aware analysis that calibrates scoring and gap detection to team capacity; making Claude integration resilient with retries, partial results, and meaningful progress feedback; and upgrading reporting with programmatic PDF generation and dashboard visualizations. Each phase delivers a complete, verifiable capability that the next phase builds on.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Infrastructure & Security** - Eliminate data loss, auth bypass, and inconsistent error handling across all API routes
- [x] **Phase 2: Team-Size-Aware Analysis** - Users specify team size and receive analysis calibrated to their team's capacity
- [x] **Phase 3: AI Reliability** - Claude integration retries failures, recovers partial results, and shows meaningful progress
- [ ] **Phase 4: Reporting & Export** - Professional PDF exports and dashboard visualizations for consulting deliverables

## Phase Details

### Phase 1: Infrastructure & Security
**Goal**: The application reliably persists data, enforces real authentication, validates all input, and returns structured errors -- eliminating silent data loss and security bypass
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04
**Success Criteria** (what must be TRUE):
  1. Workflow data saved in one session is retrievable in a new session without any silent fallback to in-memory storage
  2. A spoofed auth cookie (valid hex format but wrong value) is rejected and the user is redirected to login
  3. Submitting malformed or oversized JSON to any write endpoint returns a structured error response with a clear message, not a 500 or silent acceptance
  4. Every API route returns errors in a consistent JSON structure (error code, message, details) rather than inconsistent formats or raw stack traces
**Plans:** 4 plans

Plans:
- [x] 01-01-PLAN.md -- Storage hardening (fail-hard + KV race condition fix) and auth security (proxy.ts migration)
- [x] 01-02-PLAN.md -- Error handling foundation (AppError, withApiHandler wrapper, Zod validation schemas)
- [x] 01-03-PLAN.md -- Route migration batch 1: auth, decompose, workflows, compare, remediation, notion-import, notion-sync
- [x] 01-04-PLAN.md -- Route migration batch 2: remaining 6 routes (including SSE + FormData special cases) + frontend error parsing update

### Phase 2: Team-Size-Aware Analysis
**Goal**: Users provide team size during submission and receive health scores, gap severities, and recommendations that reflect whether they have 3 people or 50
**Depends on**: Phase 1
**Requirements**: TEAM-01, TEAM-02, TEAM-03, TEAM-04, TEAM-05
**Success Criteria** (what must be TRUE):
  1. User can enter team size (number of people) on the workflow submission form before running analysis
  2. The same workflow analyzed with team size 3 produces visibly different health metric scores than with team size 50 (e.g., fragility and team load thresholds shift)
  3. Gap analysis results show severity levels that account for team capacity (a single-dependency gap is flagged as critical for a 2-person team but moderate for a 20-person team)
  4. Analysis output clearly displays the team size context alongside scores, gaps, and recommendations so the user understands what calibration was applied
  5. Each section of the analysis output shows a confidence indicator (high-confidence vs. inferred) so users know where the AI is certain vs. estimating
**Plans:** 3 plans

Plans:
- [x] 02-01-PLAN.md -- Team calibration engine (TDD): team-tier classification, threshold multipliers, scoring updates, type extensions
- [x] 02-02-PLAN.md -- Prompt engineering + API wiring: team-size calibration in system prompt, GapSchema confidence field, teamSize threading
- [x] 02-03-PLAN.md -- UI display layer: ConfidenceBadge component, team context banners, per-gap confidence indicators

### Phase 3: AI Reliability
**Goal**: Claude API interactions are resilient -- transient failures retry automatically, malformed output degrades gracefully to partial results, and users see meaningful progress instead of blank spinners
**Depends on**: Phase 2
**Requirements**: AIRE-01, AIRE-02, AIRE-03
**Success Criteria** (what must be TRUE):
  1. When a Claude API call times out or hits a rate limit, the app automatically retries (with backoff) and the user does not see an error unless all retries are exhausted
  2. When Claude returns malformed or incomplete JSON, the app displays whatever valid partial results it recovered rather than showing a full error page
  3. During AI analysis (which takes 10-30 seconds), the user sees step-by-step progress messages (e.g., "Decomposing workflow...", "Analyzing gaps...", "Generating recommendations...") instead of a generic spinner
**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md -- SDK retry configuration (maxRetries=3) + typed error classification + partial JSON recovery in decompose pipeline
- [x] 03-02-PLAN.md -- SSE streaming decompose endpoint with server-driven progress events + client SSE consumer + progress UI

### Phase 4: Reporting & Export
**Goal**: PDF exports are programmatically generated for consistent, professional output, and the team dashboard shows health metric trends with data visualizations
**Depends on**: Phase 3
**Requirements**: REPT-01, REPT-02, REPT-03
**Success Criteria** (what must be TRUE):
  1. PDF exports render identically across Chrome, Firefox, and Safari -- no browser-specific layout differences or missing elements
  2. Exported PDFs contain structured sections: executive summary, flow diagram, gap analysis table, and phased recommendations -- not a flat screenshot
  3. The team dashboard displays health metric trends as visual charts (not just numbers) showing how scores change across workflows
**Plans:** 2 plans

Plans:
- [ ] 04-01-PLAN.md -- Shared PDF utility extraction, flow diagram capture utility, and flow diagram embedding in single-workflow PDF export
- [ ] 04-02-PLAN.md -- Health trend data derivation and recharts trend chart integration in team dashboard

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure & Security | 4/4 | Complete | 2026-02-16 |
| 2. Team-Size-Aware Analysis | 3/3 | Complete | 2026-02-16 |
| 3. AI Reliability | 2/2 | Complete | 2026-02-17 |
| 4. Reporting & Export | 0/2 | Not started | - |
