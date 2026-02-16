# Project Research Summary

**Project:** Workflow X-Ray Production Hardening
**Domain:** AI-powered workflow analysis / operational diagnostics for consulting teams
**Researched:** 2026-02-16
**Confidence:** HIGH

## Executive Summary

Workflow X-Ray is an AI-powered workflow analysis tool for consulting teams that uses Claude Sonnet to decompose workflows, identify 7 types of gaps, compute 4-dimensional health metrics, and generate phased remediation plans. The application has a solid technical foundation built on Next.js 16, React 19, and @anthropic-ai/sdk with rich features including multi-source extraction, visual flow diagrams, version comparison, and Notion integration. However, critical production gaps exist in authentication, data persistence, rate limiting, and testing that must be addressed before team-wide deployment.

Research reveals this product occupies a unique market position. Unlike workflow management tools (Process Street, Kissflow) that focus on execution, or diagramming tools (Lucidchart) that focus on visualization, Workflow X-Ray provides AI-powered diagnostic analysis—automated gap identification and health scoring—that no mainstream competitor offers. The hardening strategy should strengthen this diagnostic advantage rather than expanding into workflow execution or collaborative editing features that competitors already own.

The recommended approach follows three sequential phases: Foundation (infrastructure and security fixes that prevent data loss and unauthorized access), Reliability (team-size-aware analysis, testing infrastructure, and graceful AI failure handling), and Polish (performance optimization, consulting-grade exports, and accessibility). Seven critical pitfalls were identified, with the most severe being silent data loss from in-memory storage fallback, auth bypass via format-only cookie validation, and per-isolate rate limiting that provides zero actual protection in production.

## Key Findings

### Recommended Stack

The existing stack is production-ready (Next.js 16.1.6, React 19, TypeScript, Tailwind, @anthropic-ai/sdk, @xyflow/react, Zustand, Vercel KV/Blob). Research identified four priority areas for additions: testing infrastructure (highest priority—zero coverage today), reporting upgrades, production hardening, and code quality tooling.

**Core additions (Priority 1—Testing):**
- Vitest 4.0.18 — Next.js 16 official recommendation, faster than Jest, native ESM support
- @testing-library/react 16.3.2 — React 19 compatible, de facto standard for component testing
- @playwright/test 1.58.2 — Next.js 16 recommended E2E framework
- msw 2.12.10 — Network-level API mocking for testing Claude responses without API costs

**Priority 2 (Reporting):**
- recharts 3.7.0 — Data visualization for health metric dashboards, SVG-based for crisp PDF exports
- @react-pdf/renderer 4.3.2 — Programmatic PDF generation, replaces html2canvas for consistent output
- date-fns 4.1.0 — Lightweight date formatting for report timestamps

**Priority 3 (Production hardening):**
- @sentry/nextjs 10.39.0 — Error monitoring with Next.js 16 support, captures production failures
- pino 10.3.1 — Structured server-side logging for debugging Claude API failures

**Priority 4 (Code quality):**
- prettier 3.8.1, husky 9.1.7, lint-staged 16.2.7 — Consistent formatting, pre-commit hooks

**Note:** Avoid Jest (slower, requires Babel config), react-beautiful-dnd (deprecated), Moment.js (maintenance mode), and Vercel AI SDK (adds unnecessary abstraction over the existing direct Claude integration).

### Expected Features

The application already implements extensive functionality: workflow decomposition, multi-source extraction (text, URL, file, screenshot, Notion, crawl), visual flow diagrams, gap analysis, health metrics, remediation planning, version comparison, PDF export, team dashboard, and password auth. Research identified three feature categories for hardening.

**Must have (table stakes for consulting-grade tool):**
- Test coverage — Zero tests today means zero confidence for client-facing tool
- Team-size-aware analysis calibration — A 1-person workflow and 50-person workflow need different gap analysis; current scoring ignores team context
- Graceful AI failure handling — Claude sometimes returns malformed JSON, hallucinates step IDs, or times out; needs retry logic and partial result display
- Consistent error handling across API routes — Some routes have rich handling, others have bare try/catch
- Data persistence reliability — In-memory fallback loses data on cold start; needs explicit warnings and localStorage-to-server sync robustness

