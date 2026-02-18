# Stack Research: v1.1 Quality & Intelligence

**Domain:** Testing infrastructure, analysis caching, advanced analytics for AI-powered workflow diagnostic tool
**Researched:** 2026-02-18
**Confidence:** HIGH (all versions verified via `npm view` against live npm registry)

## Existing Stack (NOT Re-researched)

Already in place and working. Listed for integration context only:

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.6 | App framework (App Router) |
| React | 19.2.3 | UI library |
| TypeScript | ^5 | Type safety (strict mode enabled) |
| Tailwind CSS | ^4 | Styling |
| @anthropic-ai/sdk | ^0.74.0 | Claude API (maxRetries=3, prompt caching) |
| @xyflow/react | ^12.10.0 | Flow visualization |
| Zustand | ^5.0.11 | State management |
| @vercel/kv | ^3.0.0 | Primary KV storage |
| @vercel/blob | ^2.2.0 | Blob storage fallback |
| Zod | ^4.3.6 | Schema validation (v4 syntax) |
| jsPDF | ^4.1.0 | PDF generation |
| Recharts | ^3.7.0 | Charting (React 19 compatible) |
| html-to-image | ^1.11.11 | Flow diagram capture |
| Node.js | 25.6.1 | Runtime |

**Key existing patterns:**
- `createHash("sha256")` from Node.js `crypto` already used in `claude.ts` for prompt versioning
- Multi-tier storage: KV > Blob > Memory (with fail-hard on no config)
- SSE streaming for decompose endpoint
- `withApiHandler` + `AppError` error handling on all 13 API routes
- `@/*` path aliases via tsconfig `paths`

---

## Recommended Additions for v1.1

### 1. Unit & Integration Testing (Vitest)

| Technology | Version | Purpose | Why This, Not Something Else |
|------------|---------|---------|------------------------------|
| vitest | 4.0.18 | Unit/integration test runner | Next.js 16 officially recommends Vitest. Native ESM + TypeScript without Babel. Vite-based = instant startup. Compatible with the existing `@/*` path aliases via vite-tsconfig-paths. |
| @vitejs/plugin-react | 5.1.4 | JSX transform for Vitest | Required by Vitest to handle `.tsx` files. Uses the same SWC/esbuild path Next.js uses, so test behavior matches production. |
| jsdom | 28.1.0 | DOM environment for component-adjacent tests | Vitest's recommended browser-like environment. Needed for any test that touches DOM APIs (e.g., testing `cn()` utility with class merging). Lighter than spinning up a real browser. |
| vite-tsconfig-paths | 6.1.1 | Path alias resolution in Vitest | Resolves `@/lib/scoring`, `@/lib/types`, etc. in tests. Without this, every `@/` import fails in the Vitest environment. One line in vitest config. |
| @vitest/coverage-v8 | 4.0.18 | Code coverage reporting | V8-native coverage (faster than Istanbul). Must match vitest major.minor.patch exactly. Reports which of the 73 source files have test coverage. |

**Why NOT @testing-library/react for v1.1:** The PROJECT.md explicitly defers component tests -- "Vitest units + Playwright E2E sufficient for v1.1." The 22K LOC codebase has zero tests today; the priority is covering pure logic functions (`scoring.ts`, `decompose.ts`, `team-calibration.ts`, `chart-data.ts`) that are testable without DOM. Component tests can be added in v1.2 by simply installing `@testing-library/react@16.3.2` + `@testing-library/dom@10.4.1` later. No architectural decisions need to change.

**What to test first (zero DOM needed):**
- `scoring.ts` -- `computeHealth()` is a pure function taking steps + gaps + teamSize
- `team-calibration.ts` -- `getTeamTier()` and `getThresholds()` are pure lookup functions
- `chart-data.ts` -- `computeHealthTrends()` is a pure data transformation
- `decompose.ts` -- `extractJsonFromResponse()` and `recoverPartialDecomposition()` are pure parsers
- `validation.ts` -- Zod schema parsing is trivially testable
- `utils.ts` -- `cn()`, `truncate()`, `formatDate()` are pure string functions

### 2. End-to-End Testing (Playwright)

| Technology | Version | Purpose | Why This, Not Something Else |
|------------|---------|---------|------------------------------|
| @playwright/test | 1.58.2 | E2E browser testing | Next.js 16 official recommendation for E2E. Tests real browser flows. Multi-browser support (Chromium, Firefox, WebKit). Built-in auto-waiting eliminates flaky selectors. |

