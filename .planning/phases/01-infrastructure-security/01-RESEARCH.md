# Phase 1: Infrastructure & Security - Research

**Researched:** 2026-02-16
**Domain:** Next.js 16 API route hardening -- persistence, auth, validation, error handling
**Confidence:** HIGH

## Summary

This phase addresses four foundational gaps in the existing Workflow X-Ray application: silent fallback to in-memory storage (INFR-01), auth cookie spoofing via format-only validation in middleware (INFR-02), inconsistent error response shapes across 13 API routes (INFR-03), and absence of Zod input validation on most routes (INFR-04).

The codebase is a Next.js 16.1.6 app with React 19.2.3 using Zod 4.3.6 for schema validation (already used in 3 files: `decompose.ts`, `extraction-schemas.ts`, `remediation/route.ts`). It uses `@vercel/kv` 3.0.0 for persistence with Vercel Blob as a secondary backend and an in-memory `Map` as a silent fallback. Authentication is cookie-based using SHA-256 hashing with `node:crypto`, but the middleware (Edge Runtime) only validates cookie format (64 hex chars) -- not the actual hash value. Error responses vary in shape across routes: some return `{ error: string }`, others `{ error: string, status: number }`, and the catch blocks leak `error.message` directly in several routes.

The key architectural insight is that **all four requirements are interconnected**: a centralized API handler wrapper can solve error consistency (INFR-03), provide the hook for input validation (INFR-04), and eliminate the boilerplate duplication seen across all 13 routes. The auth fix (INFR-02) requires migrating `middleware.ts` to `proxy.ts` (Next.js 16 feature) which gives access to the full Node.js runtime including `node:crypto`, enabling real hash validation at the edge. The storage fix (INFR-01) requires removing the silent in-memory fallback and making missing KV/Blob configuration a hard error.

**Primary recommendation:** Build a `withApiHandler` wrapper that standardizes error responses, integrates Zod validation, and handles rate limiting -- then migrate all 13 routes to use it. Migrate `middleware.ts` to `proxy.ts` for real auth validation. Make missing storage configuration throw on startup rather than silently falling back.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | 4.3.6 | Input validation schemas | Already in the project, 14x faster than v3, standard for Next.js validation |
| @vercel/kv | 3.0.0 | Redis-based persistence (via Upstash) | Already configured as primary storage backend |
| @vercel/blob | 2.2.0 | Blob-based persistence (secondary) | Already configured as fallback storage |
| next | 16.1.6 | Framework -- includes `proxy.ts` support | Current version, provides Node.js runtime for proxy |

### Supporting (No New Dependencies Needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:crypto | built-in | SHA-256 hashing for auth | Available in proxy.ts (Node.js runtime), API routes |
| Web Crypto API | built-in | SHA-256 hashing (Edge fallback) | Only needed if staying on middleware.ts (not recommended) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| proxy.ts migration | Web Crypto in middleware.ts | proxy.ts is simpler, gives full Node.js runtime, future-proof since middleware is deprecated |
| Manual API wrapper | next-safe-action | next-safe-action adds complexity for server actions; manual wrapper is simpler for route handlers |
| @vercel/kv | Direct @upstash/redis | @vercel/kv is a thin wrapper around Upstash; both work, but project already uses @vercel/kv |

**Installation:** No new dependencies required. Everything needed is already installed.

## Architecture Patterns

### Recommended Project Structure Changes
```
src/
  lib/
    api-handler.ts       # NEW: withApiHandler wrapper (error + validation)
    api-errors.ts        # NEW: AppError class + error response builder
    validation.ts        # NEW: Zod schemas for all API route inputs
    auth.ts              # EXISTING: add validateAuthCookie() for proxy
    db.ts                # MODIFY: remove silent memory fallback, add backend check
    rate-limit.ts        # EXISTING: no changes needed
proxy.ts                 # NEW: replaces middleware.ts (full Node.js runtime)
middleware.ts            # DELETE after proxy.ts migration
```