**Should have (competitive advantage):**
- Team-size-adaptive scoring engine — Health metrics that change meaning based on team size (e.g., fragility score of 70 means "concerning" for 20-person team but "expected" for solo operator)
- AI analysis caching and deduplication — Same workflow description should not cost another API call; cache by content hash
- Time-series health tracking — Show how workflow health changes across versions over time
- Confidence indicators per analysis section — Show where AI is confident vs. guessing

**Defer (v2+):**
- Batch engagement comparison — Compare client's workflows at intake vs. after remediation across ALL workflows
- Consulting-grade PDF export — Current PDF works but needs structured generation, company logo, executive summary
- Role-based analysis perspectives — Executive view (ROI, risk) vs. operator view (tasks, tools)
- Industry/domain templates — Pre-loaded workflow templates for common consulting verticals

**Anti-features (commonly requested but problematic):**
- Real-time collaborative editing — Consulting work is deliberate/asynchronous, not real-time; adds 5x infrastructure complexity
- Custom AI model selection — Multi-model support triples maintenance burden; Claude Sonnet is best for this use case
- Workflow execution/automation engine — This is a diagnostic tool, not an orchestration platform; different product entirely

### Architecture Approach

The current architecture follows Next.js App Router conventions with clean separation of concerns. The system has three tiers: client (React with Zustand for UI state, localStorage cache), server (13 API routes with shared libraries for Claude, storage, scoring, validation), and external services (Claude API, Firecrawl, Notion, Vercel KV/Blob). The architecture is well-suited for consulting team scale (1-10 users) and requires minimal structural changes.

**Major components:**
1. **API Routes (src/app/api/)** — 13 endpoints handle decompose, remediation, extraction, comparison, Notion sync, PDF export, auth; each independently manages rate limiting and validation
2. **Claude Integration (src/lib/claude.ts)** — Four prompt-specific wrapper functions with system prompt versioning via content hashing; implements prompt caching to reduce costs
3. **Multi-tier Storage (src/lib/db.ts)** — Strategy pattern for KV > Blob > Memory fallback; abstracts backend selection from callers
4. **Defensive AI Processing (src/lib/decompose.ts)** — Three-stage pipeline: JSON extraction → Zod validation → referential integrity repair; prevents malformed AI output from corrupting workflow library
5. **Client State Management** — Zustand for UI-only state (input mode, loading, selected node), localStorage for optimistic workflow caching with merge-on-load

**Key architectural improvements (additive, not rewrites):**
1. **Layered error handling** — Add Next.js error.tsx files at strategic levels (global, app, xray/[id]) for route-specific error UX; current ErrorBoundary is client-only
2. **API route standardization** — Extract shared api-utils.ts for error responses, rate limit wrapper, body parsing; eliminates 5-8 lines of duplicated boilerplate per route
3. **Team context integration** — Create shared team-context.ts for prompt building; enhance decompose-system.md with team-size-aware instructions
4. **Testing infrastructure** — Refactor for testable seams before writing tests (AIClient interface, StorageProvider interface, pure functions for business logic)
5. **Structured logging** — Add lightweight logger utility with request ID tracking across multi-step operations for production debugging

**Anti-patterns identified and avoided:**
- Duplicated rate limit boilerplate across routes (extract to shared utility)
- Inline error message mapping (create apiErrorFromException classifier)
- Missing route-level error boundaries (add error.tsx at page levels)
- No input sanitization standard (define constants for size limits)

### Critical Pitfalls

Research identified seven critical pitfalls with potential for data loss, security compromise, or production failures:

