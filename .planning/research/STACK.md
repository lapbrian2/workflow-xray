# Stack Research: Workflow X-Ray Hardening

**Domain:** AI-powered workflow analysis / operational diagnostics (existing app augmentation)
**Researched:** 2026-02-16
**Confidence:** HIGH (versions verified via npm registry; Next.js docs verified via official site)

## Existing Stack (NOT Re-researched)

Already in place and working. Listed for context only:

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.6 | App framework |
| React | 19.2.3 | UI library |
| TypeScript | ^5 | Type safety |
| Tailwind CSS | ^4 | Styling |
| @anthropic-ai/sdk | ^0.74.0 | Claude API access |
| @xyflow/react | ^12.10.0 | Flow visualization |
| Zustand | ^5.0.11 | State management |
| @vercel/kv | ^3.0.0 | Key-value storage |
| @vercel/blob | ^2.2.0 | Blob storage |
| Zod | ^4.3.6 | Schema validation |
| jsPDF + html2canvas | ^4.1.0 / ^1.4.1 | PDF export |
| Mammoth / pdf-parse / xlsx | various | File parsing |
| @mendable/firecrawl-js | ^4.12.1 | Web crawling |
| @notionhq/client | ^5.9.0 | Notion integration |

---

## Recommended Additions

### Testing Infrastructure (Priority 1 -- Zero Coverage Today)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| vitest | 4.0.18 | Unit/integration test runner | Next.js 16 official recommendation. Faster than Jest, native ESM, TS-first. Vite-based so no Babel config needed. |
| @vitejs/plugin-react | 5.1.4 | React transform for Vitest | Required by Vitest to handle JSX in test environment. Official plugin. |
| jsdom | 28.1.0 | DOM environment for unit tests | Vitest's recommended browser-like environment for component tests. Lighter than happy-dom for this use case. |
| vite-tsconfig-paths | 6.1.1 | Path alias resolution | Resolves `@/` imports in Vitest that match Next.js tsconfig paths. Without this, every aliased import breaks in tests. |
| @testing-library/react | 16.3.2 | Component test utilities | De facto standard for React component testing. Supports React 19 (peer dep: `^18.0.0 \|\| ^19.0.0`). |
| @testing-library/dom | 10.4.1 | DOM query utilities | Peer dependency of @testing-library/react. Must be installed explicitly. |
| @testing-library/user-event | 14.6.1 | User interaction simulation | More realistic than fireEvent -- simulates actual user behavior (click, type, tab). Essential for form testing. |
| @testing-library/jest-dom | 6.9.1 | Custom DOM matchers | Adds `.toBeVisible()`, `.toHaveTextContent()`, etc. Makes test assertions readable. |
| @vitest/coverage-v8 | 4.0.18 | Code coverage | V8-native coverage (faster than Istanbul). Same version as vitest required. Reports coverage gaps to target. |
| @playwright/test | 1.58.2 | E2E testing | Next.js 16 official recommendation for E2E. Tests actual browser flows: input submission, PDF export, flow visualization. |
| msw | 2.12.10 | API mocking | Intercepts fetch at the network level. Mock Claude API responses without hitting real API. Mock Vercel KV/Blob in tests. Only peer dep is TypeScript >=4.8. |

**Confidence:** HIGH -- Vitest and Playwright are both recommended in the official Next.js 16.1.6 testing documentation (verified via nextjs.org/docs). RTL 16.x confirmed React 19 support via npm peer deps.

### Reporting and Visualization Upgrades (Priority 2)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| recharts | 3.7.0 | Data visualization charts | For health metric dashboards, gap severity distributions, team load balance visuals, and before/after comparisons. React 19 compatible (verified). SVG-based so charts render crisply in PDF exports. |
| @react-pdf/renderer | 4.3.2 | Programmatic PDF generation | Replace html2canvas+jsPDF approach. Renders React components directly to PDF with proper fonts, vector graphics, and pagination. No screenshots needed. React 19 compatible (verified). Deterministic output. |
| date-fns | 4.1.0 | Date formatting/manipulation | Lightweight (tree-shakeable) date library for report timestamps, version timelines, remediation timeframes. No global mutation like Moment.js. |

