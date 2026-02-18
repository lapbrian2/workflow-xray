# Workflow X-Ray

## What This Is

An AI-powered operational diagnostic engine that analyzes business workflows and delivers scored, actionable intelligence calibrated to team capacity. Consultants submit workflow descriptions (via text, URL, file, screenshot, Notion, or site crawl), and the app decomposes them into structured steps with team-size-aware gap analysis, health metrics with confidence indicators, visual flow maps, and remediation plans — all exportable as professional PDF reports. Built on Next.js 16, React 19, Claude Sonnet 4, deployed on Vercel.

This is the diagnostic/analysis layer of a larger vision: a composable AI operating system with modular Reasoning Cells, visual NeuroFlow builder, persistent Personas, and a skill marketplace. The v1.0 foundation is hardened and shipped; v1.1 focuses on quality, caching, and deeper analytics.

## Current Milestone: v1.1 Quality & Intelligence

**Goal:** Close v1.0 tech debt, establish test coverage for core logic and critical user flows, add analysis caching to reduce API costs, and deepen dashboard analytics with time-series trends and batch comparison insights.

**Target features:**
- Fix 3 display-layer gaps from v1.0 (partial result warning, PDF team context, flow diagram wiring)
- Vitest unit tests for core logic (scoring, decompose, team-calibration, chart-data)
- Playwright E2E for submit → analyze → export critical flow
- MSW API mock layer for zero-cost testing
- Analysis caching by content hash (skip re-analysis for identical workflows)
- Advanced analytics: time-series health tracking, batch comparison trends, deeper dashboard

## Core Value

Teams can submit any workflow description and receive an accurate, actionable diagnostic — with team-size-aware analysis — that reveals bottlenecks, gaps, and automation opportunities they couldn't see before.

## Requirements

### Validated

- ✓ Workflow decomposition via Claude AI — existing (pre-v1.0)
- ✓ Multi-source extraction (text, URL, file, screenshot, Notion, crawl) — existing (pre-v1.0)
- ✓ Visual flow diagram with React Flow — existing (pre-v1.0)
- ✓ Gap analysis (7 gap types with severity scoring) — existing (pre-v1.0)
- ✓ Health metrics (complexity, fragility, automation potential, team load) — existing (pre-v1.0)
- ✓ Remediation plan generation with phased tasks — existing (pre-v1.0)
- ✓ Workflow versioning and comparison — existing (pre-v1.0)
- ✓ PDF export (single, batch, compare) — existing (pre-v1.0)
- ✓ Notion sync (import and export) — existing (pre-v1.0)
- ✓ Team dashboard with aggregated analytics — existing (pre-v1.0)
- ✓ Workflow library with filtering — existing (pre-v1.0)
- ✓ Password-based authentication — existing (pre-v1.0)
- ✓ Rate limiting per endpoint — existing (pre-v1.0)
- ✓ LocalStorage persistence for offline/draft support — existing (pre-v1.0)
- ✓ KV storage hardening with fail-hard on write errors — v1.0 (INFR-01)
- ✓ Auth cookie validation prevents spoofed bypass — v1.0 (INFR-02)
- ✓ All 13 API routes have consistent structured error handling — v1.0 (INFR-03)
- ✓ All API routes validate input with Zod schemas — v1.0 (INFR-04)
- ✓ Team size input during workflow submission — v1.0 (TEAM-01)
- ✓ Health scores calibrated by team size (tier multipliers) — v1.0 (TEAM-02)
- ✓ Gap severity contextualized to team capacity — v1.0 (TEAM-03)
- ✓ Team size context displayed alongside scores and recommendations — v1.0 (TEAM-04)
- ✓ AI confidence indicators (high/inferred) per section — v1.0 (TEAM-05)
- ✓ Claude API retries on transient failures with exponential backoff — v1.0 (AIRE-01)
- ✓ Partial result recovery from malformed AI output — v1.0 (AIRE-02)
- ✓ SSE streaming with server-driven progress messages — v1.0 (AIRE-03)
- ✓ Programmatic PDF generation for cross-browser consistency — v1.0 (REPT-01)
- ✓ Dashboard health trend charts with Recharts — v1.0 (REPT-02)
- ✓ PDF structured sections (executive summary, flow diagram, gap analysis, recommendations) — v1.0 (REPT-03)