1. **In-memory state evaporates on cold start (DATA LOSS)** — db.ts silently falls back to memory storage when KV/Blob env vars are misconfigured; data written in one serverless invocation is invisible to the next; consultants lose work without error indication. **Avoid by:** Health check that fails loudly on deploy if persistent storage is unreachable; visible banner when running on memory; 503 response from API routes when backend is "memory" in production.

2. **Rate limiter is per-isolate, not distributed (COST OVERRUN)** — rate-limit.ts uses in-memory Map; Vercel serverless scales to multiple isolates; a burst of 100 requests hits 100 different Maps; limiter never triggers; single misbehaving script can exhaust Anthropic API budget in minutes. **Avoid by:** Implement distributed rate limiting using Vercel KV (Upstash Redis) with INCR+EXPIRE sliding window; set Anthropic API spend alerts as safety net.

3. **Auth cookie validated by format only (SECURITY BYPASS)** — middleware.ts checks cookie matches /^[a-f0-9]{64}$/ but does NOT verify it's the correct hash; any 64-char hex string passes; API routes have no auth checks; anyone setting cookie xray_auth=0000...0000 bypasses authentication for all endpoints. **Avoid by:** Use Web Crypto API in Edge middleware for full hash verification; or add auth verification helper to every API route; migrate to NextAuth.js for session management.

4. **No input validation on POST /api/workflows (DATA CORRUPTION)** — Route accepts any JSON body and passes directly to saveWorkflow() with zero validation; attacker or buggy client can write malformed workflows, XSS payloads, absurdly large objects that exhaust storage. **Avoid by:** Validate request body against Workflow Zod schema before saving; sanitize string fields to prevent stored XSS; enforce size limits (500KB max).

5. **Claude output parsing assumes happy path (ANALYSIS FAILURES)** — decompose.ts parses JSON with regex + JSON.parse + Zod but fails terminally on: JSON without code fences, partial JSON at token limit, semantically nonsensical but valid JSON, 45s timeout before completion. No retry logic, no partial result recovery for decompose (though extraction has recoverPartialExtraction). **Avoid by:** Automatic retry with exponential backoff for transient errors; increase max_tokens to 8192; add partial recovery pattern to decompose; differentiate user-facing error messages.

6. **Adding tests to untestable architecture creates brittle tests (MAINTENANCE BURDEN)** — Zero tests today; business logic tightly coupled to Claude API client, storage layer, and HTTP request cycle; no seams for injecting test doubles; tests that depend on real API calls are slow (5-30s), flaky (LLM varies), expensive (API credits), break when services change. **Avoid by:** Refactor for testable seams BEFORE writing tests (AIClient interface, StorageProvider interface, pure functions); test in layers (unit → integration → E2E); target 80% coverage on business logic first.

7. **Org context injection creates prompt leakage between clients (PRIVACY VIOLATION)** — org-context.ts reads ALL workflows and injects aggregate data into prompts; in multi-consultant deployment, Consultant A's workflow data (titles, owners, gap patterns) leaks into Consultant B's analysis; privacy concern and analysis quality issue. **Avoid by:** Add tenant/workspace concept with ownerId on workflows; filter buildOrgContext() to same workspace only; cap org context to 500-token budget.

**Additional pitfalls tracked:** Public blob storage exposure, hardcoded default auth salt, client IP extraction trusts headers, generic "try again" errors for AI failures, no progress indication during 10-30s analyses, no score explanations (opaque numbers), remediation status UI missing despite data model support.

## Implications for Roadmap

Based on research, recommended three-phase structure with strict sequencing to address critical pitfalls before building enhancements:

### Phase 1: Foundation (Infrastructure and Security)
**Rationale:** Data loss and security vulnerabilities must be eliminated before any other work matters. Tests and feature improvements are meaningless if data disappears or unauthorized users access the system.

**Delivers:**
- Persistent storage guaranteed (no silent memory fallback)
- Distributed rate limiting (KV-backed, isolate-safe)
- Real authentication enforcement (full hash validation, not format-only)
- Input validation on all write endpoints
- Layered error handling (error.tsx at strategic levels)
- API route standardization (shared error handling, rate limit wrapper)
- Structured logging utility with request ID tracking

