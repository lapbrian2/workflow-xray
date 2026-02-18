# Architecture Research: v1.1 Quality & Intelligence Integration

**Domain:** Testing infrastructure, analysis caching, and advanced analytics integration into existing Next.js 16 App Router application
**Researched:** 2026-02-18
**Confidence:** HIGH (based on full codebase audit of 73 source files, training data for Vitest/Playwright/MSW patterns)

**Note on sources:** Web search was unavailable during this research. Vitest, Playwright, and MSW recommendations are based on training data (HIGH confidence for established patterns) and the v1.0 architecture research that verified Next.js 16 testing docs via WebFetch. Specific version numbers should be validated at install time.

---

## Current Architecture Summary

The existing system has a clean three-layer architecture that the new features must respect:

```
+---------------------------------------------------------------+
|                    CLIENT (Browser)                            |
|  Zustand store (UI state) + client-db.ts (localStorage)       |
|  Pages: /, /library, /dashboard, /compare, /xray/[id], /login |
|  Components: 22 files in src/components/                      |
+---------------------------------------------------------------+
         | fetch / SSE
+---------------------------------------------------------------+
|                    SERVER (Next.js API Routes)                 |
|  13 routes in src/app/api/                                    |
|  Shared: api-handler.ts, api-errors.ts, validation.ts         |
|  Business: claude.ts, decompose.ts, scoring.ts, org-context.ts|
+---------------------------------------------------------------+
         |
+---------------------------------------------------------------+
|                    STORAGE + EXTERNAL                          |
|  db.ts: Vercel KV > Blob > in-memory                         |
|  Claude API (4 prompt types, SDK with retries)                |
|  Firecrawl, Notion API                                        |
+---------------------------------------------------------------+
```

---

## 1. Testing Infrastructure Architecture

### 1.1 File Placement Strategy

Tests live in `__tests__/` at the project root, mirroring `src/` structure. This follows the Next.js + Vitest convention established in the v1.0 research and avoids polluting `src/` with test files.

```
workflow-xray/
  __tests__/
    lib/                          # Unit tests for pure business logic
      scoring.test.ts             # computeHealth() -- pure, deterministic
      team-calibration.test.ts    # getTeamTier(), getThresholds() -- pure
      chart-data.test.ts          # computeHealthTrends() -- pure
      decompose.test.ts           # JSON extraction, Zod validation, integrity
      extraction-schemas.test.ts  # parseExtractionJson, recoverPartial
      rate-limit.test.ts          # Token bucket behavior
      org-context.test.ts         # buildOrgContext, formatOrgContextForPrompt
      utils.test.ts               # generateId, formatDate, truncate
      validation.test.ts          # Zod schema edge cases
    api/                          # Integration tests for API routes
      decompose.test.ts           # Full SSE flow with mocked Claude
      workflows.test.ts           # CRUD operations with mocked db
      remediation.test.ts         # Plan generation with mocked Claude
      compare.test.ts             # Comparison logic via route
    mocks/                        # Shared mock utilities
      handlers.ts                 # MSW request handlers
      fixtures.ts                 # Reusable test data (workflows, steps, gaps)
      server.ts                   # MSW server setup
  e2e/                            # Playwright E2E tests
    submit-and-analyze.spec.ts    # Critical path: input -> decompose -> xray
    library-management.spec.ts    # Save, search, delete workflows
    export-pdf.spec.ts            # Export triggers (cannot verify PDF content)
    dashboard.spec.ts             # Dashboard renders with data
  vitest.config.mts               # Vitest configuration
  playwright.config.ts            # Playwright configuration
```

### 1.2 Vitest Configuration

The Vitest config must handle three constraints specific to this codebase:

1. **Path aliases**: The codebase uses `@/*` -> `./src/*` via tsconfig paths
2. **Node APIs**: `claude.ts` uses `crypto.createHash` and `fs.readFileSync`
3. **Next.js server imports**: API routes import from `next/server`