### Active (v1.1)

- [ ] Wire flow diagram capture to PDF export UI handler
- [ ] Add partial result warning indicator to xray page
- [ ] Include team context and confidence in PDF exports
- [ ] Unit test infrastructure with Vitest covering core logic
- [ ] E2E tests with Playwright for critical user flows (submit → analyze → export)
- [ ] API mock layer (MSW) for testing without API costs
- [ ] Analysis caching by content hash to avoid duplicate API costs
- [ ] Time-series health tracking across workflow versions
- [ ] Batch comparison trends and deeper dashboard analytics

### Out of Scope

- Reasoning Cells / NeuroFlow builder — future milestone
- Personas with persistent memory — future milestone
- Guided learning / adaptive expertise UI — future milestone
- Skill marketplace — future milestone
- User accounts / OAuth / SSO — password auth sufficient for consulting team
- Real-time collaboration — not needed for consultant team workflow
- Mobile app — web-first, PWA viable
- Distributed rate limiting — per-isolate limits acceptable at team scale
- Offline mode — online-first diagnostic tool
- Sentry error monitoring — deferred to v1.2 (not blocking current usage)
- Component tests with Testing Library — deferred; Vitest units + Playwright E2E sufficient for v1.1

## Context

- **Shipped:** v1.0 on 2026-02-17 (4 phases, 11 plans, 54 commits)
- **Codebase:** 22,416 LOC TypeScript across 73 source files
- **Users:** A consulting team analyzing client workflows and delivering diagnostic reports
- **Deployment:** Vercel (KV primary, Blob fallback, in-memory local dev)
- **AI Model:** Claude Sonnet 4 (claude-sonnet-4-20250514) with prompt caching, maxRetries=3
- **Auth:** Single password gate via AUTH_PASSWORD env var
- **Storage:** Multi-tier (Vercel KV → Vercel Blob → in-memory) with fail-hard writes
- **Error handling:** AppError + withApiHandler wrapper on all 13 routes, Zod validation
- **Streaming:** SSE decompose endpoint with server-driven progress events
- **PDF system:** jsPDF programmatic drawing, shared pdf-shared.ts module, 4 export types
- **Charting:** Recharts 3.7.0 for health trend visualization
- **Known tech debt:** 3 display-layer gaps from v1.0 (partial warning, PDF team context, flow diagram wiring)
- **No test coverage exists** — addressed in v1.1

## Constraints

- **Tech stack**: Next.js 16 / React 19 / TypeScript / Tailwind 4 — established
- **AI provider**: Anthropic Claude — integrated with retry and recovery
- **Deployment**: Vercel — KV and Blob storage dependencies
- **Budget**: Token-conscious — prompt caching and rate limiting in place
- **OneDrive path**: Project in "New folder (3)" causes `npm run build` static generation failures; TypeScript compiles fine

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Harden before expanding | Stable foundation needed before Reasoning Cells / NeuroFlow | ✓ Good — v1.0 shipped solid foundation |
| Team size as input-time context | Simpler than persistent org profiles; immediate value | ✓ Good — 4-tier calibration works well |
| Keep password auth for now | Team is small; real user accounts deferred | ✓ Good — sufficient for consulting team |
| 4-phase structure (INFR→TEAM→AIRE→REPT) | Requirement-driven sequencing with proper dependencies | ✓ Good — clean execution, no inter-phase conflicts |
| Medium tier uses 1.0x multipliers | Neutral baseline for backward compatibility | ✓ Good — pre-existing workflows unaffected |
| Confidence defaults to "high" when teamSize provided | Safety net beyond Zod default; consumers never need null checks | ✓ Good — clean API |
| Hybrid SSE pattern for decompose | Pre-stream JSON errors, in-stream SSE events | ✓ Good — clear error handling boundary |
| html-to-image pinned to 1.11.11 | Newer versions have confirmed export bugs per React Flow docs | ⚠️ Revisit — monitor for fixes |
| Per-period averages for health trends | Shows actual changes per time bucket, not cumulative | ✓ Good — meaningful trend visualization |
| Accept tech debt at v1.0 | 5 display-layer items, no functional gaps | ✓ Good — shipped on time |

---
*Last updated: 2026-02-18 after v1.1 milestone start*