**Addresses features from FEATURES.md:**
- Data persistence reliability (table stakes)
- Consistent error handling across API routes (table stakes)
- Input validation with clear feedback (table stakes)

**Avoids pitfalls from PITFALLS.md:**
- Pitfall 1: In-memory data loss
- Pitfall 2: Per-isolate rate limiting
- Pitfall 3: Auth cookie bypass
- Pitfall 4: Unvalidated workflow POST
- Pitfall 7: Org context leakage (add tenant concept early)

**Stack elements from STACK.md:**
- Vitest setup (prepare for Phase 2)
- Pino for structured logging
- Constants for input validation limits

**Expected duration:** 1-2 weeks for small consulting team scale

---

### Phase 2: Reliability (Team-Size-Aware Analysis and Testing)
**Rationale:** With foundation secure, focus on the milestone's core value: team-size-aware analysis that makes the tool credible for consulting work. Parallel testing infrastructure ensures reliability.

**Delivers:**
- Team-size-aware scoring engine (health metrics calibrated by team context)
- System prompt enhancements for team-size-aware instructions
- Shared team context prompt builder (reusable across decompose/remediation)
- Test coverage: unit tests (scoring, parsing, org-context, rate-limit), integration tests (API routes with mocked Claude/storage), E2E smoke tests
- Graceful AI failure handling (retry with exponential backoff, partial result display, differentiated error messages)
- Loading states for all async operations (remediation, Notion sync, PDF export, comparison)
- AI analysis caching and deduplication (content hash, reduces cost/latency)
- Refactored testable architecture (AIClient interface, StorageProvider interface, pure business logic functions)

**Addresses features from FEATURES.md:**
- Team-size-aware analysis calibration (table stakes, milestone headline feature)
- Test coverage (table stakes)
- Graceful AI failure handling (table stakes)
- Team-size-adaptive scoring engine (differentiator)
- AI analysis caching (differentiator)
- Loading states for all operations (table stakes)

**Uses stack from STACK.md:**
- Vitest, @testing-library/react, @playwright/test, msw (testing infrastructure)
- Vitest config with jsdom environment, coverage reporting
- MSW handlers for mocking Claude API responses

**Avoids pitfalls from PITFALLS.md:**
- Pitfall 5: Claude output parsing failures (retry, partial recovery, higher token limits)
- Pitfall 6: Untestable architecture (refactor for seams before tests)

**Implements architecture components from ARCHITECTURE.md:**
- Team context layer (shared prompt builder)
- Testing infrastructure with proper mocking boundaries
- API route refactoring to use shared utilities

**Expected duration:** 2-3 weeks (testing infrastructure setup is substantial)

---

### Phase 3: Polish (Performance, Reporting, Accessibility)
**Rationale:** With foundation secure and core analysis reliable, optimize performance and user experience for consulting team workflows.

**Delivers:**
- Time-series health tracking (sparkline trends across versions)
- Confidence indicators per analysis section (show where AI is confident vs. guessing)
- Accessibility basics (keyboard navigation, aria-labels, color-blind-safe palette)
- Prompt version visibility in UI (show which prompt produced each analysis)
- Data persistence warnings (detect memory backend, show banner)
- Performance optimizations (pagination for workflow library, org context caching with TTL)
- Enhanced PDF export foundation (migrate from html2canvas to @react-pdf/renderer for new reports)
- Notion sync performance (batch operations vs. sequential delete-then-recreate)

**Addresses features from FEATURES.md:**
- Confidence indicators (differentiator)
- Time-series health tracking (differentiator)
- Accessibility basics (table stakes for enterprise consulting)
- Prompt version tracking (table stakes)