**Confidence:** HIGH for recharts (well-established, verified compat). MEDIUM for @react-pdf/renderer -- it is a significant architectural change from the html2canvas approach but produces far better output. The migration can be incremental (new reports use react-pdf, old approach remains as fallback).

### Production Hardening (Priority 3)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @sentry/nextjs | 10.39.0 | Error monitoring and tracing | Catches unhandled errors in both client and server. The existing ErrorBoundary catches React errors but logs to console only. Sentry captures stack traces, breadcrumbs, and performance data. Supports Next.js 16 (peer dep: `^13.2.0 \|\| ^14.0 \|\| ^15.0.0-rc.0 \|\| ^16.0.0-0`). |
| pino | 10.3.1 | Structured server-side logging | Replace scattered console.log/error with structured JSON logs. Fastest Node.js logger. Vercel's log drain can parse structured output. Essential for debugging Claude API failures in production. |
| pino-pretty | 13.1.3 | Dev-mode log formatting | Human-readable pino output during development. Dev dependency only. |

**Confidence:** HIGH for Sentry (verified Next.js 16 peer dep support). MEDIUM for pino -- standard choice for Node.js structured logging, but need to verify behavior in Next.js edge runtime (pino works in Node.js runtime, not Edge).

### Code Quality Tooling (Priority 4)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| prettier | 3.8.1 | Code formatting | Eliminates formatting debates. Existing project has ESLint but no formatter. Prettier + ESLint together = consistent codebase. |
| husky | 9.1.7 | Git hooks | Runs linting and formatting on pre-commit. Prevents broken code from entering the repo. |
| lint-staged | 16.2.7 | Staged file linting | Only lint/format files being committed, not entire codebase. Fast pre-commit checks. |

**Confidence:** HIGH -- These are standard, mature tools with no compatibility concerns.

### Future Extensibility (Priority 5 -- Prep for Flow Builder)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @dnd-kit/core | 6.3.1 | Drag and drop framework | For future flow builder where users drag steps to reorder or create workflows manually. React 19 compatible. Accessible by default (keyboard DnD). |
| @dnd-kit/sortable | 10.0.0 | Sortable lists/grids | Extends @dnd-kit/core for ordered lists (remediation task reordering, phase reorganization). |
| @dnd-kit/utilities | 3.2.2 | DnD transform helpers | CSS transform utilities for smooth drag animations. Required companion to core. |
| @tanstack/react-table | 8.21.3 | Headless data tables | For structured comparison views, gap analysis tables, team workload matrices. Headless = full style control with Tailwind. React 19 compatible. |
| nanoid | 5.1.6 | ID generation | Compact, URL-safe unique IDs for new entities (reasoning cells, flow builder nodes). Smaller and faster than uuid. Already works in Edge runtime. |

**Confidence:** HIGH for @dnd-kit (verified React 19 compat). HIGH for @tanstack/react-table. These are "install when needed" -- no cost to defer, but good to have the decision made.

---

## Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| @next/bundle-analyzer | 16.1.6 | Bundle size analysis | Same version as Next.js. Identifies bloat from xlsx, mammoth, etc. Configure via `ANALYZE=true next build`. |
| typescript (strict mode) | ^5 | Strictness upgrade | Enable `"strict": true`, `"noUncheckedIndexedAccess": true` in tsconfig. Current project may have loose settings. |

---

## Installation