**No additional dependencies.** Playwright is self-contained. The `npx playwright install` command downloads browser binaries. No React/Next.js peer deps.

**Key E2E flows to cover:**
1. Submit workflow description -> SSE stream -> analysis appears
2. View analysis -> export PDF -> file downloads
3. Library page -> search/filter -> navigate to analysis

### 3. API Mocking (MSW)

| Technology | Version | Purpose | Why This, Not Something Else |
|------------|---------|---------|------------------------------|
| msw | 2.12.10 | Network-level API mocking | Intercepts `fetch()` at the network level. Works with Next.js API routes, Anthropic SDK, Vercel KV client. Single peer dep: TypeScript >= 4.8 (project has ^5). No patching of Node internals like nock does. |

**MSW integration points in this codebase:**

1. **Claude API mock** -- Intercept `https://api.anthropic.com/v1/messages` to return canned decomposition responses. Eliminates $0.003-0.01 per test run.

2. **Vercel KV mock** -- The `@vercel/kv` client makes HTTP calls to `KV_REST_API_URL`. MSW can intercept these, or tests can use `ALLOW_MEMORY_STORAGE=true` to bypass KV entirely (existing fallback in `db.ts`).

3. **Playwright + MSW** -- For E2E tests, MSW can run in the browser context to mock the SSE decompose endpoint, making E2E tests fast and deterministic.

**MSW handler pattern for this app:**
```typescript
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

// Mock Claude API -- return a valid decomposition
const handlers = [
  http.post('https://api.anthropic.com/v1/messages', () => {
    return HttpResponse.json({
      content: [{ type: 'text', text: JSON.stringify({
        title: 'Test Workflow',
        steps: [{ id: 'step_1', name: 'Step 1', /* ... */ }],
        gaps: [],
      })}],
      usage: { input_tokens: 100, output_tokens: 200 },
    })
  }),
]

export const server = setupServer(...handlers)
```

### 4. Analysis Caching (Content Hash -- No New Libraries)

**No npm packages needed.** The codebase already imports `createHash` from Node.js `crypto` in `claude.ts` for prompt version hashing. The same approach works for content-based deduplication.

**Implementation pattern:**
```typescript
import { createHash } from 'crypto'

/**
 * Generate a deterministic cache key for a workflow analysis.
 * Combines: normalized description + team size + prompt version.
 * Two identical submissions produce the same hash = cache hit.
 */
export function computeAnalysisCacheKey(
  description: string,
  teamSize?: number,
  promptVersion?: string
): string {
  const normalized = description
    .replace(/\r\n/g, '\n')  // OS-agnostic line endings
    .trim()
    .toLowerCase()

  const payload = JSON.stringify({
    d: normalized,
    t: teamSize ?? null,
    p: promptVersion ?? 'unknown',
  })

  return createHash('sha256').update(payload).digest('hex').slice(0, 16)
}
```

**Storage strategy:** Use existing Vercel KV with a `cache:` key prefix:
- Key: `cache:{hash}` -> Value: workflow ID
- Before calling Claude, compute hash and check KV
- If hit: load the cached workflow and return it (clone with new ID + timestamps)
- If miss: call Claude, save result, store cache entry

**Why this approach:**
- Zero new dependencies
- KV already has the infrastructure (fail-hard, multi-tier)
- SHA-256 is collision-resistant for this use case
- 16-char hex prefix = 64 bits of entropy = effectively no collision risk at workflow scale
- Cache invalidation: prompt version is part of the hash, so upgrading the system prompt automatically invalidates stale cache entries

### 5. Advanced Analytics (Dashboard Enhancements -- No New Libraries)

**No npm packages needed.** Recharts 3.7.0 is already installed and handles all visualization needs.

**What Recharts already supports for v1.1 analytics:**
- `<LineChart>` -- already used for health trends; extend for time-series tracking across versions
- `<BarChart>` -- batch comparison (before/after health deltas across multiple workflows)
- `<RadarChart>` -- multi-dimensional health comparison (complexity vs fragility vs automation vs load balance)
- `<ComposedChart>` -- combine line + bar for trend-over-count visualization
- `<AreaChart>` -- cumulative metrics over time

**Data flow for advanced analytics:**
1. `chart-data.ts` already has `computeHealthTrends()` grouping by week/month
2. Extend with: `computeBatchComparison()` for side-by-side workflow analysis
3. Extend with: `computeVersionDelta()` for tracking a single workflow across revisions
4. All pure functions -- no state management changes, no new API routes