### Pattern 1: Centralized API Handler Wrapper
**What:** A higher-order function that wraps every API route handler, providing consistent error handling, input validation, and structured error responses.
**When to use:** Every API route in the application (except SSE streaming routes).
**Why:** Eliminates the 400+ lines of duplicated try/catch, rate-limit, and body-parsing boilerplate across 13 routes.

```typescript
// src/lib/api-handler.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

interface ApiErrorResponse {
  error: ApiError;
}

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

interface HandlerOptions<T> {
  schema?: z.ZodType<T>;
  rateLimit?: { key: string; max: number; windowSeconds: number };
  maxBodySize?: number;
}

export function withApiHandler<T = unknown>(
  handler: (request: NextRequest, body: T) => Promise<NextResponse>,
  options: HandlerOptions<T> = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Rate limiting (if configured)
      if (options.rateLimit) {
        // ... rate limit check, return 429 with structured error
      }

      // Parse & validate body (for POST/PUT/PATCH)
      let body: T = undefined as T;
      if (["POST", "PUT", "PATCH"].includes(request.method)) {
        let rawBody: unknown;
        try {
          rawBody = await request.json();
        } catch {
          throw new AppError("INVALID_JSON", "Request body must be valid JSON.", 400);
        }

        if (options.schema) {
          const result = options.schema.safeParse(rawBody);
          if (!result.success) {
            throw new AppError(
              "VALIDATION_ERROR",
              "Input validation failed.",
              400,
              result.error.issues.map((i) => ({
                path: i.path.join("."),
                message: i.message,
              }))
            );
          }
          body = result.data;
        } else {
          body = rawBody as T;
        }
      }

      return await handler(request, body);
    } catch (error) {
      if (error instanceof AppError) {
        return NextResponse.json(
          {
            error: {
              code: error.code,
              message: error.message,
              ...(error.details ? { details: error.details } : {}),
            },
          } satisfies ApiErrorResponse,
          { status: error.statusCode }
        );
      }

      // Zod errors from inside the handler
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Data validation failed.",
              details: error.issues,
            },
          } satisfies ApiErrorResponse,
          { status: 400 }
        );
      }

      // Unknown errors -- never leak stack traces
      console.error("[API Error]", error);
      return NextResponse.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred. Please try again.",
          },
        } satisfies ApiErrorResponse,
        { status: 500 }
      );
    }
  };
}
```

### Pattern 2: Structured Error Response Shape
**What:** Every error response from every API route uses the same JSON structure.
**When to use:** Always -- this is the contract.
**Shape:**
```typescript
// Success responses: varies by route (existing behavior)
// Error responses: ALWAYS this shape
{
  "error": {
    "code": "VALIDATION_ERROR",     // machine-readable error code
    "message": "Description too long", // human-readable message
    "details": [...]                  // optional: validation issues, etc.
  }
}
```

**Error code catalog (recommended):**
| Code | HTTP Status | When |
|------|-------------|------|
| `INVALID_JSON` | 400 | Request body is not valid JSON |
| `VALIDATION_ERROR` | 400 | Zod schema validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid auth |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `SERVICE_UNAVAILABLE` | 503 | Missing API key or config |
| `AI_ERROR` | 502 | Anthropic/external API failure |
| `STORAGE_ERROR` | 500 | KV/Blob operation failed |
| `INTERNAL_ERROR` | 500 | Unexpected/unknown error |

### Pattern 3: proxy.ts Auth Validation (Next.js 16)
**What:** Replace `middleware.ts` with `proxy.ts` which runs on Node.js runtime, enabling real SHA-256 hash validation.
**When to use:** Request interception for auth gating.

