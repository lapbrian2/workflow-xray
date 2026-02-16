# Architecture Research: Workflow X-Ray Hardening

**Domain:** AI-powered workflow analysis / operational diagnostics
**Researched:** 2026-02-16
**Confidence:** HIGH (based on full codebase audit + official Next.js 16 documentation)

## Current Architecture (As-Built)

### System Overview

```
+---------------------------------------------------------------+
|                    CLIENT (Browser)                            |
|  +----------+  +----------+  +----------+  +-----------+      |
|  | Workflow  |  | X-Ray    |  | Library  |  | Dashboard |      |
|  | Input     |  | Viz      |  | View     |  | View      |      |
|  +-----+----+  +-----+----+  +-----+----+  +-----+-----+      |
|        |              |             |              |            |
|  +-----+--------------+-------------+--------------+------+   |
|  |              Zustand Store (UI state only)              |   |
|  +-----+--------------+-------------+--------------+------+   |
|        |              |             |              |            |
|  +-----+--------------+-------------+--------------+------+   |
|  |             client-db.ts (localStorage cache)           |   |
|  +---------------------------------------------------------+   |
+---------------------------------------------------------------+
         |  fetch / SSE
+---------------------------------------------------------------+
|                    SERVER (Next.js API Routes)                 |
|  +----------+  +----------+  +----------+  +-----------+      |
|  | decompose|  |remediate |  | extract  |  | crawl-site|      |
|  +-----+----+  +-----+----+  +-----+----+  +-----+-----+      |
|        |              |             |              |            |
|  +-----+--------------+-------------+--------------+------+   |
|  |         Shared Server Libraries (src/lib/)              |   |
|  |   claude.ts | decompose.ts | scoring.ts | org-context   |   |
|  |   rate-limit.ts | auth.ts | extraction-schemas.ts       |   |
|  +---------------------------------------------------------+   |
|        |              |             |              |            |
|  +-----+--------------+-------------+--------------+------+   |
|  |           Storage Layer (db.ts)                         |   |
|  |   Vercel KV --> Vercel Blob --> In-Memory fallback      |   |
|  +---------------------------------------------------------+   |
+---------------------------------------------------------------+
         |
+---------------------------------------------------------------+
|                    EXTERNAL SERVICES                           |
|  +------------------+  +------------------+                   |
|  | Anthropic Claude |  | Firecrawl        |                   |
|  | (4 system prompts|  | (map + scrape)   |                   |
|  |  with caching)   |  |                  |                   |
|  +------------------+  +------------------+                   |
|  +------------------+  +------------------+                   |
|  | Notion API       |  | Vercel KV / Blob |                   |
|  | (import/export)  |  | (persistence)    |                   |
|  +------------------+  +------------------+                   |
+---------------------------------------------------------------+
```

### Component Responsibilities (Current)

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `middleware.ts` | Cookie-based password gate, path filtering | Edge Runtime, SHA-256 token format check |
| `src/lib/claude.ts` | All Claude API calls, prompt loading, caching | 4 callable functions (decompose, extract, remediate, vision), prompt hash versioning |
| `src/lib/decompose.ts` | Orchestrates workflow analysis: prompt building, Zod validation, referential integrity, cycle detection | Calls Claude, validates JSON, fixes invalid references, computes health |
| `src/lib/db.ts` | Multi-tier server persistence (KV > Blob > memory) | Dynamic backend detection via env vars |
| `src/lib/client-db.ts` | Client-side localStorage cache | Optimistic writes, merge-with-server, auto-prune on quota exceeded |
| `src/lib/store.ts` | Zustand store for UI-only state | Input mode, loading state, error, selected node, active tab |
| `src/lib/rate-limit.ts` | In-memory per-instance rate limiting | Token bucket with cleanup, IP extraction from headers |
| `src/lib/auth.ts` | Password hashing, token comparison | SHA-256 with salt, timing-safe compare |
| `src/lib/scoring.ts` | Deterministic health metric computation | Pure function: steps + gaps -> complexity, fragility, automation, load balance |
| `src/lib/org-context.ts` | Cross-workflow organizational memory | Reads workflow library, computes averages, finds similar workflows |
| `src/lib/extraction-schemas.ts` | Zod schemas for extraction + graceful recovery | Strict validation with partial-recovery fallback |
| `src/components/xray-viz.tsx` | React Flow DAG visualization | Barycenter layout, critical path, hover highlighting |
| `src/components/error-boundary.tsx` | Global React error boundary | Class component, wraps entire app via Providers |
| 13 API routes | Individual endpoint handlers | Each handles rate limiting, validation, Claude calls, storage |