**What the existing `Workflow` type already provides for analytics:**
- `createdAt` / `updatedAt` -- time-series ordering
- `parentId` / `version` -- version chain traversal
- `decomposition.health` -- all four health metrics
- `decomposition.gaps` -- gap type and severity distribution
- `tokenUsage` -- cost tracking over time
- `costContext.teamSize` -- team-size segmented analytics

---

## Installation

```bash
# Testing infrastructure (all dev dependencies)
npm install -D vitest@^4.0.18 @vitejs/plugin-react@^5.1.4 jsdom@^28.1.0 vite-tsconfig-paths@^6.1.1 @vitest/coverage-v8@^4.0.18 @playwright/test@^1.58.2 msw@^2.12.10

# Download Playwright browser binaries
npx playwright install --with-deps chromium
```

**That is it.** No production dependencies change for v1.1. All additions are devDependencies.

---

## Configuration Files

### vitest.config.mts

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/lib/**/*.ts'],
      exclude: ['src/test/**', '**/*.d.ts', 'src/lib/types.ts'],
      thresholds: {
        // Start low, ratchet up as tests are added
        statements: 40,
        branches: 30,
        functions: 40,
        lines: 40,
      },
    },
  },
})
```

### playwright.config.ts

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
})
```

### src/test/setup.ts (Vitest global setup)

```typescript
import { beforeAll, afterEach, afterAll } from 'vitest'
import { server } from './mocks/server'

// Start MSW server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

// Reset handlers between tests (so per-test overrides don't leak)
afterEach(() => server.resetHandlers())

// Clean shutdown
afterAll(() => server.close())
```

### src/test/mocks/server.ts (MSW setup)

```typescript
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
```

### src/test/mocks/handlers.ts (MSW handlers)

```typescript
import { http, HttpResponse } from 'msw'

export const handlers = [
  // Mock Claude decomposition API
  http.post('https://api.anthropic.com/v1/messages', () => {
    return HttpResponse.json({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      content: [{
        type: 'text',
        text: JSON.stringify({
          title: 'Test Workflow Analysis',
          steps: [{
            id: 'step_1', name: 'Receive Request',
            description: 'Customer submits request',
            owner: 'Support', layer: 'human',
            inputs: ['request'], outputs: ['ticket'],
            tools: ['Zendesk'], automationScore: 30,
            dependencies: [],
          }],
          gaps: [{
            type: 'manual_overhead', severity: 'medium',
            stepIds: ['step_1'],
            description: 'Manual ticket creation',
            suggestion: 'Automate intake with form',
            confidence: 'high',
          }],
        }),
      }],
      usage: { input_tokens: 150, output_tokens: 300 },
    })
  }),
]
```

### package.json scripts additions

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Vitest 4.0 | Jest | Never for this project. Jest needs Babel for ESM + TS. Vitest is Vite-native, sub-second startup, and Next.js 16's official recommendation. |
| Playwright 1.58 | Cypress | Only if team has existing Cypress expertise. Playwright is faster (parallel by default), supports 3 browser engines, has better Next.js integration, and is Next.js-recommended. |
| MSW 2.12 | nock | Never. nock patches Node.js `http` module internals. It breaks with `fetch()` API (used by Anthropic SDK, Vercel KV client, Next.js internals). MSW intercepts at the network level and works with all request clients. |
| Node.js crypto (SHA-256) | External hash library (xxhash, murmurhash) | Only if hashing millions of documents per second. For workflow-scale (tens per day), SHA-256 is fast enough, already imported, and cryptographically sound. Zero dependency cost. |
| KV-based cache | Redis with TTL | Only if cache needs automatic expiration. For v1.1, manual invalidation via prompt-version-in-hash is cleaner. Adding a TTL layer would require Upstash Redis directly, bypassing the @vercel/kv abstraction. |
| Recharts (existing) | Nivo / Victory / Chart.js | No reason to switch. Recharts 3.7 is already installed, React 19 compatible, handles all chart types needed, and the team has patterns for it. Switching costs for zero benefit. |
| jsdom | happy-dom | happy-dom is faster but has edge cases with some DOM APIs. jsdom is the safer default and Vitest's recommended choice. If test speed becomes an issue (unlikely with pure-logic tests), swap later -- it is a one-line config change. |

---

## What NOT to Add