**Uses stack from STACK.md:**
- recharts for time-series sparklines
- @react-pdf/renderer for structured PDF generation
- date-fns for timestamp formatting
- prettier, husky, lint-staged for code quality

**Implements architecture components from ARCHITECTURE.md:**
- Pagination for listWorkflows() (KV flat array bottleneck at 50+ workflows)
- Org context caching with 5-minute TTL
- Enhanced error boundaries with contextual recovery options

**Expected duration:** 1-2 weeks

---

### Phase Ordering Rationale

- **Foundation must precede everything** — Data loss (Pitfall 1), security bypass (Pitfall 3), and uncontrolled costs (Pitfall 2) are blockers for any production use. The testing setup from Priority 1 stack enables Phase 2.
- **Reliability builds on secure foundation** — Team-size-aware scoring (milestone headline) requires the team context infrastructure. Testing requires the testable architecture refactoring. Both depend on stable API utilities from Phase 1.
- **Polish depends on stable core** — Time-series tracking needs version data to accumulate. PDF improvements should wait until all analysis features are stable (don't redesign PDFs during data model changes). Performance optimization makes sense after usage patterns emerge.
- **Parallelization opportunities** — Within Phase 1: error handling, logging, and API standardization are independent. Within Phase 2: test infrastructure and team-aware scoring can progress in parallel after architecture refactoring. Within Phase 3: accessibility, prompt visibility, and performance work are independent.

**Critical path:** Foundation security (Phase 1) → Testable architecture refactoring (Phase 2 prerequisite) → Team-aware scoring + tests (Phase 2 parallel) → Polish (Phase 3)

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 2 (Testing):** Vitest configuration for Next.js 16 App Router with module resolution for @/ imports; MSW v2 setup patterns for mocking Anthropic API; Playwright configuration for SSE streaming in crawl-site route
- **Phase 3 (PDF):** @react-pdf/renderer migration strategy from html2canvas; rendering recharts SVG output in PDF documents; font licensing for professional consulting PDFs

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Foundation):** Error handling files (error.tsx, not-found.tsx) are Next.js conventions with official documentation; Vercel KV rate limiting has standard Upstash patterns; auth validation is Web Crypto API (well-documented)
- **Phase 2 (Team-aware scoring):** Extending existing computeHealth() function with conditional logic based on team size; Zod schema modifications for confidence fields are straightforward
- **Phase 3 (Accessibility):** Standard WCAG patterns for keyboard navigation, aria-labels, and color contrast; Next.js-agnostic concerns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions and peer dependencies verified via npm registry 2026-02-16; Next.js 16.1.6 testing docs verified via official site; existing codebase analysis confirmed current patterns |
| Features | MEDIUM | Current state inventory via code review (HIGH confidence); table stakes and differentiators based on consulting tool domain knowledge from training data (MEDIUM confidence); competitor analysis not web-verified (LOW-MEDIUM confidence) |
| Architecture | HIGH | Full codebase audit of 60+ source files; Next.js 16.1.6 official docs verified for error handling, testing, and App Router patterns; architectural patterns directly observed in code |
| Pitfalls | HIGH | All critical pitfalls identified via direct codebase analysis with specific file citations; Vercel serverless behavior and Anthropic API patterns from training data (MEDIUM confidence on edge cases, but core issues are HIGH confidence) |

**Overall confidence:** HIGH

The research foundation is solid because it combines direct codebase analysis (objective truth about current state) with verified official documentation (Next.js 16, npm registry) and domain knowledge from training data (consulting tool patterns, AI integration best practices). The main confidence gap is in competitor feature verification—competitor analysis relies on training data that may not reflect 2026 product state.

### Gaps to Address

**During Phase 1 planning:**
- **Vercel KV race condition mitigation:** The workflow:ids flat array has read-modify-write race conditions. Research recommends Redis SADD (atomic set operations). Validate whether @vercel/kv client exposes raw Redis commands or only JSON operations. May need @upstash/redis direct client.
- **Web Crypto API in Edge middleware:** Research states Web Crypto works in Edge Runtime. Validate crypto.subtle.digest() behavior in middleware.ts during Phase 1 implementation. If blocked, fallback is API route auth check pattern.
- **Blob storage access control:** Current code sets access: "public". Verify whether changing to "private" requires signed URL generation or if @vercel/blob handles auth automatically for same-origin requests.