### Current Data Flow

```
[User submits workflow description]
    |
    v
[WorkflowInput component]
    |
    | POST /api/decompose (with optional costContext)
    v
[API Route: decompose]
    |
    |--> buildOrgContext() -- reads existing library from db.ts
    |--> buildPrompt() -- assembles description + stages + org context
    |--> callClaude() -- sends to Anthropic with cached system prompt
    |
    v
[Claude returns JSON]
    |
    |--> JSON.parse() + Zod validation
    |--> Referential integrity checks (dedup, fix deps, fix gap refs)
    |--> Cycle detection (DFS)
    |--> computeHealth() -- pure scoring function
    |
    v
[Workflow object assembled]
    |
    |--> saveWorkflow() via db.ts (KV or Blob or memory)
    |--> Response returned to client
    |
    v
[Client receives workflow]
    |
    |--> saveWorkflowLocal() -- localStorage cache
    |--> router.push(/xray/[id])
    |
    v
[X-Ray page renders]
    |--> XRayViz (React Flow DAG)
    |--> GapAnalysis (gap cards)
    |--> HealthCard (metric bars)
```

## Recommended Architecture Improvements

The current architecture is well-structured for a first iteration. The improvements below focus on production hardening without architectural rewrites.

### Improvement 1: Layered Error Handling

**Problem identified:** The app has a single top-level `ErrorBoundary` class component in `providers.tsx`, but no route-level `error.tsx` files. API routes handle errors individually with inconsistent patterns. There is no `global-error.tsx` for root layout failures. No `not-found.tsx` anywhere.

**Recommendation:** Add Next.js App Router error files at strategic levels.

```
src/app/
  global-error.tsx         # NEW - catches root layout failures
  not-found.tsx            # NEW - global 404 page
  error.tsx                # NEW - catches page-level errors
  xray/[id]/
    error.tsx              # NEW - catches X-Ray-specific errors
    not-found.tsx          # NEW - "workflow not found" UX
    loading.tsx            # EXISTS - already present
```

The existing `error-boundary.tsx` class component should be retained for client-side rendering errors (event handlers, async effects) but augmented by Next.js file-convention error boundaries for server-side and rendering errors.

**Build order dependency:** None. Can be done early. Should be Phase 1.

### Improvement 2: API Route Error Standardization

**Problem identified:** Each of the 13 API routes handles errors independently. Error response shapes vary (some return `{ error: string }`, the crawl route returns raw JSON strings). Rate limiting is copy-pasted into every route. No shared error-response utility.

**Recommendation:** Extract a shared API utilities layer.

```
src/lib/
  api-utils.ts             # NEW - shared error responses, rate limit helper
```

This module should provide:
- `apiError(message, status, headers?)` -- standardized error response factory
- `withRateLimit(request, key, max, window)` -- wrapper that returns early on limit
- `requireApiKey()` -- checks ANTHROPIC_API_KEY, returns 503 if missing
- `parseBody(request)` -- safe JSON parsing with 400 on failure
- Consistent error response shape: `{ error: string, code?: string, retryAfter?: number }`

**Build order dependency:** Should be done before any new API routes are added. Phase 1.

### Improvement 3: Team-Size-Aware Analysis Integration

**Problem identified:** The `CostContext` type already includes `teamSize` and `teamContext` fields. The decompose route already injects these into the prompt. But the integration is partial:
- The workflow-input component has the team context UI
- The prompt injection appends team context as a text block
- The system prompt (`decompose-system.md`) has no explicit instructions about team-size-aware analysis
- Remediation builds team context into its prompt but duplicates the injection logic

**Recommendation:** The team-size-aware analysis should be strengthened in three places:

1. **System prompt enhancement:** Add team-size-aware instructions to `decompose-system.md` (e.g., "When team size is 1, never suggest delegation. When team size > 5, flag coordination overhead.")
2. **Shared prompt builder:** Extract team context prompt building from the decompose route into a shared `buildTeamContextBlock(costContext)` function in a new or existing lib file, reusable by both decompose and remediation.
3. **Scoring integration:** The `scoring.ts` `computeHealth` function should optionally accept team size to adjust the `teamLoadBalance` metric (a solo operator with all steps owned by one person is not imbalanced -- it is expected).

**Build order dependency:** System prompt change is independent. Shared prompt builder depends on API utils refactor being conceptually aligned. Scoring change can be done independently.

### Improvement 4: Testing Infrastructure

**Problem identified:** Zero test coverage. PROJECT.md explicitly calls this out. For a tool used by a consulting team, reliability matters.

**Recommendation:** Use Vitest (Next.js official recommendation as of v16.1.6) with this layered strategy:

```
__tests__/
  lib/
    scoring.test.ts        # Pure function: highest value, easiest to test
    decompose.test.ts      # Mock Claude, test Zod validation + integrity checks
    rate-limit.test.ts     # Test token bucket behavior
    org-context.test.ts    # Mock db, test context building
    extraction-schemas.test.ts  # Test recovery logic
  api/
    decompose.test.ts      # Integration test: mock Claude, test full route
    remediation.test.ts    # Integration test: mock Claude + db
  components/
    workflow-input.test.tsx # Render test, form submission
    xray-viz.test.tsx      # Render with mock decomposition
```

**Test priority order (highest value first):**
1. `scoring.ts` -- pure function, deterministic, catches regression in health metrics
2. `extraction-schemas.ts` -- recovery logic is complex, handles Claude output variation
3. `decompose.ts` -- Zod validation + referential integrity is the core quality gate
4. `rate-limit.ts` -- simple but important for production safety
5. API route integration tests -- validates end-to-end request/response shape

**Build order dependency:** Vitest setup is independent. Tests should be written alongside or immediately after code improvements. Phase 2.

### Improvement 5: Structured Logging

**Problem identified:** Current logging is `console.error` and `console.log` with inconsistent prefixes (`[crawl-site]`, `[Claude]`, `[Remediation]`). No structured format. No request ID tracking across multi-step operations (crawl pipeline has 5 stages with no correlation ID).

**Recommendation:** Add a lightweight structured logger (not a heavy library -- just a utility).

```typescript
// src/lib/logger.ts
export function createLogger(context: string) {
  return {
    info: (msg: string, data?: Record<string, unknown>) =>
      console.log(JSON.stringify({ level: 'info', context, msg, ...data, ts: Date.now() })),
    error: (msg: string, data?: Record<string, unknown>) =>
      console.error(JSON.stringify({ level: 'error', context, msg, ...data, ts: Date.now() })),
    warn: (msg: string, data?: Record<string, unknown>) =>
      console.warn(JSON.stringify({ level: 'warn', context, msg, ...data, ts: Date.now() })),
  };
}
```

Add a `requestId` (crypto.randomUUID()) at the start of each API route, pass it through to Claude calls and storage operations. The crawl pipeline SSE stream should include the requestId in every event for debugging.

**Build order dependency:** Independent. Can be done any time. Phase 1 or 2.

## Recommended Project Structure (Post-Hardening)