```typescript
// proxy.ts (Next.js 16 -- Node.js runtime, NOT Edge)
import { NextRequest, NextResponse } from "next/server";
import { getExpectedToken, safeCompare, AUTH_COOKIE_NAME } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow: login page, auth API, static files
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg")
  ) {
    return NextResponse.next();
  }

  const authPassword = process.env.AUTH_PASSWORD;
  if (!authPassword) return NextResponse.next();

  const authCookie = request.cookies.get(AUTH_COOKIE_NAME);
  if (!authCookie?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // REAL validation: compare cookie hash to expected hash
  // This is now possible because proxy.ts runs on Node.js runtime
  const expectedToken = getExpectedToken();
  if (!expectedToken || !safeCompare(authCookie.value, expectedToken)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### Pattern 4: Fail-Hard Storage Initialization
**What:** Remove the silent in-memory fallback from `db.ts`. If no storage backend is configured, throw an error at startup/first-use rather than silently losing data.
**When to use:** Always in production. Local dev can optionally use a flag to enable memory store.

```typescript
// Modified getBackend() in db.ts
async function getBackend(): Promise<StorageBackend> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return "kv";
  }
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return "blob";
  }
  // Only allow memory in explicit local dev mode
  if (process.env.ALLOW_MEMORY_STORAGE === "true") {
    console.warn("[db] WARNING: Using in-memory storage. Data will not persist.");
    return "memory";
  }
  throw new Error(
    "No storage backend configured. Set KV_REST_API_URL + KV_REST_API_TOKEN, " +
    "BLOB_READ_WRITE_TOKEN, or ALLOW_MEMORY_STORAGE=true for local dev."
  );
}
```

### Anti-Patterns to Avoid
- **Leaking error.message to the client:** Several routes currently do `error: err instanceof Error ? err.message : "..."`. This can leak internal details, stack traces, or file paths. Always use a sanitized message.
- **Inconsistent error shapes:** Currently some routes return `{ error: "string" }` and others `{ error: "string", status: number }`. The wrapper must enforce ONE shape.
- **Validating body inline with typeof checks:** Routes like `decompose/route.ts` check `typeof body.description !== "string"` manually. Use Zod schemas instead -- they're already in the project.
- **Format-only auth validation:** The current middleware checks `/^[a-f0-9]{64}$/` but never verifies the hash matches. This is a security bypass.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Input validation | Manual typeof checks per field | Zod schemas (already installed v4.3.6) | Zod gives type inference, detailed error messages, coercion |
| Error response formatting | Per-route try/catch with different shapes | Centralized `withApiHandler` wrapper | Single point of change, guaranteed consistency |
| Auth hash comparison | String `===` comparison | `crypto.timingSafeEqual` (already in auth.ts) | Prevents timing attacks |
| Body size limits | Manual `body.length` checks | Zod `.max()` constraints + Next.js body size config | Zod validates before processing, Next.js rejects at framework level |
| Workflow ID indexing | JSON array with GET-then-SET | Redis Set commands (`SADD`/`SMEMBERS`/`SREM`) | Atomic operations, no race conditions |

**Key insight:** Zod 4.3.6 is already installed and used in 3 files. Extending it to all 13 routes is incremental work, not a new dependency. The `withApiHandler` pattern eliminates ~30 lines of boilerplate per route.

## Common Pitfalls

### Pitfall 1: Silent Memory Fallback Causes Data Loss in Production
**What goes wrong:** `db.ts` silently falls back to an in-memory `Map` when KV/Blob env vars are missing. On Vercel, serverless functions have short lifetimes -- data saved in one invocation is gone in the next.
**Why it happens:** The code was written for easy local development but the fallback persists to production.
**How to avoid:** Make missing storage config a hard error. Add `ALLOW_MEMORY_STORAGE=true` env var for explicit local dev opt-in.
**Warning signs:** Workflows disappearing after serverless function cold starts.

### Pitfall 2: Auth Cookie Spoofing via Format-Only Validation
**What goes wrong:** The current `middleware.ts` only checks that the auth cookie is a 64-character hex string (`/^[a-f0-9]{64}$/`). Any 64-char hex string passes -- the cookie does not need to be the actual hash of the password.
**Why it happens:** Edge Runtime cannot import `node:crypto`. The comment in the code explicitly acknowledges this: "we use a simpler approach" and "Full hash validation happens in API routes via auth.ts." But API routes do NOT validate the cookie either -- only `/api/auth` POST sets it.
**How to avoid:** Migrate to `proxy.ts` (Node.js runtime) which can import `node:crypto` and call `safeCompare()` with `getExpectedToken()`.
**Warning signs:** A user with any valid-format hex cookie can access the entire app.

### Pitfall 3: Vercel KV Race Condition on workflow:ids Array
**What goes wrong:** The `saveWorkflow` function reads `workflow:ids`, appends the new ID, then writes back. Two concurrent saves can both read the same array, each append their ID, and the second write overwrites the first -- losing an ID.
**Why it happens:** GET-then-SET is not atomic in Redis. The code does `kv.get("workflow:ids")` then `kv.set("workflow:ids", ids)` -- a classic read-modify-write race.
**How to avoid:** Use Redis `SADD` (set add) instead of a JSON array for the ID index. `SADD` is atomic. Verified: `@vercel/kv` 3.0.0 (via `@upstash/redis`) exports `SAddCommand`, `SMembersCommand`, and `SRemCommand` -- the `kv.sadd()`, `kv.smembers()`, and `kv.srem()` methods are available.
**Warning signs:** Workflows saved but not appearing in the list; `workflow:ids` array has fewer entries than expected.

### Pitfall 4: Zod v4 API Differences from v3 Examples
**What goes wrong:** Developers use v3-era patterns that are deprecated or changed in Zod v4.
**Why it happens:** Most online examples and training data use Zod v3 syntax.
**How to avoid:** Key Zod v4 changes to be aware of:
- `z.ZodError` is now `z.ZodError` (same) but check with `instanceof z.ZodError`
- `.strict()` deprecated -> use `z.strictObject({...})` if needed
- `.merge()` deprecated -> use `.extend()` or spread
- Error customization uses `error` param not `message`: `z.string().min(5, { error: "Too short" })`
- `z.string().email()` still works but `z.email()` is also available at top level
- `.int()` now only accepts safe integers (`Number.MIN_SAFE_INTEGER` to `Number.MAX_SAFE_INTEGER`)
- Infinite values are rejected by `z.number()` by default
**Warning signs:** TypeScript compilation errors or unexpected runtime behavior with schemas.

### Pitfall 5: proxy.ts Config Flag Rename
**What goes wrong:** Using `skipMiddlewareUrlNormalize` instead of `skipProxyUrlNormalize` in `next.config.ts` after migrating to proxy.ts.
**Why it happens:** Middleware config flags were renamed when the convention changed.
**How to avoid:** If any middleware config flags are used in `next.config.ts`, rename them. The Next.js 16 codemod can help: `npx @next/codemod@canary upgrade latest`.
**Warning signs:** Build warnings about deprecated config options.

### Pitfall 6: Error Leak via err.message
**What goes wrong:** Several API routes include `err instanceof Error ? err.message : "fallback"` in error responses. This can expose file paths, database connection strings, or internal implementation details.
**Routes affected:** `extract-workflows/route.ts` (line 120), `extract-from-screenshot/route.ts` (line 113), `parse-file/route.ts` (line 155), `crawl-site/route.ts` (lines 417, 444).
**How to avoid:** Never pass `err.message` directly to the client. Log it server-side, return a sanitized message.
**Warning signs:** Users seeing error messages containing file paths or stack traces.

### Pitfall 7: Frontend Error Parsing Breaking Change
**What goes wrong:** Frontend code that parses `response.error` as a string will break when the error shape changes from `{ error: "message" }` to `{ error: { code, message, details } }`.
**Why it happens:** Changing the API error contract affects all consumers.
**How to avoid:** Search for all frontend `fetch` calls that read `.error` from API responses. Update them to read `.error.message` instead. Alternatively, provide a transition period where both shapes are supported.
**Warning signs:** Frontend showing `[object Object]` instead of error messages after the migration.

## Code Examples

### Example 1: Zod Input Schema for Decompose Route
```typescript
// src/lib/validation.ts
import { z } from "zod";