**During Phase 2 planning:**
- **MSW v2 with Next.js API routes:** Verify MSW 2.12.10 works with Next.js 16 fetch() behavior in API routes. Some frameworks have quirks with network interception. Test early in Phase 2.
- **Vitest path alias resolution:** vite-tsconfig-paths should resolve @/ imports. Confirm this works with Next.js-specific tsconfig paths. Common source of test failures.
- **Claude prompt token budget:** Research recommends increasing max_tokens from 4096 to 8192 for decompose. Validate whether this impacts Claude API costs proportionally or if unused tokens are not billed.

**During Phase 3 planning:**
- **@react-pdf/renderer learning curve:** Migrating from html2canvas to react-pdf is "significant architectural change" per STACK.md. Plan for proof-of-concept before committing to full migration. Incremental approach: new reports use react-pdf, old approach remains as fallback.
- **recharts SVG embedding in PDFs:** Research states recharts SVG output can embed in react-pdf documents. Validate this workflow—may require intermediate SVG serialization step.

**Cross-phase considerations:**
- **Multi-tenancy scope:** Pitfall 7 (org context leakage) requires tenant/workspace concept. Decide in Phase 1 whether to implement full per-user auth (NextAuth.js migration) or lightweight workspace tagging. Full auth is more robust but higher scope. Workspace tagging is faster but less secure.
- **Prompt version migration:** Enhancing system prompts (Phase 2) invalidates existing prompt version hashes. Decide whether to preserve old analyses as-is or re-hash and migrate. Recommend preserve—historical analyses should reflect prompts that produced them.

## Sources

### Primary (HIGH confidence)
- **Workflow X-Ray codebase:** Full audit of 60+ files including src/lib/*, src/app/api/*, src/components/*, middleware.ts, prompts/*, .planning/PROJECT.md — Current state, architectural patterns, existing pitfalls identified through direct analysis
- **Next.js 16.1.6 official documentation:** https://nextjs.org/docs/app/building-your-application/testing/vitest, https://nextjs.org/docs/app/building-your-application/testing/playwright, https://nextjs.org/docs/app/building-your-application/routing/error-handling — Verified 2026-02-16 for Vitest recommendation, Playwright E2E, and error handling patterns
- **npm registry:** Version numbers and peer dependencies verified via `npm view [package] version peerDependencies` for all recommended packages on 2026-02-16 — React 19 compatibility, Next.js 16 peer deps, version compatibility matrix

### Secondary (MEDIUM confidence)
- **Domain knowledge from training data:** Consulting tool requirements, workflow analysis patterns, BPM software landscape, AI integration best practices, Anthropic API behavior, Vercel serverless characteristics — Not web-verified but consistent across multiple training sources
- **Technology comparison:** Vitest vs. Jest, @dnd-kit vs. react-beautiful-dnd, pino vs. winston, MSW vs. nock — Based on training data and community consensus, not 2026-specific research

### Tertiary (LOW-MEDIUM confidence)
- **Competitor analysis:** Process Street, Lucidchart, Kissflow feature sets based on training data — Product features may have changed since training cutoff; should be validated before strategic product decisions
- **Market sizing and consulting industry trends:** Unable to verify with 2026 sources due to web search unavailability — Use research directionally, validate assumptions with users

**Note:** Web search unavailable during research session (both built-in WebSearch and Brave Search API). All findings based on direct codebase analysis (HIGH confidence) and training data domain knowledge (MEDIUM confidence). Competitor claims and market trends should be validated before making strategic product pivots.

---
*Research completed: 2026-02-16*
*Ready for roadmap: yes*