```typescript
// vitest.config.mts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',         // Server-side logic, not jsdom
    globals: true,               // describe/it/expect without imports
    include: ['__tests__/**/*.test.ts'],
    exclude: ['e2e/**'],         // Playwright runs separately
    setupFiles: ['__tests__/mocks/server.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: [
        'src/lib/client-db.ts',  // Browser-only (localStorage)
        'src/lib/store.ts',      // Zustand client store
        'src/lib/pdf-*.ts',      // PDF generation (visual output)
        'src/lib/flow-capture.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Rationale for `environment: 'node'`:** The primary test targets are server-side lib files (`scoring.ts`, `decompose.ts`, `claude.ts`, API routes). These use Node APIs (`crypto`, `fs`) and Next.js server types (`NextRequest`, `NextResponse`). Using `jsdom` would add complexity for no benefit. Component tests are explicitly out of scope for v1.1 (see PROJECT.md).

### 1.3 MSW Integration for Claude API Mocking

MSW (Mock Service Worker) intercepts HTTP requests at the network level, which is the correct abstraction for mocking the Anthropic SDK. The SDK makes HTTP calls to `https://api.anthropic.com/v1/messages`. MSW intercepts these transparently -- the SDK code in `claude.ts` runs unmodified.

**Why MSW over manual mocks:** The `callClaude()` function in `claude.ts` creates the Anthropic client at module scope (`const client = new Anthropic(...)`) and uses it in all 4 call functions. Mocking at the function level (e.g., `vi.mock('./claude')`) would bypass the Zod validation, JSON extraction, and referential integrity logic in `decompose.ts` -- the very code we want to test. MSW lets us test the full pipeline from API route through Claude response processing.

```
[Test]
    |
    | POST /api/decompose (via Vitest's fetch or direct handler call)
    v
[decompose route.ts]
    |
    | callClaude(prompt) -> Anthropic SDK -> HTTPS request
    v
[MSW Interceptor] <-- intercepts at network level
    |
    | Returns mock Claude JSON response
    v
[decompose.ts processes response]
    |
    | Zod validation -> integrity checks -> computeHealth
    v
[Test asserts on final Workflow object]
```

**MSW handler structure:**

```
__tests__/mocks/
  handlers.ts      # Request handlers for Anthropic API + Vercel KV/Blob
  fixtures.ts      # Pre-built valid/invalid Claude response payloads
  server.ts        # MSW setupServer() with default handlers
```

**Key handlers needed:**

| Endpoint | Purpose | Handler Behavior |
|----------|---------|------------------|
| `POST https://api.anthropic.com/v1/messages` | Claude API calls | Return fixture JSON wrapped in Anthropic response format |
| Vercel KV operations | Storage mocking | Return mock workflow data for reads |

**Anthropic response format:** The SDK expects a specific response shape. MSW handlers must return this shape:

```typescript
// In handlers.ts
import { http, HttpResponse } from 'msw';

export const claudeHandler = http.post(
  'https://api.anthropic.com/v1/messages',
  async ({ request }) => {
    const body = await request.json();
    const systemText = body.system?.[0]?.text || '';

    // Route to different fixtures based on which prompt is being used
    const fixture = systemText.includes('decompose')
      ? DECOMPOSE_FIXTURE
      : systemText.includes('remediation')
        ? REMEDIATION_FIXTURE
        : EXTRACTION_FIXTURE;

    return HttpResponse.json({
      id: 'msg_mock_001',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: JSON.stringify(fixture) }],
      model: 'claude-sonnet-4-20250514',
      usage: { input_tokens: 1500, output_tokens: 800 },
      stop_reason: 'end_turn',
    });
  }
);
```