export const DecomposeInputSchema = z.object({
  description: z.string().min(1, { error: "Workflow description is required" }).max(15000, {
    error: "Description too long (max 15,000 characters)",
  }),
  stages: z
    .array(
      z.object({
        name: z.string().max(500),
        owner: z.string().max(200).optional(),
        tools: z.string().max(500).optional(),
        inputs: z.string().max(500).optional(),
        outputs: z.string().max(500).optional(),
      })
    )
    .max(20)
    .optional(),
  context: z.string().max(5000).optional(),
  parentId: z.string().optional(),
  costContext: z
    .object({
      hourlyRate: z.number().min(0).max(10000).optional(),
      hoursPerStep: z.number().min(0).max(1000).optional(),
      teamSize: z.number().int().min(1).max(10000).optional(),
      teamContext: z.string().max(200).optional(),
    })
    .optional(),
});

export type DecomposeInput = z.infer<typeof DecomposeInputSchema>;
```

### Example 2: Structured Error Response Helper
```typescript
// src/lib/api-errors.ts
import { NextResponse } from "next/server";

export interface StructuredError {
  code: string;
  message: string;
  details?: unknown;
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    },
    { status }
  );
}

// Convenience functions
export const badRequest = (message: string, details?: unknown) =>
  errorResponse("VALIDATION_ERROR", message, 400, details);

