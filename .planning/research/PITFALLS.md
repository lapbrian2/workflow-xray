# Pitfalls Research

**Domain:** AI-powered workflow analysis tool -- production hardening for consulting team use
**Researched:** 2026-02-16
**Confidence:** HIGH (based on direct codebase analysis) / MEDIUM (domain patterns from training data)

---

## Critical Pitfalls

### Pitfall 1: In-Memory State Evaporates on Every Cold Start (Data Loss)

**What goes wrong:**
The current `db.ts` has a three-tier storage fallback: KV > Blob > Memory. When KV and Blob environment variables are not configured (or misconfigured after a redeploy), the app silently falls back to in-memory `Map` storage via `globalThis.__workflowStore`. On Vercel serverless, each function invocation can be a cold start on a new isolate. Data written to memory in one invocation is invisible to the next. Consultants analyze a workflow, close their browser, come back 30 minutes later, and their work is gone. No error is shown -- the app just returns empty results.

**Why it happens:**
The fallback was designed for local dev convenience. The `getBackend()` function determines storage at runtime by checking env vars, but there is no validation at startup that a persistent backend is actually reachable. The memory fallback was never intended for production but there is no guard preventing it.

**How to avoid:**
1. Add a startup health check that verifies persistent storage is configured and reachable. Fail loudly on deploy (not silently at runtime).
2. Add a visible banner in the UI when running on memory-only storage: "Warning: data will not persist between sessions."
3. In production builds, throw an error or return 503 from API routes when `getBackend()` returns `"memory"` -- do not silently serve requests that will lose data.
4. Add an `/api/health` endpoint that checks storage connectivity and returns the active backend. Use this in Vercel deployment checks.

**Warning signs:**
- `getBackend()` returns `"memory"` in production logs
- Workflows disappear after ~15 minutes of inactivity (cold start window)
- `listWorkflows` returns empty after a period where workflows were recently created
- No `KV_REST_API_URL` or `BLOB_READ_WRITE_TOKEN` in Vercel environment settings

**Phase to address:**
Phase 1 (Foundation/Infrastructure) -- this must be fixed before any other hardening work matters. Tests and auth improvements are meaningless if data disappears.

---

### Pitfall 2: Rate Limiter is Per-Isolate, Not Distributed (Useless in Production)

**What goes wrong:**
The `rate-limit.ts` uses an in-memory `Map` to track request counts. On Vercel serverless, each function invocation may run in a different isolate. A user making 100 rapid requests will likely hit 100 different isolates, each with a fresh `Map`. The rate limiter never triggers. This means: (a) Claude API credit burn is unprotected, (b) a single misbehaving script can exhaust the Anthropic API budget in minutes, (c) the Notion API rate limits get hit at the provider level causing cascading 429 errors.

**Why it happens:**
The code comment acknowledges this: "This is per-instance (not distributed) but still prevents..." -- the assumption is it provides some protection. In practice, Vercel aggressively scales isolates, so a burst of requests almost never shares an isolate.

**How to avoid:**
1. Implement distributed rate limiting using Vercel KV (Upstash Redis). The KV client is already a dependency. Use `INCR` with `EXPIRE` for a sliding window counter.
2. Alternatively, use Vercel's built-in WAF/Firewall rules or Upstash's `@upstash/ratelimit` SDK which is purpose-built for this.
3. Set Anthropic API spend alerts and hard limits in the Anthropic dashboard as a safety net regardless of app-level rate limiting.
4. For Notion sync, implement exponential backoff with jitter rather than relying on per-request rate limiting.

**Warning signs:**
- Unexpectedly high Anthropic API bills
- Anthropic API returning 429 errors that the app did not rate-limit itself
- Multiple users reporting "AI service is busy" errors simultaneously
- Notion sync failures due to upstream 429s

**Phase to address:**
Phase 1 (Foundation/Infrastructure) -- must be in place before opening to a consulting team. A single curious team member running a script could burn through the monthly API budget.

---

### Pitfall 3: Auth Cookie Validated by Format Only in Middleware (Security Bypass)

**What goes wrong:**
The `middleware.ts` checks that the `xray_auth` cookie exists and matches `/^[a-f0-9]{64}$/` (64 hex chars). It does NOT verify the cookie is the correct hash of the password. Any 64-character hex string will pass the middleware. The comment says "Full hash validation happens in API routes via auth.ts" but there is no evidence this validation occurs in most API routes -- the API routes for decompose, remediation, workflows, etc. do NOT call any auth validation function. They only check rate limits.