| Do Not Add | Why | What Exists Instead |
|------------|-----|---------------------|
| @testing-library/react | Deferred to v1.2 per PROJECT.md. v1.1 focuses on pure-logic unit tests + Playwright E2E. Adding RTL now creates scope creep with no payoff for the priority test targets (scoring, decompose, chart-data). | Vitest for units, Playwright for UI |
| date-fns / dayjs | No date manipulation needed for v1.1. `new Date().toISOString()` and `toLocaleDateString()` already handle all date formatting. Chart-data bucketing uses native Date arithmetic. | Native Date API (already working) |
| Redis / ioredis | The cache layer uses existing Vercel KV. Adding a separate Redis client creates two storage abstractions and complicates deployment. | @vercel/kv (already installed) |
| uuid / nanoid | `crypto.randomUUID()` already used in `utils.ts` for ID generation. Works in Node 25.6.1. No external library needed. | `crypto.randomUUID()` |
| @sentry/nextjs | Explicitly deferred to v1.2 in PROJECT.md ("not blocking current usage"). | `console.error` + AppError pattern |
| prettier / husky / lint-staged | Code quality tooling is nice-to-have but not in v1.1 scope. The project has ESLint already. | ESLint (existing) |
| @react-pdf/renderer | PDF system works with jsPDF. Switching mid-milestone adds risk for no v1.1 requirement. | jsPDF + pdf-shared.ts (existing) |

---

## Version Compatibility Matrix

| Package | Version | Compatible With | Verification |
|---------|---------|-----------------|--------------|
| vitest | 4.0.18 | @vitest/coverage-v8@4.0.18 | Must match exact version. Peer dep: `4.0.18` |
| vitest | 4.0.18 | @types/node@^20.0.0 or ^22.0.0 or >=24.0.0 | Project has @types/node@^20 -- compatible |
| vitest | 4.0.18 | jsdom@* (any version) | Wildcard peer dep |
| @vitejs/plugin-react | 5.1.4 | vitest 4.x | Plugin API stable across Vite 6.x |
| vite-tsconfig-paths | 6.1.1 | vitest 4.x | Vite plugin, version-agnostic |
| @playwright/test | 1.58.2 | (standalone) | No React/Next.js peer deps |
| msw | 2.12.10 | typescript >= 4.8 | Project has TypeScript ^5 -- compatible |
| jsdom | 28.1.0 | vitest 4.x | Vitest accepts any jsdom version |

**No conflicts with existing stack.** All additions are devDependencies that do not affect the production bundle.

---

## Caching Architecture Detail

### Cache Key Composition

The cache key must change when any input that affects the analysis changes:

| Component | Why Included | What Invalidates |
|-----------|--------------|------------------|
| Normalized description | Different workflows produce different analyses | User changes the description text |
| teamSize | Team tier changes scoring multipliers in `team-calibration.ts` | User submits same workflow with different team size |
| Prompt version | `claude.ts` already hashes the system prompt with SHA-256 | Developer updates `decompose-system.md` prompt file |

**Deliberately NOT included in cache key:**
- `costContext.hourlyRate` / `hoursPerStep` -- These are display-only metadata, not analysis inputs
- `costContext.teamContext` -- Free-text field appended to description; already captured in description normalization
- `stages` / `context` -- These are included in the description string when enriched in the decompose route
- Model ID -- Tied to prompt version in practice (model changes coincide with prompt updates)

### Cache Storage Layout (Vercel KV)

```
cache:{hash16}  ->  { workflowId: string, createdAt: string, tokensSaved: number }
```

- `hash16` = first 16 hex chars of SHA-256 (64 bits, effectively collision-free at workflow scale)
- `workflowId` = points to the canonical analysis in `workflow:{id}`
- `tokensSaved` = accumulated token savings for cost monitoring
- No TTL needed -- prompt version in hash auto-invalidates on prompt changes

### Cache Integration Point

The cache check goes in the decompose API route (`src/app/api/decompose/route.ts`), between validation and the Claude call:

```
1. Validate input (existing)
2. Compute cache key from (description + teamSize + promptVersion)  <-- NEW
3. Check KV for cache:{key}                                          <-- NEW
4. If hit: load cached workflow, clone with new ID/timestamps, save, return  <-- NEW
5. If miss: call Claude (existing), save result, store cache entry   <-- NEW (store step)
6. Return result via SSE (existing)
```

---

## Analytics Data Model Extension

