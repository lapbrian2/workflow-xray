# Requirements: Workflow X-Ray

**Defined:** 2026-02-18
**Core Value:** Teams can submit any workflow description and receive an accurate, actionable diagnostic -- with team-size-aware analysis -- that reveals bottlenecks, gaps, and automation opportunities they couldn't see before.

## v1.1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Debt Closure

- [x] **DEBT-01**: Xray page shows warning banner when viewing partial/recovered analysis results
- [x] **DEBT-02**: PDF exports include team size context and confidence indicators alongside scores
- [x] **DEBT-03**: Flow diagram is captured and embedded in single-workflow PDF exports

### Testing Infrastructure

- [x] **TEST-01**: Vitest configured with coverage reporting for core business logic
- [x] **TEST-02**: MSW mock handlers intercept Claude API calls for zero-cost test execution
- [x] **TEST-03**: Unit tests cover scoring engine (computeHealth, team calibration, threshold multipliers)
- [x] **TEST-04**: Unit tests cover decompose pipeline (JSON extraction, partial recovery, Zod validation)
- [x] **TEST-05**: Unit tests cover chart data computation (computeHealthTrends, edge cases)
- [x] **TEST-06**: Playwright E2E test covers submit workflow -> SSE progress -> view results -> export PDF flow

### Analysis Caching

- [ ] **CACH-01**: Identical workflow submissions (same description + team size) return cached results without re-calling Claude API
- [ ] **CACH-02**: Cached results have 7-day TTL and auto-expire from Vercel KV
- [ ] **CACH-03**: User can force re-analysis (skip cache) when they want fresh results
- [ ] **CACH-04**: UI indicates when results were served from cache vs fresh analysis

### Advanced Analytics

- [ ] **ANLZ-01**: Dashboard shows version-over-version health score trajectories for individual workflows
- [ ] **ANLZ-02**: Dashboard shows batch comparison trends across all analyzed workflows
- [ ] **ANLZ-03**: Dashboard shows API cost breakdown with cache savings highlighted
- [ ] **ANLZ-04**: Dashboard shows gap frequency heatmap (which gap types appear most across workflows)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Production Monitoring

- **MNTR-01**: Sentry error monitoring for production failure capture
- **MNTR-02**: Structured server-side logging with pino for debugging Claude API failures

### Integration Expansion

- **INTG-01**: Slack notifications for completed analyses
- **INTG-02**: Google Docs export for analysis reports
- **INTG-03**: Jira sync for gap-to-ticket conversion

### Platform Evolution

- **PLAT-01**: Reasoning Cells -- modular AI blocks that each do one thing well, transparently
- **PLAT-02**: NeuroFlow -- visual drag-and-drop flow builder connecting cells
- **PLAT-03**: Personas -- bundles of skills with persistent memory (digital teammates)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Component tests with Testing Library | Vitest units + Playwright E2E sufficient for v1.1; add if gaps found |
| Sentry error monitoring | Deferred to v1.2; not blocking current usage |
| Real-time collaboration | Not needed for consulting team workflow |
| Mobile app | Web-first approach |
| User accounts / OAuth / SSO | Password auth sufficient for consulting team |
| Distributed rate limiting | Per-isolate limits acceptable at team scale |
| Offline mode | Online-first diagnostic tool |
| Redis/external cache | Vercel KV sufficient; avoid infrastructure complexity |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEBT-01 | Phase 5 | Complete |
| DEBT-02 | Phase 5 | Complete |
| DEBT-03 | Phase 5 | Complete |
| TEST-01 | Phase 5 | Complete |
| TEST-02 | Phase 5 | Complete |
| TEST-03 | Phase 5 | Complete |
| TEST-04 | Phase 5 | Complete |
| TEST-05 | Phase 5 | Complete |
| TEST-06 | Phase 5 | Complete |
| CACH-01 | Phase 6 | Pending |
| CACH-02 | Phase 6 | Pending |
| CACH-03 | Phase 6 | Pending |
| CACH-04 | Phase 6 | Pending |
| ANLZ-01 | Phase 7 | Pending |
| ANLZ-02 | Phase 7 | Pending |
| ANLZ-03 | Phase 7 | Pending |
| ANLZ-04 | Phase 7 | Pending |

**Coverage:**
- v1.1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-02-18*
*Last updated: 2026-02-18 after roadmap creation*