This means: anyone who sets a cookie `xray_auth=0000000000000000000000000000000000000000000000000000000000000000` in their browser can bypass authentication for ALL pages and ALL API endpoints.

**Why it happens:**
Edge middleware in Next.js runs in the Edge Runtime which has limited crypto capabilities. The developer noted they couldn't easily import `crypto` in edge middleware. The intention was to do full validation in API routes, but this was never implemented -- it was likely deferred and forgotten.

**How to avoid:**
1. Use the Web Crypto API (available in Edge Runtime) to verify the hash in middleware: `crypto.subtle.digest('SHA-256', ...)` works in Edge Runtime and has for years.
2. Alternatively, create an auth verification helper that each API route calls before processing. Add it to every route, not just the middleware.
3. Better yet: migrate to NextAuth.js / Auth.js for session management. The current homegrown cookie auth has too many gaps for a team-facing tool.
4. Add integration tests that verify unauthenticated requests are rejected from every API endpoint.

**Warning signs:**
- Any API route returning 200 without checking `getExpectedToken()` / `safeCompare()`
- The middleware allowing requests with arbitrary 64-char hex cookies
- No auth validation code in API route files (search for `safeCompare` or `getExpectedToken` -- they are only defined in `auth.ts`, never imported elsewhere except potentially the `/api/auth` route)

**Phase to address:**
Phase 1 (Foundation/Security) -- absolute prerequisite before multi-user access. This is not a "nice to have" -- it is a broken lock.

---

### Pitfall 4: No Input Validation on the Write-Anything Workflows POST Endpoint

**What goes wrong:**
The `POST /api/workflows` route accepts any JSON body and passes it directly to `saveWorkflow()` with zero validation: `const workflow = await request.json(); await saveWorkflow(workflow);`. An attacker (or a buggy client) can write arbitrary JSON to the storage backend -- malformed workflows, XSS payloads in description fields, absurdly large objects that exhaust KV storage limits, or objects that crash the frontend when rendered.

**Why it happens:**
The route was likely created as a quick "save workflow" helper for the client, assuming the client always sends valid data. The decompose route validates its output before saving, but the direct save endpoint trusts the client completely.

**How to avoid:**
1. Validate the request body against the `Workflow` type using a Zod schema before saving. Reject anything that does not match.
2. Sanitize string fields (title, description, owner names) to prevent stored XSS -- especially since these values render in the UI and in Notion pages.
3. Enforce size limits on the request body (e.g., 500KB max) to prevent storage abuse.
4. Add auth validation to this endpoint (see Pitfall 3).

**Warning signs:**
- Malformed data in the workflow library causing frontend crashes
- Workflows with unexpected fields or missing required fields
- Storage backend growing unexpectedly large
- XSS alerts in the browser when viewing workflow details

**Phase to address:**
Phase 1 (Foundation/Security) -- alongside the auth fixes.

---

### Pitfall 5: Claude Output Parsing Assumes Happy Path Despite Non-Deterministic Responses

**What goes wrong:**
The `decompose.ts` parses Claude's JSON response with a regex (`/```(?:json)?\s*([\s\S]*?)```/`), then `JSON.parse()`, then Zod validation. This has multiple failure modes in production: (a) Claude occasionally returns JSON without code fences, (b) Claude sometimes returns partial JSON when hitting output token limits (4096 for decompose), (c) Claude can return valid JSON that passes Zod but contains semantically nonsensical data (e.g., all automation scores at exactly 50, identical descriptions for every gap), (d) the 45-second timeout may hit before Claude finishes a complex analysis, returning truncated output.

The remediation and extraction routes have similar issues. When these fail, the user gets a generic "try again" error with no indication of what went wrong or whether retrying will help.

**Why it happens:**
LLM outputs are inherently non-deterministic. The code has good defensive measures (Zod validation, referential integrity checks, cycle detection), but it treats parsing failure as a terminal error rather than an opportunity for recovery. There is no retry logic, no partial result recovery for decompose (though extraction has `recoverPartialExtraction`), and no structured logging to diagnose patterns in failures.