### What Already Exists

`chart-data.ts` has `computeHealthTrends()` that groups workflows by week/month and computes per-period averages. The `Workflow` type has `parentId`, `version`, `tokenUsage`, and `costContext` -- all the data needed for advanced analytics.

### New Pure Functions Needed (No New Types Required)

| Function | Input | Output | Purpose |
|----------|-------|--------|---------|
| `computeBatchComparison(workflows[])` | Array of workflows | Array of `{ title, health, gapCounts }` | Side-by-side health comparison for dashboard |
| `computeVersionDelta(versions[])` | Workflows sharing a parentId | Array of `{ version, healthDelta, gapsResolved, gapsNew }` | Track how a single workflow improves over revisions |
| `computeTokenCostTrend(workflows[])` | Array of workflows with tokenUsage | Array of `{ date, totalTokens, cachedCount, apiCount }` | Token spend monitoring (validates caching ROI) |
| `computeGapDistribution(workflows[])` | Array of workflows | `{ [gapType]: count }` | Aggregate gap type frequency across all analyses |

All of these are pure data transformations on existing types. No new API routes, no new state management, no new libraries.

### Dashboard Recharts Components

| Chart Type | Recharts Component | Data Source | Already Available? |
|------------|-------------------|-------------|-------------------|
| Health trends over time | `<LineChart>` | `computeHealthTrends()` | Yes (existing) |
| Batch health comparison | `<BarChart>` | `computeBatchComparison()` | Recharts installed, function needed |
| Gap type distribution | `<BarChart>` or `<PieChart>` | `computeGapDistribution()` | Recharts installed, function needed |
| Version improvement | `<LineChart>` | `computeVersionDelta()` | Recharts installed, function needed |
| Token spend trend | `<AreaChart>` | `computeTokenCostTrend()` | Recharts installed, function needed |
| Multi-metric radar | `<RadarChart>` | Existing health metrics | Recharts installed, component needed |

---

## Testing Strategy by Module

Priority order based on risk and testability:

| Module | File | Test Type | Complexity | Why This Priority |
|--------|------|-----------|------------|-------------------|
| Scoring | `scoring.ts` | Vitest unit | Low | Pure function, core business logic, 4 team tiers to validate |
| Team calibration | `team-calibration.ts` | Vitest unit | Low | Pure lookups, easy to cover all branches |
| Chart data | `chart-data.ts` | Vitest unit | Low | Pure transformation, critical for dashboard correctness |
| Decompose parser | `decompose.ts` | Vitest unit | Medium | `extractJsonFromResponse` + `recoverPartialDecomposition` are pure; `decomposeWorkflow` needs MSW mock |
| Validation | `validation.ts` | Vitest unit | Low | Zod schemas are trivially testable with `.safeParse()` |
| Cache logic | New `cache.ts` | Vitest unit | Low | Pure hash function + KV lookup (mock KV) |
| Analytics | New functions in `chart-data.ts` | Vitest unit | Low | Pure data transformations |
| Submit flow | E2E | Playwright | High | Full user flow: input -> stream -> result display |
| Export flow | E2E | Playwright | Medium | Click export -> PDF downloads |
| Library | E2E | Playwright | Medium | Search, filter, navigate |

---

## Sources

- **npm registry** -- All versions and peer dependencies verified via `npm view [package] version peerDependencies` on 2026-02-18. HIGH confidence.
- **Existing codebase** -- Read `package.json`, `tsconfig.json`, `claude.ts`, `decompose.ts`, `scoring.ts`, `team-calibration.ts`, `chart-data.ts`, `db.ts`, `store.ts`, `utils.ts`, `validation.ts`, `api/decompose/route.ts` to map integration points. HIGH confidence.
- **v1.0 STACK.md** -- Referenced previous research for consistency. Versions re-verified against npm registry (all match). HIGH confidence.
- **PROJECT.md (v1.1 scope)** -- Used to determine what is in-scope vs deferred. Explicit deferrals: component tests (RTL), Sentry, code quality tooling. HIGH confidence.
- **Next.js testing docs** -- Vitest and Playwright recommended by Next.js 16 official docs (verified in v1.0 research, versions still current). HIGH confidence.
- **Node.js crypto** -- `createHash('sha256')` verified working on Node 25.6.1 via direct test execution. HIGH confidence.

---

*Stack research for: Workflow X-Ray v1.1 Quality & Intelligence milestone*
*Researched: 2026-02-18*