```
src/
  app/
    api/
      auth/route.ts           # Auth endpoint
      compare/route.ts        # Workflow comparison
      crawl-site/route.ts     # Site crawl pipeline (SSE)
      decompose/route.ts      # Core decomposition
      extract-from-screenshot/route.ts
      extract-workflows/route.ts
      notion-import/route.ts
      notion-sync/route.ts
      parse-file/route.ts
      remediation/route.ts
      remediation-notion-sync/route.ts
      scrape-url/route.ts
      workflows/route.ts
    compare/page.tsx
    dashboard/page.tsx
    library/page.tsx
    login/page.tsx
    xray/[id]/
      page.tsx
      loading.tsx
      error.tsx               # NEW - X-Ray-specific error UI
      not-found.tsx           # NEW - Workflow not found
      remediation/page.tsx
    error.tsx                 # NEW - App-level error boundary
    global-error.tsx          # NEW - Root layout error handler
    not-found.tsx             # NEW - Global 404
    layout.tsx
    page.tsx
  components/
    breadcrumb.tsx
    compare-view.tsx
    confirm-modal.tsx
    detail-panel.tsx
    error-boundary.tsx        # KEEP - client-side error boundary
    flow-edge.tsx
    flow-node.tsx
    freeform-input.tsx
    gap-analysis.tsx
    gap-card.tsx
    health-card.tsx
    layer-legend.tsx
    metric-bar.tsx
    nav.tsx
    providers.tsx
    score-ring.tsx
    stage-card.tsx
    structured-form.tsx
    toast.tsx
    version-timeline.tsx
    workflow-card.tsx
    workflow-input.tsx
    workflow-library.tsx
    xray-viz.tsx
  lib/
    api-utils.ts              # NEW - shared API error handling, rate limit wrapper
    auth.ts
    claude.ts
    client-db.ts
    db.ts
    decompose.ts
    extraction-schemas.ts
    fetch-with-timeout.ts
    logger.ts                 # NEW - structured logging utility
    org-context.ts
    pdf-batch-export.ts
    pdf-compare-export.ts
    pdf-export.ts
    pdf-remediation-export.ts
    rate-limit.ts
    scoring.ts
    scrape-utils.ts
    store.ts
    team-context.ts           # NEW - shared team context prompt builder
    types.ts
    utils.ts
  prompts/
    decompose-system.md       # MODIFY - add team-size-aware instructions
    extract-system.md
    remediation-system.md
    vision-extract-system.md
__tests__/                    # NEW - test directory
  lib/
    scoring.test.ts
    extraction-schemas.test.ts
    decompose.test.ts
    rate-limit.test.ts
  api/
    decompose.test.ts
vitest.config.mts             # NEW - Vitest configuration
```

### Structure Rationale

- **No reorganization of existing files.** The current structure is clean and follows Next.js App Router conventions. Reorganizing would create churn with zero production value.
- **New files are additive.** `api-utils.ts`, `logger.ts`, `team-context.ts`, error files, and tests are all new additions, not replacements.
- **Tests in `__tests__/` at root.** Follows the Next.js + Vitest convention shown in official docs. Mirrors `src/` structure for discoverability.
- **Prompts stay in `prompts/` at root.** Already working with `outputFileTracingIncludes` in next.config.ts. Do not move.

## Architectural Patterns

### Pattern 1: Defensive AI Output Processing

**What:** Every Claude response goes through a three-stage pipeline: JSON extraction -> Zod schema validation -> referential integrity repair. The existing `decompose.ts` already implements this well. The pattern should be codified as the standard for all AI response handling.

**When to use:** Every API route that receives structured output from Claude.

**Trade-offs:** Adds ~50ms processing per response, but prevents malformed AI output from corrupting the workflow library. Worth it.

**Example (already in codebase):**
```typescript
// Stage 1: Extract JSON from markdown-wrapped response
const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
// Stage 2: Zod validation with schema
const validated = DecompositionResponseSchema.parse(parsed);
// Stage 3: Referential integrity
step.dependencies = step.dependencies.filter(
  (depId) => validStepIds.has(depId) && depId !== step.id
);
```

**Action:** The `extraction-schemas.ts` already has `parseExtractionJson` and `recoverPartialExtraction`. This pattern is correct. Ensure remediation follows the same rigor (it currently does, via `parseExtractionJson`).

### Pattern 2: Multi-Tier Storage Abstraction

**What:** `db.ts` implements a strategy pattern for storage: KV > Blob > Memory. The caller never knows which backend is active. This is a good pattern that should be preserved.

**When to use:** All server-side data persistence.

**Trade-offs:** The current implementation re-checks env vars on every call. This is fine for correctness (env vars could theoretically change) but could cache the backend selection per request lifecycle if performance becomes an issue.

**Risk to watch:** The KV `workflow:ids` index is a flat array. If the workflow count grows past ~500, listing operations will slow down because every workflow is fetched individually. This is fine for a consulting team (likely <100 workflows) but would need pagination for scale.

### Pattern 3: SSE Streaming for Long Operations

