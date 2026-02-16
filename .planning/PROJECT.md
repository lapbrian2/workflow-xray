# Workflow X-Ray

## What This Is

An AI-powered operational diagnostic engine that analyzes business workflows and provides detailed, scored, actionable intelligence. A consultant's team submits workflow descriptions (via text, URL, file upload, screenshot, Notion, or site crawl), and the app decomposes them into structured steps with gap analysis, health metrics, visual flow maps, and remediation plans. Built on Next.js 16, React 19, Claude Sonnet 4, deployed on Vercel.

This is the diagnostic/analysis layer of a larger vision: a composable AI operating system with modular Reasoning Cells, visual NeuroFlow builder, persistent Personas, and a skill marketplace. This milestone focuses on hardening the X-Ray foundation.

## Core Value

Teams can submit any workflow description and receive an accurate, actionable diagnostic — with team-size-aware analysis — that reveals bottlenecks, gaps, and automation opportunities they couldn't see before.

## Requirements

### Validated

- ✓ Workflow decomposition via Claude AI — existing
- ✓ Multi-source extraction (text, URL, file, screenshot, Notion, crawl) — existing
- ✓ Visual flow diagram with React Flow — existing
- ✓ Gap analysis (7 gap types with severity scoring) — existing
- ✓ Health metrics (complexity, fragility, automation potential, team load) — existing
- ✓ Remediation plan generation with phased tasks — existing
- ✓ Workflow versioning and comparison — existing
- ✓ PDF export (single, batch, compare) — existing
- ✓ Notion sync (import and export) — existing
- ✓ Team dashboard with aggregated analytics — existing
- ✓ Workflow library with filtering — existing
- ✓ Password-based authentication — existing
- ✓ Rate limiting per endpoint — existing
- ✓ LocalStorage persistence for offline/draft support — existing

### Active

- [ ] Team size input during workflow submission for context-aware analysis
- [ ] Systematic bug review and quality hardening across all features
- [ ] Improved error handling and edge case coverage
- [ ] Better reporting and export capabilities
- [ ] Integration improvements (beyond Notion)

### Out of Scope

- Reasoning Cells / NeuroFlow builder — future milestone, not this one
- Personas with persistent memory — future milestone
- Guided learning / adaptive expertise UI — future milestone
- Skill marketplace — future milestone
- User accounts / OAuth / SSO — future milestone (password auth is sufficient for now)
- Real-time collaboration — not needed for consultant team workflow
- Mobile app — web-first

## Context

- **Users:** A consulting team (multiple consultants) who analyze client workflows and deliver diagnostic reports
- **Deployment:** Vercel (KV for primary storage, Blob as fallback, in-memory for local dev)
- **AI Model:** Claude Sonnet 4 (claude-sonnet-4-20250514) with prompt caching
- **Auth:** Single password gate via AUTH_PASSWORD env var
- **Existing codebase:** ~24 components, 13 API endpoints, 4 Claude system prompts, zustand state management
- **Layer classification system:** cell, orchestration, memory, human, integration
- **Gap types detected:** context_loss, bottleneck, manual_overhead, single_dependency, missing_feedback, missing_fallback, scope_ambiguity
- **Health scoring:** 4 metrics on 0-100 scale (complexity, fragility, automation potential, team load balance)
- **Storage strategy:** Multi-tier (Vercel KV → Vercel Blob → in-memory fallback)
- **No test coverage exists** — opportunity for hardening

## Constraints

- **Tech stack**: Next.js 16 / React 19 / TypeScript / Tailwind 4 — already established, maintain consistency
- **AI provider**: Anthropic Claude — already integrated, prompt caching in place
- **Deployment**: Vercel — KV and Blob storage dependencies
- **Budget**: Token-conscious — prompt caching and rate limiting already in place
- **Team size feature**: Must integrate into existing decomposition flow without breaking current UX

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Harden before expanding | Stable foundation needed before Reasoning Cells / NeuroFlow | — Pending |
| Team size as input-time context | Simpler than persistent org profiles; provides immediate value to analysis | — Pending |
| Systematic quality review | No tests exist; bugs found during use; need reliability for team use | — Pending |
| Keep password auth for now | Team is small; real user accounts deferred to future milestone | — Pending |

---
*Last updated: 2026-02-16 after initialization*