**Critical consideration -- prompt file access:** `claude.ts` loads prompt files via `readFileSync` from disk. During tests, these paths must resolve. Since Vitest runs from the project root, the first search path in `loadPrompt()` (`join(process.cwd(), 'src/prompts/...'))` will work. No special setup needed.

### 1.4 Testing SSE Streams

The `/api/decompose` route returns a `ReadableStream` with SSE events. Testing this requires consuming the stream in the test:

**Approach:** Import the route handler directly and call it with a mock `NextRequest`. Read the response stream to completion and parse SSE events.

```typescript
// __tests__/api/decompose.test.ts
import { POST } from '@/app/api/decompose/route';

async function collectSSEEvents(response: Response): Promise<unknown[]> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const events: unknown[] = [];
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        events.push(JSON.parse(line.slice(6)));
      }
    }
  }
  return events;
}

// Test uses:
const request = new Request('http://localhost/api/decompose', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ description: 'Test workflow...' }),
});
// Cast to NextRequest or use NextRequest constructor
const response = await POST(request as any);
const events = await collectSSEEvents(response);
// Assert: events contain progress, then complete/partial
```

**Environment variable requirement:** The decompose route checks `process.env.ANTHROPIC_API_KEY` before streaming. Tests must set this:

```typescript
// In test setup or beforeAll
process.env.ANTHROPIC_API_KEY = 'test-key-for-msw';
process.env.ALLOW_MEMORY_STORAGE = 'true'; // Use in-memory storage backend
```

### 1.5 Storage Mocking Strategy

The `db.ts` storage layer auto-selects backends based on environment variables. For tests, the simplest approach is using the in-memory backend:

| Approach | How | When to Use |
|----------|-----|-------------|
| In-memory backend | Set `ALLOW_MEMORY_STORAGE=true`, unset KV/Blob vars | Most tests -- fast, isolated, real code path |
| Direct vi.mock | `vi.mock('@/lib/db')` | When testing code that calls db but db behavior is irrelevant |
| MSW for KV/Blob | Intercept Vercel KV REST API calls | Only if testing KV-specific behavior |

**Recommended default:** Use `ALLOW_MEMORY_STORAGE=true` for integration tests. The in-memory backend exercises the same `saveWorkflow`/`getWorkflow`/`listWorkflows` interface. Data resets on each test run since the globalThis store is fresh per Vitest worker.

**Important caveat:** The in-memory store uses `globalThis.__workflowStore` which persists across tests within the same worker. Add a `beforeEach` cleanup:

```typescript
beforeEach(() => {
  const store = (globalThis as any).__workflowStore;
  if (store) store.clear();
});
```

### 1.6 Playwright E2E Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,          // 60s -- Claude calls can be slow even mocked
  fullyParallel: false,     // Sequential -- tests may share server state
  retries: 1,
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
    timeout: 30_000,
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

**E2E and API mocking:** For Playwright E2E tests, MSW cannot intercept server-side requests (it runs in the browser context for Playwright). Two options:

1. **Environment variable toggle:** Add a `MOCK_CLAUDE=true` env var that causes `claude.ts` to return fixture data instead of calling the API. Simple and effective for E2E tests.
2. **Proxy approach:** Run a local proxy that intercepts Anthropic API calls. More complex, less reliable.

**Recommendation:** Use option 1. Add a check at the top of each `callClaude*` function:

```typescript
if (process.env.MOCK_CLAUDE === 'true') {
  return MOCK_RESPONSE; // Loaded from a fixtures file
}
```

This is an explicit, visible testing seam that does not affect production code (env var is not set in Vercel).

### 1.7 Files Affected by Testing Infrastructure

| File | Action | Purpose |
|------|--------|---------|
| `vitest.config.mts` | NEW | Vitest configuration with path aliases |
| `playwright.config.ts` | NEW | Playwright E2E configuration |
| `__tests__/mocks/server.ts` | NEW | MSW server setup |
| `__tests__/mocks/handlers.ts` | NEW | MSW request handlers for Claude API |
| `__tests__/mocks/fixtures.ts` | NEW | Reusable test data |
| `__tests__/lib/*.test.ts` | NEW (8-9 files) | Unit tests for lib modules |
| `__tests__/api/*.test.ts` | NEW (3-4 files) | API route integration tests |
| `e2e/*.spec.ts` | NEW (3-4 files) | Playwright E2E tests |
| `package.json` | MODIFY | Add devDependencies + test scripts |
| `tsconfig.json` | MODIFY | Ensure `__tests__/` and `e2e/` are included |
| `src/lib/claude.ts` | MODIFY (optional) | Add `MOCK_CLAUDE` check for E2E tests |

**No existing source files need structural changes for unit/integration tests.** The architecture is already testable because business logic lives in `src/lib/` as importable functions, separate from route handlers.

---

## 2. Analysis Caching Architecture

### 2.1 Cache Strategy Overview

The goal is to avoid re-calling Claude for identical workflow descriptions. A content hash computed from the user's input serves as the cache key.

```
[User submits workflow description]
    |
    v
[Compute content hash]
    | SHA-256 of: normalized(description) + promptVersion + modelId
    v
[Check cache: db.getCache(hash)]
    |
    +-- HIT --> Return cached Decomposition (skip Claude call)
    |
    +-- MISS --> Call Claude -> validate -> save workflow + save cache entry
```

### 2.2 Content Hash Computation

The hash must account for everything that affects Claude's output:

| Input Component | Why Included | Source |
|-----------------|-------------|--------|
| Workflow description (normalized) | Primary input | `request.description` after whitespace normalization |
| Structured stages (if any) | Changes the prompt | `request.stages` serialized |
| Team/cost context | Affects Claude's recommendations | `body.costContext` serialized |
| System prompt hash | Prompt changes = different output | `getPromptVersion()` from `claude.ts` |
| Model ID | Different models = different output | `getModelId()` from `claude.ts` |

**Existing infrastructure to reuse:** The `claude.ts` module already has a `createHash('sha256')` import and uses it for prompt hashing. The same pattern applies here.

**Proposed implementation location:** New file `src/lib/analysis-cache.ts`

```typescript
// src/lib/analysis-cache.ts
import { createHash } from 'crypto';
import { getPromptVersion, getModelId } from './claude';

export function computeAnalysisHash(
  description: string,
  stages?: unknown[],
  costContext?: unknown
): string {
  const normalized = description.replace(/\r\n/g, '\n').trim().toLowerCase();
  const payload = JSON.stringify({
    d: normalized,
    s: stages || [],
    c: costContext || {},
    p: getPromptVersion(),
    m: getModelId(),
  });
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}
```

**Hash length (16 hex chars = 64 bits):** Sufficient for collision resistance at the scale of a consulting team's workflow library (hundreds, not millions, of entries). Shorter hashes are easier to log and debug.

### 2.3 Cache Storage Location

The cache must live alongside workflows in the existing storage layer. Two options:

| Option | Implementation | Pros | Cons |
|--------|---------------|------|------|
| **KV namespace** (recommended) | `cache:{hash}` keys in Vercel KV | Fast lookup, leverages existing KV infrastructure, TTL support | Adds to KV key count |
| Separate cache map | In-memory Map + KV fallback | Simple | Loses cache on cold start |

**Recommendation:** Use the existing KV infrastructure with a `cache:` prefix. KV already supports TTL for automatic expiration.

**Cache entry shape:**

```typescript
interface CacheEntry {
  hash: string;
  decomposition: Decomposition;  // The validated result
  metadata: DecomposeMetadata;    // Token usage, prompt version, model
  cachedAt: string;               // ISO timestamp
  hitCount: number;               // Track cache effectiveness
}
```

### 2.4 Cache Integration Point

The cache check integrates into the decompose route's SSE flow, between validation and the Claude call:

```
[decompose/route.ts -- current flow]
  1. Rate limit check
  2. Input validation
  3. SSE stream start
  4. Build org context          <-- cache check goes AFTER this
  5. Build prompt
  6. Call Claude                <-- cache HIT skips this
  7. Validate + integrity check <-- cache HIT skips this
  8. Compute health             <-- cache HIT skips this
  9. Save workflow
  10. Send complete event

[decompose/route.ts -- with cache]
  1. Rate limit check
  2. Input validation
  3. SSE stream start
  4. Compute content hash       <-- NEW
  5. Check cache                <-- NEW
     +-- HIT: send progress "Using cached analysis..."
     |   Assemble workflow from cached decomposition
     |   Jump to step 9
     +-- MISS: continue to step 6
  6. Build org context
  7. Build prompt
  8. Call Claude
  9. Validate + integrity check
  10. Compute health
  11. Save to cache             <-- NEW
  12. Save workflow
  13. Send complete event
```

**Important design decision:** The cache stores the Decomposition result (after Zod validation and integrity checks), not the raw Claude response. This means cached results are already validated and do not need re-processing.

### 2.5 Cache Invalidation

| Trigger | Action | Why |
|---------|--------|-----|
| Prompt file changes | Automatic via `promptVersion` in hash | Hash changes when prompt changes |
| Model changes | Automatic via `modelId` in hash | Hash changes when model changes |
| Time-based expiry | 7-day TTL on KV entries | Prevents serving stale analysis if Claude improves |
| Manual invalidation | User re-analyzes with "force refresh" option | New checkbox or button in workflow-input UI |

**Force refresh mechanism:** Add an optional `skipCache?: boolean` field to the decompose request body. When true, skip the cache check and always call Claude. After receiving results, update the cache entry.

### 2.6 Files Affected by Caching

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/analysis-cache.ts` | NEW | Hash computation, cache get/set, TTL logic |
| `src/app/api/decompose/route.ts` | MODIFY | Add cache check before Claude call, cache write after |
| `src/lib/validation.ts` | MODIFY | Add `skipCache` to `DecomposeInputSchema` |
| `src/lib/types.ts` | MODIFY | Add `cacheHit?: boolean` to Workflow type (provenance tracking) |
| `src/lib/db.ts` | MODIFY (optional) | Add `getCache`/`setCache` functions, or cache module handles KV directly |
| `src/components/workflow-input.tsx` | MODIFY | Add "force re-analyze" option |

### 2.7 Cache Data Flow Diagram

```
                     decompose/route.ts
                           |
           +---------------+---------------+
           |                               |
    computeAnalysisHash()          [on MISS after Claude call]
           |                               |
           v                               v
    analysis-cache.ts              analysis-cache.ts
    getCache(hash)                 setCache(hash, result)
           |                               |
           v                               v
        db.ts                           db.ts
    KV: GET cache:{hash}         KV: SET cache:{hash} (TTL=7d)
```

---

## 3. Advanced Analytics Architecture

### 3.1 Analytics Data Model

The existing dashboard (`src/app/dashboard/page.tsx`) already computes analytics client-side from the workflow list: health averages, team workload, tool usage, gap stats, layer distribution, volume over time, and health trends. The v1.1 analytics extend this in two directions:

1. **Time-series health tracking across versions** -- compare health metrics across workflow versions (parentId chain)
2. **Batch comparison trends** -- aggregate comparison insights across multiple workflow pairs

### 3.2 Analytics Data Requirements

**What data already exists:**

| Data | Where | Format |
|------|-------|--------|
| Health metrics per workflow | `workflow.decomposition.health` | `{ complexity, fragility, automationPotential, teamLoadBalance }` |
| Version chains | `workflow.parentId` + `workflow.version` | String ID + number |
| Token usage | `workflow.tokenUsage` | `{ inputTokens, outputTokens }` |
| Creation timestamps | `workflow.createdAt` | ISO string |
| Gap data | `workflow.decomposition.gaps` | Array of Gap objects |
| Step data | `workflow.decomposition.steps` | Array of Step objects |
| Prompt version | `workflow.promptVersion` | Hash string |

**What new data is needed:**

| Data | Purpose | Storage Approach |
|------|---------|------------------|
| Cache hit/miss per analysis | Track cost savings from caching | `workflow.cacheHit: boolean` field |
| Cumulative token cost | Dashboard cost tracking | Computed client-side from `tokenUsage` |
| Version health deltas | Show improvement trajectory | Computed client-side from version chain |
| Cross-workflow gap patterns | Identify systemic org issues | Computed client-side from all gaps |

**Key insight:** No new storage schema is needed for analytics. All analytics data can be derived from existing workflow fields plus the new `cacheHit` boolean. The analytics logic is computation, not storage.

### 3.3 New Analytics Computations

These functions belong in new or extended lib files:

```
src/lib/
  chart-data.ts              # EXTEND: add version-chain health trend computation
  analytics.ts               # NEW: cross-workflow aggregate computations
```

**analytics.ts responsibilities:**

| Function | Input | Output | Purpose |
|----------|-------|--------|---------|
| `computeVersionHealthTrajectory(workflows)` | All workflows with parentId chains | `{ workflowId, versions: { version, health }[] }[]` | Health improvement over versions |
| `computeCostAnalytics(workflows)` | All workflows with tokenUsage | `{ totalTokens, estimatedCost, avgTokensPerAnalysis, cacheHitRate }` | Token cost dashboard |
| `computeGapPatterns(workflows)` | All workflows | `{ gapType, frequency, avgSeverity, trendDirection }[]` | Systemic gap identification |
| `computeOwnerRiskMap(workflows)` | All workflows | `{ owner, singleDependencyCount, avgFragilityContribution }[]` | Bus factor analysis |

### 3.4 Dashboard Component Additions

The existing dashboard page (`src/app/dashboard/page.tsx`) is a single 973-line client component. New analytics sections should be added as extracted sub-components to keep the file manageable.

```
src/components/
  analytics/                     # NEW directory for analytics components
    version-trajectory.tsx       # Health trajectory across workflow versions
    cost-breakdown.tsx           # Token usage and cache savings
    gap-heatmap.tsx              # Gap type x severity heatmap
    owner-risk-matrix.tsx        # Owner load vs single-dependency risk
```

**Dashboard integration pattern:**

```
src/app/dashboard/page.tsx
  |
  |-- [existing] HealthStat grid (4 ScoreRings)
  |-- [existing] 2-column grid (workload, tools, gaps, layers)
  |-- [existing] Automation Opportunities
  |-- [existing] Health Trends (HealthTrendChart)
  |-- [existing] Workflow Volume
  |
  |-- [NEW] Version Trajectory section
  |-- [NEW] Cost Breakdown section
  |-- [NEW] Gap Heatmap section
  |-- [NEW] Owner Risk Matrix section
```

Each new section follows the existing `Section` component pattern already defined in `dashboard/page.tsx`.

### 3.5 chart-data.ts Extensions

The existing `computeHealthTrends()` operates on a flat list of workflows grouped by time bucket. For version-chain tracking, a new function is needed:

```typescript
// Addition to chart-data.ts

export interface VersionHealthPoint {
  version: number;
  health: HealthMetrics;
  createdAt: string;
  workflowId: string;
}

export interface VersionChainTrend {
  rootId: string;           // Original workflow ID
  rootTitle: string;        // Original workflow title
  points: VersionHealthPoint[];
  totalImprovement: {       // Delta from first to last version
    complexity: number;
    fragility: number;
    automationPotential: number;
    teamLoadBalance: number;
  };
}

export function computeVersionChainTrends(
  workflows: Workflow[]
): VersionChainTrend[] {
  // Group by parentId chain, sort by version, compute deltas
}
```

### 3.6 Files Affected by Analytics

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/analytics.ts` | NEW | Cross-workflow aggregate computations |
| `src/lib/chart-data.ts` | MODIFY | Add `computeVersionChainTrends()` |
| `src/lib/types.ts` | MODIFY | Add `cacheHit?: boolean` to Workflow |
| `src/app/dashboard/page.tsx` | MODIFY | Import and render new analytics sections |
| `src/components/analytics/version-trajectory.tsx` | NEW | Version health trajectory chart |
| `src/components/analytics/cost-breakdown.tsx` | NEW | Token cost and cache savings display |
| `src/components/analytics/gap-heatmap.tsx` | NEW | Gap frequency heatmap |
| `src/components/analytics/owner-risk-matrix.tsx` | NEW | Owner risk analysis |

---

## 4. Cross-Feature Dependency Map

The three feature areas have specific dependencies that determine build order:

```
[Testing Infrastructure]
  |
  | Vitest setup, MSW mocks, fixtures
  | Tests for: scoring, decompose, extraction-schemas, rate-limit
  |
  | NO dependencies on caching or analytics
  | Should be built FIRST so subsequent features have test coverage
  |
  v
[Analysis Caching]
  |
  | Depends on: types.ts (cacheHit field), db.ts (KV access), claude.ts (hash inputs)
  | Modifies: decompose/route.ts (the most critical API route)
  |
  | Testing infrastructure should exist so cache can be tested immediately
  |
  v
[Advanced Analytics]
  |
  | Depends on: types.ts (cacheHit field added by caching phase)
  | Depends on: existing chart-data.ts and dashboard/page.tsx
  | New components are additive -- no existing component modifications
  |
  | Benefits from cache being done (can show cache hit rate analytics)
```

### Build Order Recommendation

1. **Testing first** -- establishes the safety net before modifying critical paths
2. **Caching second** -- modifies the decompose route (most critical code path) with test coverage already in place
3. **Analytics third** -- additive components that depend on the `cacheHit` field added during caching

---

## 5. Complete File Impact Matrix

### New Files (17 files)

| File | Feature Area | Priority |
|------|-------------|----------|
| `vitest.config.mts` | Testing | Phase 1 |
| `playwright.config.ts` | Testing | Phase 1 |
| `__tests__/mocks/server.ts` | Testing | Phase 1 |
| `__tests__/mocks/handlers.ts` | Testing | Phase 1 |
| `__tests__/mocks/fixtures.ts` | Testing | Phase 1 |
| `__tests__/lib/scoring.test.ts` | Testing | Phase 1 |
| `__tests__/lib/team-calibration.test.ts` | Testing | Phase 1 |
| `__tests__/lib/chart-data.test.ts` | Testing | Phase 1 |
| `__tests__/lib/decompose.test.ts` | Testing | Phase 1 |
| `__tests__/lib/extraction-schemas.test.ts` | Testing | Phase 1 |
| `__tests__/api/decompose.test.ts` | Testing | Phase 1 |
| `e2e/submit-and-analyze.spec.ts` | Testing | Phase 1 |
| `src/lib/analysis-cache.ts` | Caching | Phase 2 |
| `src/lib/analytics.ts` | Analytics | Phase 3 |
| `src/components/analytics/version-trajectory.tsx` | Analytics | Phase 3 |
| `src/components/analytics/cost-breakdown.tsx` | Analytics | Phase 3 |
| `src/components/analytics/gap-heatmap.tsx` | Analytics | Phase 3 |

### Modified Files (8 files)

| File | Feature Area | What Changes |
|------|-------------|--------------|
| `package.json` | Testing | Add vitest, @vitest/coverage-v8, msw, playwright devDeps + scripts |
| `tsconfig.json` | Testing | Ensure `__tests__/` and `e2e/` are in `include` |
| `src/lib/types.ts` | Caching | Add `cacheHit?: boolean` to `Workflow` interface |
| `src/lib/validation.ts` | Caching | Add `skipCache?: boolean` to `DecomposeInputSchema` |
| `src/app/api/decompose/route.ts` | Caching | Add cache check/write around Claude call |
| `src/lib/chart-data.ts` | Analytics | Add `computeVersionChainTrends()` function |
| `src/app/dashboard/page.tsx` | Analytics | Import and render new analytics components |
| `src/components/workflow-input.tsx` | Caching | Add "force re-analyze" checkbox |

### Untouched Files (65 files)

All other existing source files remain unchanged. The architecture specifically avoids modifying:
- `src/lib/claude.ts` (unless MOCK_CLAUDE seam is added for E2E)
- `src/lib/db.ts` (cache module accesses KV directly)
- `src/lib/scoring.ts` (tested as-is, no changes needed)
- `src/lib/decompose.ts` (tested as-is, no changes needed)
- All 22 component files (except `workflow-input.tsx`)
- All 12 other API routes (only `decompose/route.ts` gets caching)

---

## 6. Anti-Patterns to Avoid

### Anti-Pattern 1: Mocking Claude at the Function Level

**What people do:** `vi.mock('@/lib/claude', () => ({ callClaude: vi.fn() }))` to stub out Claude for decompose tests.

**Why it is wrong:** This skips the JSON extraction, Zod validation, referential integrity checks, and health computation in `decompose.ts`. Those are the most valuable things to test. The whole point of the decompose pipeline is resilient handling of Claude's variable output format.

**Do this instead:** Use MSW to intercept the HTTP request to `api.anthropic.com`. Return fixture data at the network level. Let the full `claude.ts` -> `decompose.ts` pipeline run. Test that malformed fixtures trigger partial recovery, that valid fixtures produce correct health scores, and that missing fields are handled gracefully.

### Anti-Pattern 2: Caching Raw Claude Responses

**What people do:** Cache Claude's raw text response and re-parse it on cache hits.

**Why it is wrong:** Re-parsing means re-running Zod validation, JSON extraction, and integrity checks on every cache hit. This adds latency and, worse, if a Zod schema changes between the cache write and cache read, the cached response might fail validation.

**Do this instead:** Cache the fully-validated `Decomposition` object (post-Zod, post-integrity-check, post-health-computation). Cache hits return immediately usable data.

### Anti-Pattern 3: Computing Analytics Server-Side

**What people do:** Add API routes to compute analytics aggregations server-side, fetching all workflows from KV, computing, and returning.

**Why it is wrong:** The dashboard already loads all workflows client-side for rendering. Adding a server-side computation creates a second full data fetch. At consulting team scale (<100 workflows), client-side computation in `useMemo` is instant. Server-side computation adds latency and complexity for zero benefit.

**Do this instead:** Keep analytics computations in client-side lib files (`analytics.ts`, `chart-data.ts`). The dashboard fetches the workflow list once (already does this) and derives everything locally. This matches the existing pattern.

### Anti-Pattern 4: Putting E2E Tests Behind the Same MSW Server

**What people do:** Try to use the same MSW server for both Vitest unit tests and Playwright E2E tests.

**Why it is wrong:** MSW in Vitest intercepts Node.js HTTP requests (server-side). MSW in Playwright would intercept browser-side requests. But the Claude API calls happen server-side in Next.js API routes, not in the browser. Playwright's MSW cannot intercept server-side network calls.

**Do this instead:** Use MSW for Vitest tests (server-side intercept). For Playwright E2E, use an environment variable toggle (`MOCK_CLAUDE=true`) that causes `claude.ts` to return fixtures directly. These are two separate mocking strategies for two separate test contexts.

---

## 7. Integration Points Summary

### How Each New Feature Touches Existing Code

```
TESTING
  reads: scoring.ts, decompose.ts, team-calibration.ts, chart-data.ts,
         extraction-schemas.ts, rate-limit.ts, validation.ts, API routes
  writes: nothing in src/ (tests are read-only consumers)
  modifies: package.json (devDeps), tsconfig.json (paths)

CACHING
  reads: claude.ts (getPromptVersion, getModelId), db.ts (KV access pattern)
  writes: analysis-cache.ts (new module)
  modifies: decompose/route.ts (add cache layer), types.ts (cacheHit),
            validation.ts (skipCache), workflow-input.tsx (force refresh)

ANALYTICS
  reads: types.ts (Workflow, HealthMetrics), chart-data.ts (trend patterns)
  writes: analytics.ts (new module), 4 new components
  modifies: chart-data.ts (new function), dashboard/page.tsx (new sections)
```

### External Service Impact

| Service | Testing Impact | Caching Impact | Analytics Impact |
|---------|---------------|----------------|------------------|
| Anthropic Claude | MSW intercepts; no real calls during tests | Fewer calls (cache hits skip Claude) | None |
| Vercel KV | In-memory storage during tests | Cache entries stored in KV (new key prefix) | None |
| Vercel Blob | Not used during tests (KV preferred) | Not used for cache | None |

---

## Sources

- Full codebase audit: 73 source files across `src/`, `prompts/`, config files
- v1.0 Architecture Research (`.planning/research/ARCHITECTURE.md`, dated 2026-02-16) -- verified Vitest/Next.js patterns via WebFetch
- v1.0 Milestone Audit (`.planning/milestones/v1.0-MILESTONE-AUDIT.md`) -- established codebase baseline
- PROJECT.md -- v1.1 requirements and constraints
- Vitest documentation (training data, HIGH confidence for core patterns)
- MSW v2 documentation (training data, HIGH confidence for request interception approach)
- Playwright documentation (training data, HIGH confidence for webServer config pattern)
- `@anthropic-ai/sdk` response format (from codebase: `claude.ts` lines 98-131 show expected shape)

---
*Architecture research for: Workflow X-Ray v1.1 Quality & Intelligence*
*Researched: 2026-02-18*