**How to avoid:**
1. Add automatic retry with exponential backoff for transient Claude API errors (429, 500, 503, timeout). 1-2 retries with 2-4s delays covers most transient failures.
2. Increase `max_tokens` for complex workflows -- 4096 tokens is tight for a 15-step workflow with detailed gaps. Consider 8192 for decompose.
3. Add the `recoverPartialExtraction` pattern to decompose and remediation routes -- if Zod validation fails, attempt to extract whatever valid data exists rather than failing entirely.
4. Log structured failure events (not just console.error) with the prompt hash, input length, error type, and response prefix. This data reveals patterns: "20% of failures are truncation at 4096 tokens" is actionable.
5. Differentiate user-facing errors: "AI response was incomplete -- try a shorter description" vs "AI service unavailable -- try again in a moment" vs "Analysis produced unexpected results -- we're retrying automatically."

**Warning signs:**
- Frequent "Decomposition failed" errors in production logs
- Error messages containing "invalid JSON" or "schema validation"
- Users reporting that the same workflow description fails repeatedly then works on the 3rd-4th try
- Claude API usage showing high input token counts with low output token counts (truncation)

**Phase to address:**
Phase 2 (Reliability/Error Handling) -- after foundation security and storage are solid.

---

### Pitfall 6: Adding Test Coverage Without a Testable Architecture Leads to Brittle Tests

**What goes wrong:**
The codebase has zero test files. When teams add tests to a codebase not designed for testability, they write integration tests that depend on Claude API calls, Vercel KV connections, and Notion API access. These tests are slow (5-30 seconds each), flaky (LLM responses vary), expensive (each test burns API credits), and break when external services change. The team writes 50 tests, CI takes 15 minutes, and within a month half the tests are skipped or ignored because they fail intermittently.

**Why it happens:**
The business logic (decompose, scoring, comparison) is tightly coupled to the Claude API client, the storage layer, and the HTTP request/response cycle. There are no clear seams for injecting test doubles. The `claude.ts` module instantiates the Anthropic client at module scope. The `db.ts` module checks env vars at call time. Testing any route requires either a real API key or extensive mocking of deeply nested dependencies.

**How to avoid:**
1. Before writing ANY tests, refactor to create testable seams:
   - Extract an `AIClient` interface that `claude.ts` implements. Tests inject a mock that returns canned responses.
   - Extract a `StorageProvider` interface that KV/Blob/Memory all implement. Tests use an in-memory implementation.
   - Move business logic (scoring, prompt building, JSON parsing, org-context computation) into pure functions that take data in and return data out -- no I/O.
2. Test in layers:
   - **Unit tests** (fast, no I/O): `computeHealth()`, `buildPrompt()`, JSON parsing, Zod validation, `formatOrgContextForPrompt()`, rate limit logic, auth hashing.
   - **Integration tests** (with mocks): API routes with mocked AI + storage.
   - **E2E tests** (few, slow): 2-3 happy-path flows with real services, run on deploy only.
3. Target 80% coverage on business logic (scoring, parsing, org-context) and 0% on UI components initially. UI tests come last and provide the least value for this type of tool.
4. Use snapshot tests for Claude response parsing -- capture real Claude responses as fixtures and verify the parsing pipeline handles them correctly.

**Warning signs:**
- Tests that call `callClaude()` without mocking
- Tests that require `ANTHROPIC_API_KEY` in CI environment
- CI pipeline taking > 5 minutes for unit tests
- Tests that pass locally but fail in CI due to API rate limits
- Test files that are larger than the code they test (excessive mocking setup)

**Phase to address:**
Phase 2 (Testing) -- but the architecture refactoring for testability must happen in Phase 1 alongside the infrastructure work. You cannot add good tests to untestable code.

---

### Pitfall 7: Org Context Injection Creates Prompt Leakage Between Clients

**What goes wrong:**
The `org-context.ts` module reads ALL saved workflows (via `listWorkflows()`) and injects aggregate data into Claude prompts. In a multi-consultant deployment, Consultant A's workflow data (titles, owner names, gap patterns) gets injected into Claude's analysis when Consultant B submits a new workflow. This is: (a) a data privacy concern -- client names and workflow details leak across consultants, (b) an analysis quality issue -- patterns from Client A's manufacturing workflows contaminate analysis of Client B's software development workflows, (c) a prompt bloat issue -- as the library grows, the org context section consumes an increasing portion of the context window.

**Why it happens:**
Org context was designed for a single-user scenario where all workflows belong to the same organization. The feature adds genuine value (pattern detection across workflows), but assumes a flat, single-tenant data model. There is no concept of "who owns this workflow" or "which client is this for."