**What:** The crawl-site route uses Server-Sent Events (SSE) to stream progress through a 5-stage pipeline (map -> scrape -> extract -> decompose -> complete). This is the correct pattern for operations that take >30 seconds.

**When to use:** Any operation that involves multiple sequential Claude calls or external service calls.

**Trade-offs:** SSE is one-directional (server -> client). The client cannot cancel mid-stream. Adding an AbortController-based cancellation would require the client to close the EventSource connection and the server to detect the disconnect.

**Action:** Keep this pattern. Consider adding it for batch operations if those are added later.

### Pattern 4: Prompt Versioning via Content Hashing

**What:** `claude.ts` hashes each system prompt file (SHA-256, first 12 chars) and stores the hash with every workflow. This creates an audit trail linking each analysis to the exact prompt that produced it.

**When to use:** Every Claude call. Already implemented consistently.

**Trade-offs:** Content hashing means identical prompts across different files would produce the same hash. This is actually desirable (dedup). The hashes are stored but not currently surfaced in the UI -- consider showing prompt version in a "diagnostic details" section.

## Anti-Patterns

### Anti-Pattern 1: Duplicated Rate Limit Boilerplate

**What people do:** Every API route has 5-8 lines of identical rate limiting code: get IP, call rateLimit(), check allowed, build 429 response.

**Why it is wrong:** Inconsistency risk (different routes could drift in error format), unnecessary code duplication, harder to change rate limit strategy globally.

**Do this instead:** Extract a `withRateLimit(request, key, max, windowSec)` utility in `api-utils.ts` that returns either `null` (allowed) or a pre-built `NextResponse` (429). Each route becomes a one-liner check.

### Anti-Pattern 2: Inline Error Message Mapping in API Routes

**What people do:** The decompose route has a long if/else chain mapping error messages to user-friendly strings. The remediation route has a different but similar chain.

**Why it is wrong:** Error classification logic is duplicated and inconsistent across routes. Some routes expose raw error messages, others sanitize them.

**Do this instead:** Create an `apiErrorFromException(error: unknown)` function in `api-utils.ts` that classifies common error types (Zod validation, Claude timeout, Claude rate limit, prompt not found, generic) and returns a standardized `{ message, status }`. Each route uses this in its catch block.

### Anti-Pattern 3: Missing Route-Level Error Boundaries

**What people do:** Rely solely on the top-level `ErrorBoundary` class component for all error display.

**Why it is wrong:** A rendering error in the X-Ray visualization (e.g., malformed step data crashes React Flow) takes down the entire app instead of just the X-Ray page. The user loses all navigation context and can only "Return Home."

**Do this instead:** Add `error.tsx` at `src/app/xray/[id]/error.tsx` and `src/app/error.tsx`. The X-Ray error boundary can offer "View in Library" or "Re-analyze" options specific to the context. The app-level error boundary preserves the Nav component.

### Anti-Pattern 4: No Input Sanitization Standard

**What people do:** Each route independently validates and truncates input (description.length > 15000, content.length > 30000, various `.slice()` calls with different limits).

**Why it is wrong:** Limits are magic numbers scattered across files. No central documentation of size constraints. Easy to miss a new field.

**Do this instead:** Define input limits as named constants in a shared location (e.g., `src/lib/constants.ts` or within `types.ts`). Reference these constants in both API validation and client-side form hints.

## Integration Points

### External Services

| Service | Integration Pattern | Hardening Notes |
|---------|---------------------|-----------------|
| Anthropic Claude API | Direct SDK (`@anthropic-ai/sdk`), 4 prompt-specific wrapper functions | Timeout already set (45s). Add retry with exponential backoff for transient 500/503 errors from Anthropic. Currently fails immediately on first error. |
| Firecrawl | Direct SDK (`@mendable/firecrawl-js`), map + scrape operations | Good error handling with fallback to single-page scrape. SSRF protection present. Credit exhaustion (402) properly handled. |
| Notion API | Direct SDK (`@notionhq/client`), import and sync operations | Not audited in detail for this research. Check error handling matches patterns. |
| Vercel KV | Dynamic import, key-value operations | Good pattern: checks env vars before attempting import. No retry logic, but KV is generally reliable. |
| Vercel Blob | Dynamic import, file-based storage | Good pattern: public access with no random suffix. List + fetch pattern for reads could be slow with many blobs. |