export const unauthorized = (message = "Authentication required") =>
  errorResponse("UNAUTHORIZED", message, 401);

export const notFound = (message = "Resource not found") =>
  errorResponse("NOT_FOUND", message, 404);

export const rateLimited = (retryAfterSeconds: number) =>
  errorResponse(
    "RATE_LIMITED",
    `Rate limit exceeded. Try again in ${retryAfterSeconds}s.`,
    429
  );

export const serviceUnavailable = (message: string) =>
  errorResponse("SERVICE_UNAVAILABLE", message, 503);

export const internalError = (message = "An unexpected error occurred.") =>
  errorResponse("INTERNAL_ERROR", message, 500);
```

### Example 3: Migrated Route Using withApiHandler
```typescript
// src/app/api/compare/route.ts (after migration)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";

const CompareSchema = z.object({
  before: z.record(z.string(), z.unknown()),  // Decomposition shape (loose)
  after: z.record(z.string(), z.unknown()),
});

export const POST = withApiHandler(
  async (request: NextRequest, body: z.infer<typeof CompareSchema>) => {
    const result = compareDecompositions(body.before, body.after);
    return NextResponse.json(result);
  },
  {
    schema: CompareSchema,
    rateLimit: { key: "compare", max: 20, windowSeconds: 60 },
  }
);
```

### Example 4: KV Race Condition Fix with SADD
```typescript
// In saveWorkflow -- replace array-based ID tracking with Redis Set
if (backend === "kv") {
  const kv = (await getKv())!;
  await kv.set(`workflow:${workflow.id}`, JSON.stringify(workflow));
  // SADD is atomic -- no read-modify-write race
  await kv.sadd("workflow:ids", workflow.id);
  return;
}

// In listWorkflows -- use SMEMBERS instead of GET
if (backend === "kv") {
  const kv = (await getKv())!;
  const ids: string[] = await kv.smembers("workflow:ids");
  // ... rest of logic
}