```bash
# Testing (Priority 1)
npm install -D vitest@^4.0.18 @vitejs/plugin-react@^5.1.4 jsdom@^28.1.0 vite-tsconfig-paths@^6.1.1 @testing-library/react@^16.3.2 @testing-library/dom@^10.4.1 @testing-library/user-event@^14.6.1 @testing-library/jest-dom@^6.9.1 @vitest/coverage-v8@^4.0.18 @playwright/test@^1.58.2 msw@^2.12.10

# After Playwright install, get browser binaries
npx playwright install

# Reporting (Priority 2)
npm install recharts@^3.7.0 @react-pdf/renderer@^4.3.2 date-fns@^4.1.0

# Production Hardening (Priority 3)
npm install @sentry/nextjs@^10.39.0 pino@^10.3.1
npm install -D pino-pretty@^13.1.3

# Code Quality (Priority 4)
npm install -D prettier@^3.8.1 husky@^9.1.7 lint-staged@^16.2.7

# Bundle Analysis (optional)
npm install -D @next/bundle-analyzer@16.1.6

# Future -- install when flow builder phase begins
npm install @dnd-kit/core@^6.3.1 @dnd-kit/sortable@^10.0.0 @dnd-kit/utilities@^3.2.2 @tanstack/react-table@^8.21.3 nanoid@^5.1.6
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Vitest | Jest | Never for this project. Jest requires Babel config for ESM/TS, slower, and Next.js 16 officially recommends Vitest. |
| Playwright | Cypress | If team already has Cypress expertise. Otherwise Playwright is faster, supports 3 browsers, and is Next.js-recommended. |
| @react-pdf/renderer | jsPDF + html2canvas (current) | Keep current approach for quick patches. But for new reporting features, react-pdf produces deterministic, professional PDFs without screenshot artifacts. |
| recharts | Chart.js / react-chartjs-2 | If you need 3D charts or WebGL rendering. recharts is simpler, React-native, SVG-based, and sufficient for health metrics and gap analysis. |
| recharts | D3.js direct | If you need highly custom visualizations beyond standard charts. D3 has a steep learning curve and imperative API that fights React's declarative model. recharts wraps D3 internals. |
| pino | winston | Never for this project. Winston is slower, heavier, and designed for long-running processes. Pino is optimized for serverless/short-lived functions. |
| @sentry/nextjs | LogRocket / Datadog | If you need session replay (LogRocket) or full APM (Datadog). Sentry is the best fit for error monitoring in a Vercel-deployed Next.js app at this scale. |
| @dnd-kit/core | react-beautiful-dnd | Never. react-beautiful-dnd is deprecated/unmaintained (Atlassian dropped it). @dnd-kit is the active successor with accessibility built in. |
| @tanstack/react-table | AG Grid | If you need Excel-like editing, 100K+ rows, or enterprise features. AG Grid is heavy (300KB+) and overkill for diagnostic tables. |
| msw | nock | Never for this project. nock patches Node.js http module directly -- doesn't work with fetch() in Next.js API routes. msw intercepts at the network level and works everywhere. |
| date-fns | dayjs | Either is fine. date-fns is tree-shakeable by default and has better TypeScript types. dayjs is smaller if you only need formatting. |
| nanoid | uuid | If you need RFC 4122 compliance. nanoid is smaller (130B), faster, and URL-safe by default. |
| Prettier | Biome | If you want a single tool for lint+format. Biome is faster but has less ecosystem support (no Tailwind class sorting plugin yet). Stick with Prettier + ESLint for now. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Jest | Requires babel-jest transforms, slower startup, poor ESM support, not recommended by Next.js 16 docs | Vitest |
| react-beautiful-dnd | Deprecated by Atlassian, no React 19 support, unmaintained | @dnd-kit/core |
| Moment.js | Massive bundle (300KB), mutable API, officially in maintenance mode | date-fns |
| nock | Patches Node.js http internals; breaks with fetch()-based APIs in Next.js | msw |
| Enzyme | Dead project. No React 18+ support, let alone React 19 | @testing-library/react |
| winston | Designed for long-running servers, not serverless. Heavier, slower than pino | pino |
| Vercel AI SDK (ai package) | Adds unnecessary abstraction layer. The app already uses @anthropic-ai/sdk directly with custom prompt management and token tracking. The AI SDK would require rewriting the Claude integration for no benefit. | Keep @anthropic-ai/sdk direct |
| @upstash/ratelimit | Requires Upstash Redis. The existing in-memory rate limiter works fine for Vercel's per-instance model. Only consider if the app scales to multiple concurrent instances needing shared rate limit state. | Keep current in-memory rate-limit.ts |
| next-safe-action | Adds ceremony (server actions wrapper) without clear benefit. The existing API route pattern with Zod validation is clean and working. Server actions are useful for form mutations, but this app's AI analysis calls are long-running and better suited to API routes with streaming. | Keep API routes + Zod |

---

## Stack Patterns by Variant

**If adding team-size-aware analysis:**
- No new libraries needed. Extend existing `CostContext` type with richer team modeling.
- Use recharts for team workload visualization (bar charts showing load distribution across team members).
- The scoring algorithm in `scoring.ts` already accounts for owner distribution; extend it with team-size-weighted calculations.

**If upgrading PDF reports:**
- Phase 1: Keep jsPDF+html2canvas for existing reports
- Phase 2: Build new report templates with @react-pdf/renderer
- Phase 3: Migrate old reports to react-pdf, remove html2canvas dependency
- Use recharts SVG output embedded in react-pdf documents for charts in PDFs

**If building flow builder (future):**
- @xyflow/react already handles visualization
- Add @dnd-kit for drag-to-create interactions (dragging step templates onto the canvas)
- Use Zustand for flow builder state (already the state management choice)

**If adding reasoning cells (future):**
- No new stack additions needed
- Extend the existing Layer type (`"cell"` layer already exists in types.ts)
- Use existing @anthropic-ai/sdk with structured outputs for cell decomposition

---

## Version Compatibility Matrix

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| vitest@4.0.18 | @vitest/coverage-v8@4.0.18 | Must match exact major.minor.patch |
| @testing-library/react@16.3.2 | react@^19.0.0, @testing-library/dom@^10.0.0 | Verified React 19 peer dep |
| @react-pdf/renderer@4.3.2 | react@^19.0.0 | Verified React 19 peer dep |
| recharts@3.7.0 | react@^19.0.0, react-dom@^19.0.0 | Also requires react-is as peer dep |
| @sentry/nextjs@10.39.0 | next@^16.0.0-0 | Verified Next.js 16 peer dep |
| @playwright/test@1.58.2 | (standalone) | No React/Next peer deps; tests via browser |
| msw@2.12.10 | typescript@>=4.8 | No React peer deps; works at network level |
| @dnd-kit/core@6.3.1 | react@>=16.8.0 | Broad React compat including 19 |
| @tanstack/react-table@8.21.3 | react@>=16.8, react-dom@>=16.8 | Headless; no DOM-specific peer deps |
| pino@10.3.1 | Node.js runtime only | Does NOT work in Edge runtime. Use Node.js runtime for API routes that need logging. |
| recharts@3.7.0 | requires react-is peer | Install react-is alongside recharts if not already present |

---

## Configuration Notes

### Vitest Config (vitest.config.mts)

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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/lib/**', 'src/components/**'],
      exclude: ['src/test/**', '**/*.d.ts'],
    },
  },
})
```

