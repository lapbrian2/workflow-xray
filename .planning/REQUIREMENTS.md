# Requirements: Workflow X-Ray v1.2

**Defined:** 2026-02-19
**Core Value:** Teams can submit any workflow description and receive an accurate, actionable diagnostic -- with team-size-aware analysis -- that reveals bottlenecks, gaps, and automation opportunities they couldn't see before.

## v1.2 Requirements

Requirements for Collaboration & Intelligence milestone. Each maps to roadmap phases.

### Auth Foundation

- [ ] **AUTH-01**: Next.js middleware enforces auth boundaries -- public routes (share, login) pass through, all others require valid auth cookie
- [ ] **AUTH-02**: Auth cookie validated in middleware using Web Crypto API (not just format check)

### Shareable Links

- [ ] **SHAR-01**: Authenticated user can create a share link for any workflow with optional label and expiry
- [ ] **SHAR-02**: Share link URL grants read-only access to workflow X-Ray without requiring login
- [ ] **SHAR-03**: Share view renders flow diagram, gap analysis, and health scores in read-only mode
- [ ] **SHAR-04**: Authenticated user can list, copy, and revoke share links for a workflow
- [ ] **SHAR-05**: Deleting a workflow automatically revokes all its share links

### Comments & Notes

- [ ] **CMNT-01**: Authenticated user can add workflow-level comments with author name
- [ ] **CMNT-02**: Authenticated user can add gap-level comments on specific gaps
- [ ] **CMNT-03**: Gap comments can be marked as resolved/unresolved
- [ ] **CMNT-04**: Comments are visible in the share view (read-only for external viewers)
- [ ] **CMNT-05**: Deleting a workflow cascades to delete all its comments

### AI Implementation Roadmaps

- [ ] **ROAD-01**: User can generate an AI implementation roadmap for a workflow that synthesizes all gaps into a phased plan with timelines and effort estimates
- [ ] **ROAD-02**: Roadmap generation uses SSE streaming with progress feedback
- [ ] **ROAD-03**: Roadmap includes cross-workflow context (patterns from other workflows in library)

### Cross-Workflow Patterns

- [ ] **PTRN-01**: Dashboard offers pattern detection that analyzes all workflows for recurring gaps, owner bottlenecks, and tool fragmentation
- [ ] **PTRN-02**: Pattern analysis uses curated server-side aggregation (not raw data dump to Claude)
- [ ] **PTRN-03**: Pattern results are cached by library state hash with 24-hour TTL
- [ ] **PTRN-04**: Pattern analysis uses SSE streaming with progress feedback

### Predictive Health

- [ ] **PRED-01**: Dashboard shows predictive health scoring for workflows with version history (2+ versions)
- [ ] **PRED-02**: Predictions include 90-day projections per health metric with trend direction and confidence
- [ ] **PRED-03**: Prediction results are cached by library state hash with 24-hour TTL

## v1.3 Requirements (Deferred)

Tracked but not in current roadmap. Deferred by scope split decision.

### Integrations

- **INTG-01**: Google Docs import for workflow descriptions
- **INTG-02**: Google Sheets export for analysis data
- **INTG-03**: Jira/Asana ticket creation from gap analysis

### Automation

- **AUTO-01**: Scheduled re-analysis of workflows at configurable intervals
- **AUTO-02**: Health score alerts when metrics cross thresholds
- **AUTO-03**: Change detection notifications when re-analysis shows drift

### Platform

- **PLAT-01**: Reasoning Cells -- modular AI blocks
- **PLAT-02**: NeuroFlow -- visual drag-and-drop flow builder
- **PLAT-03**: Personas -- persistent memory bundles

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full user accounts / OAuth / SSO | Password auth sufficient for consulting team; free-text author on comments |
| Real-time collaboration (WebSocket) | Async comments sufficient; not a chat app |
| Real-time comment sync | 30s polling or manual refresh sufficient |
| Mobile app | Web-first diagnostic tool |
| Distributed rate limiting | Per-isolate limits acceptable at team scale |
| Component tests with Testing Library | Vitest units + Playwright E2E sufficient |
| Embedding comments inside workflow JSON | Separate KV entries avoid race conditions |
| Using workflow ID as share token | Separate revocable tokens for security |
| Sending raw workflow JSON to Claude for patterns | Curated aggregation keeps costs low |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 8 | Pending |
| AUTH-02 | Phase 8 | Pending |
| SHAR-01 | Phase 8 | Pending |
| SHAR-02 | Phase 8 | Pending |
| SHAR-03 | Phase 8 | Pending |
| SHAR-04 | Phase 8 | Pending |
| SHAR-05 | Phase 8 | Pending |
| CMNT-01 | Phase 9 | Pending |
| CMNT-02 | Phase 9 | Pending |
| CMNT-03 | Phase 9 | Pending |
| CMNT-04 | Phase 9 | Pending |
| CMNT-05 | Phase 9 | Pending |
| ROAD-01 | Phase 10 | Pending |
| ROAD-02 | Phase 10 | Pending |
| ROAD-03 | Phase 10 | Pending |
| PTRN-01 | Phase 10 | Pending |
| PTRN-02 | Phase 10 | Pending |
| PTRN-03 | Phase 10 | Pending |
| PTRN-04 | Phase 10 | Pending |
| PRED-01 | Phase 10 | Pending |
| PRED-02 | Phase 10 | Pending |
| PRED-03 | Phase 10 | Pending |

**Coverage:**
- v1.2 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-02-19*
*Last updated: 2026-02-19 after initial definition*