**How to avoid:**
1. Add a lightweight tenant/workspace concept before opening to multiple consultants. Each workflow needs an `ownerId` or `workspaceId` field.
2. Filter `buildOrgContext()` to only include workflows from the same workspace/tenant.
3. Cap the org context injection to a fixed token budget (e.g., 500 tokens) regardless of library size. Currently it grows unboundedly with library size.
4. Consider making org context opt-in per analysis rather than automatic.
5. Short term: add a `client` or `project` tag to workflows and filter org context by matching tags.

**Warning signs:**
- Claude's analysis mentions workflow names or owner names the user didn't provide
- Analysis quality degrades as the workflow library grows
- Prompts exceeding expected input token counts
- Consultants noticing references to other clients' terminology in their analyses

**Phase to address:**
Phase 2 (Multi-tenancy/Data Isolation) -- after auth is real, before opening to a full team.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| In-memory storage fallback | Works without any config for local dev | Silent data loss in production; false confidence during testing | Local development only. Must be blocked in production builds. |
| Cookie-only auth with format-only validation | Quick to implement, no external auth provider | Easily bypassed; no per-user identity; no session revocation; no audit trail | Never acceptable for multi-user production. Migrate to proper auth. |
| Per-isolate rate limiting | Some protection in single-server dev mode | Zero protection in serverless; false sense of security | Pre-launch development only. Replace before any real traffic. |
| `readFileSync` for prompt loading in serverless | Simple, works in dev | Cold start penalty; file might not be bundled; `outputFileTracingIncludes` is fragile | Acceptable short-term with the file tracing config. Consider bundling prompts as string constants for production. |
| No input validation on `POST /api/workflows` | Fast iteration, fewer error states to handle | Stored XSS, corrupted data, storage abuse | Never in production. Always validate before persisting. |
| `console.error` for production logging | Zero setup needed | No structured logging, no alerting, no log aggregation, impossible to diagnose patterns at scale | Acceptable for solo dev. Replace with structured logging (Pino or similar) before team use. |
| Client-side localStorage as workflow cache | Offline-capable, fast | Data divergence between client cache and server; no way to invalidate stale cache; localStorage quota limits | Acceptable as a performance optimization, but server must be source of truth with cache invalidation. |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **Anthropic Claude API** | Not handling `overloaded_error` (529) distinctly from rate limits (429). The 529 means Claude's servers are overloaded -- retrying immediately makes it worse. | Retry 429 with exponential backoff (2s, 4s, 8s). For 529, wait longer (10-30s) or queue the request. Set a hard timeout budget (60s total) and fail gracefully. |
| **Anthropic Claude API** | Trusting `max_tokens: 4096` means "Claude will use 4096 tokens." Claude may stop early due to its own stop conditions, or the response may be truncated if the model determines it has finished. | Always check `stop_reason` in the response. If it is `max_tokens`, the output was truncated -- either retry with higher limit or inform the user the workflow was too complex. |
| **Vercel KV (Upstash Redis)** | Using `kv.set()` for the workflow ID list without considering race conditions. Two concurrent `saveWorkflow` calls both read the list, both append their ID, and one overwrites the other's addition. | Use Redis `SADD` for the ID set instead of read-modify-write on a JSON array. Or use a sorted set with timestamp scores for ordered listing. |
| **Vercel Blob** | Setting `access: "public"` on workflow JSON blobs. Workflow data (client names, process descriptions, gap analyses) is accessible to anyone with the blob URL. | Use `access: "private"` or implement signed URLs. Never store sensitive consulting data in publicly accessible blobs. |
| **Notion API** | Deleting old blocks one-by-one in a loop (the current sync approach). For a page with 50 blocks, this is 50 sequential API calls, each with Notion's ~300ms latency. Total: 15 seconds per sync. | Batch operations where possible. Alternatively, archive the old page and create a new one (1 API call vs 50). |
| **Notion API** | Not paginating `blocks.children.list` -- the current code does paginate (good), but not paginating `listWorkflows` for Notion sync when the library exceeds 100 items. | Always paginate Notion API responses. Set explicit `page_size` and handle `has_more` + `next_cursor`. |
| **Firecrawl (web scraping)** | Not validating that the returned content is actually a workflow description before sending it to Claude. Scraping a login page, error page, or cookie consent modal produces garbage analysis. | Validate scraped content length and content type. Add a "does this look like it contains process/workflow content?" pre-check, or let the user preview before analysis. |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `listWorkflows()` fetches ALL workflows every time | Page loads slow, API latency climbs, KV read costs increase | Add pagination (`offset`/`limit` params). Only fetch what the current page needs. The library page should paginate, not load 100+ workflows at once. | 50+ workflows in the library. With KV, each workflow is a separate `get()` call -- 100 workflows = 100 Redis round trips. |
| `buildOrgContext()` calls `listWorkflows()` on EVERY decompose request | Every analysis pays the full cost of reading the entire library, even if no org context is useful. With 100 workflows, that is 100+ KV reads just to build a prompt appendix. | Cache org context with a short TTL (5 minutes). Invalidate on workflow save/delete. Or compute org context asynchronously and store as a pre-built summary. | 20+ workflows. The decompose request adds 2-5 seconds of latency just for org context retrieval. |
| Blob storage `list()` + `fetch()` for every workflow in `listWorkflows()` | Blob backend fetches every workflow JSON via HTTP. N workflows = N HTTP fetches to Vercel Blob CDN. | Store a lightweight index (IDs + titles + timestamps) separately. Only fetch full workflow data when viewing a specific one. | 30+ workflows on blob storage. List requests take 10+ seconds. |
| Notion sync deletes blocks one-by-one | Each delete is a separate API call. Pages with many blocks (15+ steps, 10+ gaps) take 30+ seconds to sync. | Replace delete-then-recreate with archive-old-page + create-new-page. Or use Notion's batch endpoint if available. | Pages with 30+ blocks. Users will click "sync" and think it is broken. |
| PDF export renders DOM elements via `html2canvas` | Works for simple pages. For complex flow visualizations with 20+ nodes, `html2canvas` becomes slow (5-10s) and produces low-quality output. | Use a server-side PDF generation approach (e.g., `@react-pdf/renderer` or Puppeteer) for consistent, fast results. Or generate PDFs from structured data rather than screenshots. | Workflows with 15+ steps and complex flow graphs. |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| **Workflow descriptions sent to Claude contain client-sensitive data** (process details, tool names, employee names, cost data) with no data classification or consent | Consulting clients may have contractual restrictions on sharing their operational data with third-party AI services. Anthropic's data handling policies apply. | Add a clear disclosure: "Workflow descriptions are sent to Anthropic's Claude API for analysis." Consider Anthropic's zero-data-retention API option. Allow consultants to strip names/identifiers before analysis. |
| **Blob storage set to `access: "public"`** | Any workflow JSON blob URL is publicly accessible. Anyone who discovers or guesses a blob URL can read full workflow analysis including client process details, gap analysis, and remediation plans. | Change to `access: "private"`. Implement signed URL generation for authorized access. |
| **No per-user identity or audit trail** | With shared-password auth, there is no way to know which consultant performed which analysis, when, or for which client. If data is mishandled, there is no accountability. | Implement per-user auth (even simple: email + password). Log user ID with every action. Required for any consulting team compliance. |
| **Default auth salt is hardcoded** (`"xray-default-salt-2024"`) | If `AUTH_PASSWORD_SALT` env var is not set, all deployments use the same salt. An attacker who knows the codebase can precompute rainbow tables. | Require `AUTH_PASSWORD_SALT` in production. Generate a unique random salt per deployment. Fail startup if salt is not configured. |
| **Client IP extraction trusts `x-forwarded-for`** fallback | While the code correctly prefers `x-real-ip` (Vercel-set), the `x-forwarded-for` fallback takes the LAST entry -- which IS the correct approach for Vercel, but could be wrong behind other proxies. If the app is ever moved off Vercel, the IP extraction logic becomes exploitable. | Document that IP extraction assumes Vercel's proxy behavior. Add an env var for "trusted proxy depth" if portability matters. |
| **Notion API key shared across all users** | All consultants sync to the same Notion workspace using one API key. No per-consultant workspace isolation. One consultant could overwrite another's synced pages. | Per-consultant Notion OAuth connections, or at minimum, database-level isolation (one database per consultant/client). |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| **Generic "try again" errors for AI failures** | User has no idea if retrying will help. They retry 5 times, waste time, burn API credits, then give up. | Differentiate errors: "Your workflow was too complex -- try splitting it" vs "AI service temporarily unavailable -- will retry automatically" vs "Analysis produced partial results -- showing what we got." |
| **No progress indication during AI analysis** | Decompose takes 10-30 seconds. The only feedback is a spinner. Users click the button again, triggering duplicate requests. | Show staged progress: "Analyzing workflow structure..." then "Identifying gaps..." then "Computing health scores..." Even if fake-staged, it prevents duplicate submissions and reduces perceived wait time. Add a request deduplication guard on the client. |
| **Team context only affects prompt, not UI** | A solo operator sees "Team Load Balance" metrics that are irrelevant to them. A 3-person team sees the same UI as a 50-person enterprise. | Adapt the UI based on `costContext.teamSize`. Hide team-specific metrics for solo operators. Show delegation suggestions only for teams > 1. |
| **No explanation of AI-generated scores** | Health scores (complexity: 73, fragility: 45) are opaque numbers. Consultants cannot explain to clients why a score is what it is. | Show score breakdown: "Fragility 45 = 1 high-severity gap (20pts) + 1 medium gap (10pts) + 3 low-automation steps (15pts)." This makes the tool useful in client presentations. |
| **Remediation plans are one-shot, not iterative** | After generating a remediation plan, there is no way to mark tasks done, track progress, or regenerate a plan accounting for completed improvements. The `status` field exists on `RemediationTask` but there is no UI to update it. | Add task status toggles. When re-analyzing a workflow, carry forward the remediation plan status. Show progress: "3 of 8 tasks completed." |
| **Version comparison requires manual navigation** | To compare workflow versions, users must know to go to the compare page and select two workflows. There is no "compare with previous version" button on the workflow detail page. | Add a "Compare with v{N-1}" button directly on the X-ray view for versioned workflows. |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Authentication:** Has cookie auth but middleware only validates format, not value. API routes have no auth checks at all. "Looks secure" but anyone with a hex string cookie has full access.
- [ ] **Rate limiting:** Has rate limit code on every route but it is per-isolate. In serverless production it provides zero actual protection. "Looks rate-limited" but is not.
- [ ] **Data persistence:** Has three storage backends but production deployment can silently fall to in-memory. "Looks persistent" but data can vanish.
- [ ] **Error handling:** Has try/catch on every route with user-friendly messages but no retry logic, no partial recovery (except extraction), no structured logging. "Looks robust" but most failures require user to manually retry.
- [ ] **Input validation:** Decompose route validates input. Workflows POST route does not. "Looks validated" but has a wide-open write endpoint.
- [ ] **Blob storage:** Has blob persistence but uses `access: "public"`. "Looks like storage" but is publicly accessible sensitive data.
- [ ] **Org context:** Has organizational pattern detection but leaks data across tenants. "Looks like a feature" but is a privacy liability in multi-user mode.
- [ ] **Remediation tracking:** Has `TaskStatus` type and `status` field on tasks but no UI to update status. "Looks like project management" but status is always `not_started`.
- [ ] **PDF export:** Has export functionality but uses client-side `html2canvas` which produces inconsistent results across browsers and fails on complex visualizations. "Looks like PDF export" but output quality varies wildly.
- [ ] **Notion sync:** Has sync functionality but deletes and recreates blocks sequentially. "Looks like Notion integration" but takes 30+ seconds for complex workflows and can partially fail mid-update.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Data loss from memory fallback | HIGH | Data is unrecoverable. Consultants must re-analyze workflows. Mitigate future occurrence by blocking memory fallback in production. |
| Auth bypass via fake cookie | MEDIUM | Rotate the `AUTH_PASSWORD` and `AUTH_PASSWORD_SALT`. Audit storage for unauthorized data. Implement proper auth. No way to know what was accessed without audit logs. |
| API credit overrun from missing rate limits | LOW | Set spend limits in Anthropic dashboard. Implement distributed rate limiting. Cost is financial, not data loss. |
| Claude response parsing failure | LOW | User retries. Add retry logic to prevent manual retry. Capture failed responses as test fixtures to improve parsing. |
| Org context data leakage | MEDIUM | Audit what data was exposed. Add tenant isolation. Inform affected clients per contractual requirements. Cannot un-expose data that was already injected into prompts. |
| Public blob storage exposure | HIGH | Change to private access. Rotate blob URLs. Audit access logs if available. Cannot un-expose data that was publicly accessible. |
| Notion sync partial failure | LOW | Re-sync the workflow. The current append-then-delete approach means partial failures leave duplicate content (recoverable) rather than data loss. |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| In-memory data loss | Phase 1: Infrastructure | Deploy to Vercel, restart, verify workflows persist. `GET /api/health` returns `backend: "kv"`. |
| Per-isolate rate limiting | Phase 1: Infrastructure | Load test with 50 concurrent requests. Verify rate limiter triggers after configured threshold. |
| Auth cookie bypass | Phase 1: Security | Send request with fake 64-char hex cookie to any API endpoint. Verify 401 response. Automated test for every route. |
| Unvalidated workflow POST | Phase 1: Security | POST malformed JSON to `/api/workflows`. Verify 400 response with validation error. |
| Blob public access | Phase 1: Security | Check blob URL without auth. Verify 403 or signed-URL-required response. |
| Hardcoded auth salt | Phase 1: Security | Deploy without `AUTH_PASSWORD_SALT` env var. Verify app refuses to start or shows clear error. |
| Claude parsing failures | Phase 2: Reliability | Run test suite with 20+ captured Claude responses (including malformed ones). Verify parsing handles all cases. |
| No retry logic | Phase 2: Reliability | Simulate Claude API 429/500 errors. Verify automatic retry with backoff. User sees "retrying..." not "failed." |
| Org context leakage | Phase 2: Multi-tenancy | Create workflows under two different workspace IDs. Verify org context for workspace A does not include workspace B data. |
| Test architecture coupling | Phase 2: Testing | Run full unit test suite with no API keys configured. All unit tests must pass in < 30 seconds with zero external calls. |
| Notion sync performance | Phase 3: Optimization | Sync a workflow with 20 steps and 10 gaps. Verify sync completes in < 10 seconds. |
| PDF export quality | Phase 3: Optimization | Export a 15-step workflow to PDF. Verify all nodes visible, text readable, consistent across Chrome/Firefox/Safari. |
| Generic error messages | Phase 2: UX Hardening | Trigger each error type (timeout, parse failure, rate limit, service unavailable). Verify user sees actionable, differentiated messages. |
| No audit trail | Phase 3: Compliance | After implementing per-user auth, verify every API action is logged with user ID, timestamp, and action type. |