### Internal Boundaries

| Boundary | Communication | Hardening Notes |
|----------|---------------|-----------------|
| Client <-> API | fetch / SSE via `fetchWithTimeout` | Timeout set to 120s for decompose. SSE for crawl. No client-side retry logic. Consider adding retry for transient failures. |
| API Route <-> Claude wrapper | Direct function call | Error propagation is good. Add structured logging with requestId. |
| API Route <-> Storage | Direct function call to `db.ts` | Storage errors are mostly caught but some routes silently fail (decompose catches listing failure for version counting). Acceptable -- versioning is non-critical. |
| Claude wrapper <-> Prompt files | `readFileSync` with multi-path fallback | Multiple search paths handle different deployment contexts (dev, prod, .next bundle). Caching prevents re-reads. Robust. |
| Client <-> localStorage | `client-db.ts` with quota handling | Auto-prune on QuotaExceededError. Merge-with-server on page load. Good pattern. |
| Zustand Store <-> Components | React hooks (`useStore`) | Store is UI-only state (no data persistence). Correct boundary. |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-10 users (current: consulting team) | Current architecture is well-suited. In-memory rate limiting works because Vercel typically routes to same instance for warm invocations. KV handles persistence fine. No changes needed. |
| 10-100 users | In-memory rate limiting becomes unreliable across multiple serverless instances. Swap to Vercel KV-backed rate limiting (the code already notes this possibility). KV `workflow:ids` flat array starts to slow on listing -- add cursor-based pagination. |
| 100+ users | Out of scope per PROJECT.md. Would need: user accounts, per-user workflow isolation, distributed rate limiting, pagination, background job processing for crawl pipeline. This is a different product. |

### Scaling Priorities

1. **First bottleneck:** Claude API rate limits and token costs. The prompt caching already mitigates this. Rate limiting per user is the correct defense. If costs grow, consider caching decomposition results for identical inputs (hash description -> check cache before calling Claude).
2. **Second bottleneck:** KV listing performance. The `workflow:ids` array loaded in full on every `listWorkflows()` call. For the consulting team scale (likely <100 workflows), this is a non-issue. Beyond that, needs pagination or a secondary index.

## Component Communication Map (Build Order)

This map shows what depends on what, informing the roadmap phase order.

```
[Error Handling Layer]                    # NO dependencies, build first
  error.tsx, global-error.tsx,
  not-found.tsx files

[API Utils Layer]                         # NO dependencies, build first
  api-utils.ts, logger.ts, constants.ts

[Team Context Layer]                      # Depends on: types.ts (exists)
  team-context.ts, prompt modifications

[Testing Infrastructure]                  # Depends on: everything above existing
  vitest.config.mts, scoring tests,       #   (tests validate existing behavior)
  schema tests, decompose tests

[API Route Refactoring]                   # Depends on: API Utils Layer
  Refactor 13 routes to use shared utils

[Scoring Refinement]                      # Depends on: Team Context Layer
  Team-size-aware health metrics

[System Prompt Updates]                   # Depends on: Team Context Layer
  decompose-system.md modifications
```

**Critical path:** Error handling and API utils have no dependencies and should be Phase 1. Team context is Phase 2. Testing runs parallel to or immediately after both.

## Sources

- Full codebase audit: all 60+ source files in `src/`, `prompts/`, `middleware.ts`, `next.config.ts`
- Next.js 16.1.6 official documentation: Error Handling (https://nextjs.org/docs/app/building-your-application/routing/error-handling) -- HIGH confidence, verified via WebFetch
- Next.js 16.1.6 official documentation: Testing with Vitest (https://nextjs.org/docs/app/building-your-application/testing/vitest) -- HIGH confidence, verified via WebFetch
- Next.js 16.1.6 official documentation: Testing overview (https://nextjs.org/docs/app/building-your-application/testing) -- HIGH confidence, verified via WebFetch
- PROJECT.md from `.planning/` -- current milestone context and constraints

---
*Architecture research for: Workflow X-Ray hardening milestone*
*Researched: 2026-02-16*
