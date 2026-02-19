---
plan: 08-01
status: complete
duration: 3m
tasks_completed: 2
files_modified:
  - middleware.ts
  - src/lib/types.ts
  - src/lib/validation.ts
  - src/lib/db-shares.ts
---

## What was done

Created the auth enforcement middleware and the share link data layer. The middleware runs on Edge Runtime and validates auth cookies using Web Crypto API SHA-256 hashing on all non-public routes, returning 401 JSON for API routes or redirecting to /login for page routes. The share link data layer adds the ShareLink type, Zod validation schemas, and full CRUD operations for share tokens stored in Vercel KV with a memory fallback for local development.

## Artifacts created

- `middleware.ts`: Edge Runtime auth middleware enforcing authentication on all routes except /api/auth, /api/share/*, /share/*, /login, /favicon.ico, /_next/*. Uses crypto.subtle.digest for SHA-256 hashing and constant-time hex comparison to prevent timing attacks.
- `src/lib/types.ts` (modified): Added ShareLink interface with token, workflowId, label, createdAt, expiresAt, accessCount, lastAccessedAt, and permissions fields.
- `src/lib/validation.ts` (modified): Added CreateShareLinkSchema (workflowId, label, expiresInDays) and DeleteShareLinkSchema (token) with Zod v4 syntax.
- `src/lib/db-shares.ts`: Full share link CRUD with createShareLink, getShareLink (with access count increment), listShareLinks (with stale token cleanup), deleteShareLink, and deleteShareLinksForWorkflow. Uses KV primary storage with secondary index (workflow:{id}:shares) and in-memory fallback.

## Key decisions

- Reimplemented SHA-256 hashing using Web Crypto API in middleware rather than importing from auth.ts, since middleware runs on Edge Runtime and cannot use Node.js crypto module
- AUTH_COOKIE_NAME imported from @/lib/auth as a string constant (works fine on Edge Runtime)
- Used constant-time XOR comparison for hex strings instead of crypto.timingSafeEqual (not available in Edge Runtime)
- getShareLink increments accessCount as best-effort (does not throw on failure) since it is called from public share routes
- Internal _getShareLinkRaw function for reads without side effects (used by listShareLinks)
- Memory fallback checks expiresAt manually since there is no TTL mechanism in Map storage

## Verification

- `npx tsc --noEmit`: passed with zero errors (both after Task 1 and after Task 2)
- middleware.ts confirmed at project root (not src/)
- crypto.subtle.digest confirmed in middleware (Edge Runtime compatible)
- All 5 db-shares.ts functions exported and typed
- ShareLink type has all required fields
- ALLOW_MEMORY_STORAGE guard present in db-shares.ts

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- All 5 files verified on disk (middleware.ts, src/lib/types.ts, src/lib/validation.ts, src/lib/db-shares.ts, SUMMARY.md)
- Commit 0a2384d (Task 1) verified in git log
- Commit 6d65dbb (Task 2) verified in git log