// In deleteWorkflow -- use SREM instead of array filter
if (backend === "kv") {
  const kv = (await getKv())!;
  await kv.del(`workflow:${id}`);
  await kv.srem("workflow:ids", id);
  return true;
}
```

### Example 5: One-Time Migration from Array to Set
```typescript
// Migration helper: call once during first listWorkflows after upgrade
async function migrateIdsToSet(kv: VercelKV): Promise<void> {
  const raw = await kv.get("workflow:ids");
  if (raw === null) return; // No data or already a Set

  // If it's an array or JSON string, migrate to Set
  let ids: string[] = [];
  if (Array.isArray(raw)) {
    ids = raw;
  } else if (typeof raw === "string") {
    try { ids = JSON.parse(raw); } catch { return; }
  } else {
    return; // Already a Set or unknown format
  }

  if (ids.length > 0) {
    // SADD all existing IDs atomically
    await kv.sadd("workflow:ids", ...ids);
  }

  // Delete the old key format (now stored as Set under same key)
  // Note: SADD to the same key that was a string will replace it
  console.log(`[db] Migrated ${ids.length} workflow IDs from array to Redis Set`);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` (Edge Runtime) | `proxy.ts` (Node.js Runtime) | Next.js 16 (2025) | Full Node.js API access including `node:crypto` |
| Zod v3 `.strict()` | Zod v4 `z.strictObject()` | Zod 4.0 (June 2025) | Method renamed, old still works with deprecation warning |
| Zod v3 `message` param | Zod v4 `error` param | Zod 4.0 (June 2025) | `{ message: "..." }` -> `{ error: "..." }` |
| Vercel KV (managed) | Upstash Redis (via Marketplace) | December 2024 | Vercel KV deprecated, auto-migrated to Upstash; `@vercel/kv` package still works |
| `next lint` | `eslint` CLI directly | Next.js 16 | `next lint` removed; ESLint must be run separately |

**Deprecated/outdated:**
- `middleware.ts`: Deprecated in Next.js 16, renamed to `proxy.ts`. Will be removed in a future version.
- `Vercel KV` (product): Deprecated December 2024, migrated to Upstash Redis. `@vercel/kv` package still works as wrapper.
- `z.string().email()` (method form): Still works in Zod v4 but `z.email()` is preferred.

## Complete API Route Inventory

All 13 API routes requiring INFR-03 (error consistency) and INFR-04 (input validation):

| Route | Methods | Current Validation | Current Error Shape | Notes |
|-------|---------|-------------------|--------------------|----|
| `/api/auth` | POST, DELETE | Manual typeof checks | `{ error: string }` | Rate limited; has body parsing |
| `/api/decompose` | POST | Manual typeof + length checks | `{ error: string }` | Most complex validation needs |
| `/api/workflows` | GET, POST, DELETE | None (POST), basic (GET/DEL) | `{ error: string }` | POST blindly saves whatever is sent |
| `/api/compare` | POST | Basic existence check | `{ error: string }` | Needs before/after shape validation |
| `/api/remediation` | POST, GET | Manual + Zod (partial) | `{ error: string }` or Zod-aware | Already uses Zod for Claude output; not for input |
| `/api/notion-import` | POST | Manual typeof check | `{ error: string }` | External service errors handled |
| `/api/notion-sync` | POST | Manual existence check | `{ error: string }` | Complex body (workflow object) |
| `/api/remediation-notion-sync` | POST | Manual existence check | `{ error: string }` | Complex body (plan + gaps) |
| `/api/extract-workflows` | POST | Manual typeof + length | `{ error: string }` | Leaks err.message |
| `/api/extract-from-screenshot` | POST | Manual typeof + size | `{ error: string }` | Leaks err.message |
| `/api/scrape-url` | POST | Manual typeof + URL parse | `{ error: string }` | Good SSRF protection |
| `/api/crawl-site` | POST | Manual typeof + URL parse | SSE events (different) | SSE streaming route -- special case |
| `/api/parse-file` | POST | FormData + manual checks | `{ error: string }` | Leaks err.message; uses FormData not JSON |

**Special cases:**
- `crawl-site` uses SSE streaming (`text/event-stream`), not JSON responses. Error events within the stream should still use a consistent structure, but the HTTP response itself is a stream. The `withApiHandler` wrapper should NOT wrap this route's streaming logic; instead, pre-stream validation errors (bad URL, rate limit) should use the structured error format, and error events within the stream should include `code` and `message` fields.
- `parse-file` uses `FormData`, not JSON body. The `withApiHandler` wrapper needs to either skip body parsing for this route or support a FormData mode. Recommendation: use the wrapper for error handling only, handle FormData extraction manually within the handler, then validate extracted fields with Zod.

## Open Questions

1. **KV Migration from Array to Set**
   - What we know: `workflow:ids` is currently stored as a JSON array. Migrating to a Redis Set (`SADD`/`SMEMBERS`/`SREM`) fixes the race condition. `@vercel/kv` 3.0.0 confirms `sadd`, `smembers`, `srem` are available (verified in `@upstash/redis` type exports: `SAddCommand`, `SMembersCommand`, `SRemCommand`).
   - What's unclear: Whether existing data in production needs a migration step (read old array, SADD each ID, delete old key). Redis behavior when calling SADD on a key that was previously stored as a string type (via `kv.set`) -- Redis may reject this as a WRONGTYPE error.
   - Recommendation: Write a one-time migration function that reads the old array, SADDs all IDs to a new key or the same key after DEL, then switches reads to SMEMBERS. Handle WRONGTYPE errors gracefully during transition.

2. **crawl-site SSE Error Formatting**
   - What we know: This route uses Server-Sent Events, not JSON responses. The `withApiHandler` wrapper does not apply to the streaming body.
   - What's unclear: Whether SSE error events should use the same `{ error: { code, message, details } }` shape inside the `data:` field.
   - Recommendation: Use the same shape inside SSE event data for consistency. Only the transport differs. Pre-stream errors (rate limit, bad input) should return normal JSON error responses.

3. **parse-file FormData Handling**
   - What we know: This route uses `request.formData()` not `request.json()`. Zod cannot validate FormData directly.
   - What's unclear: Best pattern for validating FormData inputs with Zod.
   - Recommendation: Extract FormData fields manually, then validate the extracted object with Zod. The `withApiHandler` wrapper should have a `bodyType: "formdata" | "json" | "none"` option, or `parse-file` should use the wrapper only for error handling (not body parsing).

4. **Frontend Error Shape Migration**
   - What we know: The current frontend expects `{ error: "string" }` from API responses. Changing to `{ error: { code, message } }` will break the frontend.
   - What's unclear: How many frontend `fetch` call sites read `.error` from API responses, and whether this phase should also update the frontend or defer that.
   - Recommendation: Search the frontend for error response handling patterns and update them as part of this phase. Alternatively, keep the error field name but nest it: `{ error: { code, message } }` -- frontend code checking `if (data.error)` will still be truthy.

## Sources

### Primary (HIGH confidence)
- Next.js 16 upgrade guide (https://nextjs.org/docs/app/guides/upgrading/version-16) -- proxy.ts migration, middleware deprecation, Node.js runtime for proxy
- Zod v4 migration guide (https://zod.dev/v4/changelog) -- breaking changes from v3 to v4
- Codebase analysis -- all 13 API routes, auth.ts, db.ts, middleware.ts, types.ts read directly
- `@upstash/redis` type exports -- verified `SAddCommand`, `SMembersCommand`, `SRemCommand` presence in `nodejs.d.ts`
- `@vercel/kv` README -- confirms `kv.sadd()` usage example

### Secondary (MEDIUM confidence)
- Vercel KV deprecation (https://github.com/vercel/storage/issues/829) -- KV moved to Upstash Redis December 2024
- Redis atomic operations (https://redis.io/glossary/redis-race-condition/) -- SADD atomicity for race condition fix
- Upstash distributed locking (https://upstash.com/blog/lock) -- alternative approach if SADD insufficient

### Tertiary (LOW confidence)
- Zod v4 InfoQ article (https://www.infoq.com/news/2025/08/zod-v4-available/) -- performance claims (14x faster)
- next-edge-crypto (https://github.com/NorasTech/next-edge-crypto) -- alternative if proxy.ts migration is blocked

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed, versions verified in package.json and node_modules
- Architecture: HIGH -- patterns derived from direct codebase analysis of all 13 routes; proxy.ts verified in official Next.js 16 docs
- Pitfalls: HIGH -- each pitfall identified from actual code inspection (middleware.ts line 57, db.ts line 40, route error leaks identified by line number)
- KV race condition fix (SADD): HIGH -- `@vercel/kv` README shows `kv.sadd()` example; `@upstash/redis` TypeScript types export `SAddCommand`, `SMembersCommand`, `SRemCommand`

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days -- stable domain, no fast-moving changes expected)