### Playwright Config (playwright.config.ts)

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
})
```

### MSW Handler Pattern (for mocking Claude API)

```typescript
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.post('https://api.anthropic.com/v1/messages', () => {
    return HttpResponse.json({
      content: [{ type: 'text', text: '{"steps": [...], "gaps": [...]}' }],
      usage: { input_tokens: 100, output_tokens: 200 },
    })
  }),
]
```

---

## Sources

- **Next.js 16.1.6 Testing Docs (Vitest)** -- https://nextjs.org/docs/app/building-your-application/testing/vitest -- Verified 2026-02-16, doc version 16.1.6. Confirms Vitest + @testing-library/react as recommended setup. HIGH confidence.
- **Next.js 16.1.6 Testing Docs (Playwright)** -- https://nextjs.org/docs/app/building-your-application/testing/playwright -- Verified 2026-02-16, doc version 16.1.6. Confirms Playwright for E2E. HIGH confidence.
- **npm registry** -- All version numbers and peer dependencies verified via `npm view [package] version peerDependencies` on 2026-02-16. HIGH confidence.
- **Existing codebase analysis** -- Read package.json, types.ts, store.ts, claude.ts, rate-limit.ts, scoring.ts, pdf-export.ts, error-boundary.tsx to understand current patterns and identify gaps. HIGH confidence.

---

*Stack research for: Workflow X-Ray production hardening milestone*
*Researched: 2026-02-16*