## Sources

- **HIGH confidence (direct codebase analysis):**
  - `C:/Users/Brian/OneDrive/Desktop/New folder (3)/workflow-xray/src/lib/db.ts` -- in-memory fallback, public blob access, race condition on KV ID list
  - `C:/Users/Brian/OneDrive/Desktop/New folder (3)/workflow-xray/middleware.ts` -- format-only cookie validation
  - `C:/Users/Brian/OneDrive/Desktop/New folder (3)/workflow-xray/src/lib/auth.ts` -- hardcoded default salt, auth functions defined but not used in routes
  - `C:/Users/Brian/OneDrive/Desktop/New folder (3)/workflow-xray/src/lib/rate-limit.ts` -- per-isolate Map-based rate limiting
  - `C:/Users/Brian/OneDrive/Desktop/New folder (3)/workflow-xray/src/lib/claude.ts` -- 4096 max_tokens, 45s timeout, no retry logic
  - `C:/Users/Brian/OneDrive/Desktop/New folder (3)/workflow-xray/src/lib/decompose.ts` -- JSON parsing, no retry on failure
  - `C:/Users/Brian/OneDrive/Desktop/New folder (3)/workflow-xray/src/lib/org-context.ts` -- reads all workflows without tenant filtering
  - `C:/Users/Brian/OneDrive/Desktop/New folder (3)/workflow-xray/src/app/api/workflows/route.ts` -- unvalidated POST endpoint
  - `C:/Users/Brian/OneDrive/Desktop/New folder (3)/workflow-xray/src/app/api/notion-sync/route.ts` -- sequential block deletion

- **MEDIUM confidence (domain patterns from training data, not web-verified):**
  - Vercel serverless cold start behavior and isolate lifecycle
  - Anthropic API error codes and retry best practices
  - `@upstash/ratelimit` as the standard distributed rate limiting solution for Vercel
  - Notion API rate limits and batch operation constraints
  - `html2canvas` limitations for complex DOM rendering

- **Note:** Web search was unavailable during this research session (both built-in WebSearch and Brave Search API). All findings are based on direct codebase analysis (HIGH confidence) and training data domain knowledge (MEDIUM confidence). Specific library version claims and API behavior should be validated against current documentation before implementation.

---
*Pitfalls research for: Workflow X-Ray production hardening*
*Researched: 2026-02-16*
