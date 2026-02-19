# Architecture Research: v1.2 Collaboration & Deeper AI Intelligence

**Domain:** Shareable links, comments/notes, cross-workflow AI analysis integrated into existing Next.js 16 + Vercel KV application
**Researched:** 2026-02-18
**Confidence:** HIGH (based on full codebase audit of all source files, established Redis/KV data modeling patterns, Next.js App Router conventions)

**Note on sources:** Web search was unavailable during this research. Recommendations are based on thorough codebase analysis (every lib, API route, component, and type file read) combined with established Redis data modeling patterns, Next.js middleware conventions, and token-based sharing patterns. The existing codebase already uses Vercel KV with Redis Set operations (SADD, SREM, SMEMBERS), confirming full Redis command support. Confidence is HIGH because the patterns recommended here are well-established Redis idioms and straightforward extensions of the existing architecture.

---

## Current Architecture Baseline

Before designing new features, here is the exact current state:

```
+---------------------------------------------------------------+
|                    CLIENT (Browser)                            |
|  Zustand store (UI state) + localStorage (client-db.ts)       |
|  Pages: /, /library, /dashboard, /compare, /xray/[id], /login |
|  Components: 30 files in src/components/                      |
+---------------------------------------------------------------+
         | fetch / SSE
+---------------------------------------------------------------+
|                    SERVER (Next.js API Routes)                 |
|  13 routes in src/app/api/                                    |
|  Shared: api-handler.ts, api-errors.ts, validation.ts         |
|  Business: claude.ts, decompose.ts, scoring.ts, org-context.ts|
|  Auth: Single password gate (AUTH_PASSWORD env var, SHA-256    |
|        hash in httpOnly cookie, no middleware -- route-level)  |
+---------------------------------------------------------------+
         |
+---------------------------------------------------------------+
|                    STORAGE + EXTERNAL                          |
|  db.ts: Vercel KV > Blob > in-memory                         |
|  KV keys: workflow:{id}, workflow:ids (Redis Set)             |
|  KV keys: cache:{hash} (analysis cache, 7-day TTL)           |
|  Claude API (decompose, extract, remediate, vision, compare)  |
|  Firecrawl, Notion API                                        |
+---------------------------------------------------------------+
```

### Critical Architecture Facts

1. **No Next.js middleware exists.** Auth is checked per-route or not at all -- most API routes have NO auth check (only rate limiting). The login page sets a cookie, but API routes do not verify it.
2. **KV stores full workflow JSON** per key (workflow:{id}). Average workflow is ~5-15 KB serialized. KV value size limit is 1 MB (Vercel KV / Upstash).
3. **workflow:ids is a Redis Set** (migrated from array). SMEMBERS returns all IDs.
4. **listWorkflows() loads ALL workflows into memory** by fetching every ID, then sorting/filtering in JS. No pagination.
5. **Client-side localStorage mirrors server data** via mergeWithServer(). Server wins on conflicts.
6. **No user identity model.** Everyone shares one password. No user IDs, no sessions beyond the auth cookie.

---

## 1. Shareable Links Architecture

### 1.1 Design Decision: Token-Based Public Access

The core problem: the app is password-gated, but clients/stakeholders need to view specific workflow analyses without having the password. The solution is a cryptographically random share token that grants read-only access to a specific workflow.

**Why token-based over any other approach:**
- The existing auth is a single shared password -- there are no user accounts to add "invite" functionality to
- Share tokens are stateless from the viewer's perspective (no login required)
- Tokens can be revoked independently without affecting the main password
- The URL itself is the credential: `https://app.com/share/{token}`

### 1.2 New KV Data Model for Share Links

```
EXISTING KEYS:
  workflow:{id}          -> Full Workflow JSON
  workflow:ids           -> Redis Set of all workflow IDs
  cache:{hash}           -> CacheEntry JSON (7-day TTL)

NEW KEYS:
  share:{token}          -> ShareLink JSON    (optional TTL)
  workflow:{id}:shares   -> Redis Set of share tokens for this workflow
```

**ShareLink type:**

```typescript
interface ShareLink {
  token: string;           // crypto.randomUUID() -- 36 chars, URL-safe
  workflowId: string;      // The workflow this token grants access to
  createdAt: string;       // ISO timestamp
  expiresAt?: string;      // ISO timestamp (optional -- null = never expires)
  label?: string;          // "For client X" -- helps owner track who has which link
  accessCount: number;     // How many times the link has been viewed
  lastAccessedAt?: string; // ISO timestamp of last view
  permissions: 'readonly'; // Future-proofing: always 'readonly' for now
}
```

**Why crypto.randomUUID() for tokens:** UUID v4 provides 122 bits of randomness. At the scale of a consulting team (tens of share links, not millions), this is more than sufficient. It is URL-safe without encoding, and the Node.js `crypto.randomUUID()` is already used in the codebase (`utils.ts` uses `crypto.randomUUID()`).

**Why a secondary index (workflow:{id}:shares):** When a workflow is deleted, all its share links must be revoked. Without the secondary index, you would need to scan all `share:*` keys (Redis SCAN) to find which ones point to the deleted workflow. The secondary index makes deletion O(n) where n is the number of shares for that workflow, not the total number of shares in the system.

### 1.3 Share Link API Routes

Three new API routes:

| Route | Method | Purpose | Auth Required |
|-------|--------|---------|--------------|
| `/api/shares` | POST | Create a share link for a workflow | YES (password auth) |
| `/api/shares` | GET | List share links for a workflow | YES (password auth) |
| `/api/shares` | DELETE | Revoke a share link | YES (password auth) |
| `/api/share/[token]` | GET | Fetch workflow data via share token | NO (token IS the auth) |

**Critical design point:** The `/api/share/[token]` route must NOT require the password cookie. The whole point is that external viewers access it without logging in. This route validates the token against KV, checks expiration, increments access count, and returns the workflow data.

**Route implementations:**

```
POST /api/shares
  Body: { workflowId: string, label?: string, expiresInDays?: number }
  1. Verify auth cookie (owner only)
  2. Verify workflow exists (getWorkflow)
  3. Generate token = crypto.randomUUID()
  4. Compute expiresAt from expiresInDays (or null)
  5. KV SET share:{token} = ShareLink JSON
  6. KV SADD workflow:{workflowId}:shares {token}
  7. If expiresInDays: set TTL on share:{token}
  8. Return { token, url: `/share/${token}` }

GET /api/shares?workflowId={id}
  1. Verify auth cookie
  2. KV SMEMBERS workflow:{workflowId}:shares
  3. For each token: KV GET share:{token}
  4. Filter out expired/null entries
  5. Return { shares: ShareLink[] }

DELETE /api/shares?token={token}
  1. Verify auth cookie
  2. KV GET share:{token} -> get workflowId
  3. KV DEL share:{token}
  4. KV SREM workflow:{workflowId}:shares {token}
  5. Return { revoked: true }

GET /api/share/[token]
  1. NO auth cookie check
  2. KV GET share:{token}
  3. If null -> 404
  4. If expired -> 410 Gone
  5. KV GET workflow:{workflowId}
  6. If null -> 404 (workflow deleted)
  7. Increment accessCount, set lastAccessedAt
  8. KV SET share:{token} (updated entry)
  9. Return workflow JSON (readonly shape -- strip sensitive fields)
```

### 1.4 Share View Page

New Next.js page: `src/app/share/[token]/page.tsx`

This is a **read-only** view of the workflow X-Ray. It reuses existing visualization components but strips all editing/management UI:

```
src/app/share/[token]/page.tsx
  |
  |-- Fetches: GET /api/share/{token}
  |-- Renders (reuse existing):
  |     XRayViz (flow diagram)
  |     GapAnalysis (gap cards)
  |     HealthCard (health scores)
  |-- Does NOT render:
  |     Export PDF button (optional: could enable)
  |     Re-analyze button
  |     Delete button
  |     Notion sync
  |     Version timeline (no access to other versions)
  |-- Shows: "Shared via Workflow X-Ray" branding footer
  |-- Shows: Expiration warning if link expires within 7 days
```

**Layout consideration:** This page should NOT use the main app layout with nav/login because the viewer is not authenticated. Use a minimal layout wrapper or the root layout with conditional nav hiding.

### 1.5 Workflow Deletion Cascade

When a workflow is deleted (existing `DELETE /api/workflows?id={id}`), all share links must be revoked:

```
MODIFY: src/app/api/workflows/route.ts (DELETE handler)
  BEFORE: deleteWorkflow(id)
  AFTER:
    1. KV SMEMBERS workflow:{id}:shares -> tokens[]
    2. For each token: KV DEL share:{token}
    3. KV DEL workflow:{id}:shares
    4. deleteWorkflow(id)  // existing
```

This is the **one modification to an existing API route** required for share links.

### 1.6 Auth Middleware Introduction

The current app has NO Next.js middleware. Auth is implicit (the login page sets a cookie, but API routes do not check it). For shareable links, we need explicit auth boundaries:

**Recommendation: Add `middleware.ts` at the project root.**

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes -- no auth required
  if (
    pathname.startsWith('/share/') ||      // Share view pages
    pathname.startsWith('/api/share/') ||   // Share token API
    pathname.startsWith('/login') ||        // Login page
    pathname.startsWith('/api/auth') ||     // Auth API
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // All other routes require auth cookie
  const authCookie = request.cookies.get('xray_auth');
  if (!authCookie) {
    // Redirect to login for page requests, 401 for API requests
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Cookie exists -- pass through (cookie value validated at route level)
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

**Why middleware now:** Without middleware, the share page and share API would need their own auth exemption logic. Middleware centralizes the "who can access what" decision. It also fixes the current gap where API routes lack auth checks entirely (currently only rate-limited).

**Important:** The middleware checks for cookie existence only. The actual cookie VALUE validation (SHA-256 hash comparison) still happens at the route level via the existing `safeCompare` logic. Middleware runs on the Edge Runtime and cannot access all Node.js crypto APIs, so keep the hash check server-side.

---

## 2. Comments/Notes Architecture

### 2.1 Design Decision: Workflow-Level and Gap-Level Comments

Comments attach to two scoping levels:

1. **Workflow-level comments** -- general notes about the workflow ("Client confirmed step 3 is outdated")
2. **Gap-level comments** -- notes on specific gaps ("We are addressing this in Q2 sprint")

No step-level comments (too granular, low value for the effort). Gaps are the primary actionable items in the X-Ray, so gap-level comments provide the most collaboration value.

### 2.2 New KV Data Model for Comments

```
NEW KEYS:
  comment:{id}                -> Comment JSON
  workflow:{id}:comments      -> Redis Set of comment IDs (workflow-level)
  gap:{workflowId}:{gapIndex}:comments -> Redis Set of comment IDs (gap-level)
```

**Comment type:**

```typescript
interface Comment {
  id: string;                  // crypto.randomUUID()
  workflowId: string;         // Which workflow this comment belongs to
  targetType: 'workflow' | 'gap';
  targetId: string;            // workflowId for workflow-level, "{workflowId}:{gapIndex}" for gap-level
  gapIndex?: number;           // 0-based index into decomposition.gaps (only for gap comments)
  author: string;              // Free-text author name (no user accounts)
  content: string;             // The comment text (max 2000 chars)
  createdAt: string;           // ISO timestamp
  updatedAt?: string;          // ISO timestamp (if edited)
  resolved?: boolean;          // For gap comments: mark as "addressed"
  resolvedAt?: string;         // When it was resolved
}
```

**Why free-text author instead of user IDs:** There are no user accounts. The app uses a single shared password. Rather than building a full identity system (massive scope), use a simple author name input. The owner sets their name when commenting (persisted in localStorage for convenience). This is pragmatic: the target users are small consulting teams who know each other.

**Why gap index instead of gap ID:** The existing `Gap` type has no `id` field. Gaps are identified by their position in the `decomposition.gaps` array. Adding a gap ID would require modifying the Claude prompt, the Zod schema, the decompose pipeline, and all existing stored workflows. Using the array index is simpler and matches how gaps are rendered (by index in `gap-analysis.tsx`).

**Risk with gap index:** If a workflow is re-analyzed (new version), the gap array may change. Comments on gap index 2 in v1 may not correspond to the same gap in v2. **Mitigation:** Comments are scoped to a specific workflow ID (a specific version), not the version chain. When viewing a re-analyzed workflow, its comments are separate from the original's comments. The version timeline already shows distinct workflow IDs per version.

### 2.3 Comments API Routes

| Route | Method | Purpose | Auth Required |
|-------|--------|---------|--------------|
| `/api/comments` | POST | Create a comment | YES |
| `/api/comments` | GET | List comments for a workflow or gap | YES |
| `/api/comments` | DELETE | Delete a comment | YES |
| `/api/comments` | PATCH | Edit or resolve a comment | YES |

**Route implementations:**

```
POST /api/comments
  Body: { workflowId, targetType, gapIndex?, author, content }
  1. Verify auth cookie
  2. Validate input (Zod schema)
  3. Verify workflow exists
  4. If gap comment: verify gapIndex is within bounds
  5. Generate id = crypto.randomUUID()
  6. Build Comment object
  7. KV SET comment:{id}
  8. If workflow-level: KV SADD workflow:{workflowId}:comments {id}
  9. If gap-level: KV SADD gap:{workflowId}:{gapIndex}:comments {id}
  10. Return comment

GET /api/comments?workflowId={id}&gapIndex={n}
  1. Verify auth cookie
  2. If gapIndex provided: KV SMEMBERS gap:{workflowId}:{gapIndex}:comments
     Else: KV SMEMBERS workflow:{workflowId}:comments
  3. For each ID: KV GET comment:{id}
  4. Filter nulls, sort by createdAt
  5. Return { comments: Comment[] }

DELETE /api/comments?id={commentId}
  1. Verify auth cookie
  2. KV GET comment:{commentId} -> get workflowId, targetType, gapIndex
  3. KV DEL comment:{commentId}
  4. Remove from appropriate set index
  5. Return { deleted: true }

PATCH /api/comments
  Body: { id, content?, resolved? }
  1. Verify auth cookie
  2. KV GET comment:{id}
  3. Update fields, set updatedAt
  4. KV SET comment:{id}
  5. Return updated comment
```

### 2.4 Comment Cascade on Workflow Deletion

When a workflow is deleted, all its comments (workflow-level AND gap-level) must be cleaned up:

```
MODIFY: deleteWorkflow cascade (already modified for shares)
  Additional steps:
    1. KV SMEMBERS workflow:{workflowId}:comments -> commentIds[]
    2. For each commentId: KV DEL comment:{commentId}
    3. KV DEL workflow:{workflowId}:comments
    4. For each gap index (0..gaps.length-1):
       KV SMEMBERS gap:{workflowId}:{i}:comments -> commentIds[]
       For each: KV DEL comment:{commentId}
       KV DEL gap:{workflowId}:{i}:comments
```

**Optimization:** To avoid needing to know the gap count during deletion, add one more index:

```
NEW KEY:
  workflow:{id}:gap-comment-keys -> Redis Set of "gap:{workflowId}:{gapIndex}:comments" key names
```

This way, deletion iterates the set of gap-comment keys rather than guessing gap indices. Add to this set when a gap comment is first created for a given gap index.

### 2.5 Comments UI Components

```
src/components/
  comments/
    comment-thread.tsx        # List of comments with author, timestamp, content
    comment-input.tsx         # Text area + author name + submit
    comment-badge.tsx         # Small count badge ("3 notes") for gap cards
    resolve-button.tsx        # Toggle "resolved" state on gap comments
```

**Integration into existing components:**

| Existing Component | What Changes |
|-------------------|-------------|
| `src/app/xray/[id]/page.tsx` | Add "Notes" tab alongside flow/gaps/health. Load workflow-level comments. |
| `src/components/gap-card.tsx` | Add comment badge showing count. Add expandable comment thread below suggestion. |
| `src/components/gap-analysis.tsx` | Pass comment counts to each GapCard |

**Share view integration:** Comments are visible in the share view (read-only). Share viewers can see comments but NOT add, edit, or resolve them. This turns shared links into annotated reports.

### 2.6 Comments in Share View

The `/api/share/[token]` endpoint should include comments in its response. Modify the share endpoint to also fetch workflow-level and gap-level comments:

```
GET /api/share/[token]
  ... existing logic ...
  9. Fetch workflow comments: SMEMBERS workflow:{workflowId}:comments
  10. Fetch gap comments for each gap
  11. Return { workflow, comments: { workflow: Comment[], gaps: Record<number, Comment[]> } }
```

This allows the share view to render comments as part of the read-only analysis without additional API calls.

---

## 3. Cross-Workflow AI Analysis Architecture

### 3.1 Design Decision: Server-Side Aggregation + Claude Analysis

Cross-workflow pattern detection fundamentally differs from existing single-workflow analysis:

- **Single workflow:** User submits text -> Claude analyzes -> structured output
- **Cross-workflow:** System gathers data from all workflows -> aggregates patterns -> Claude synthesizes insights

This requires server-side aggregation because:
1. The analysis needs ALL workflows (already loaded by listWorkflows())
2. Claude needs a curated summary (not raw workflow JSON dumped into context)
3. Results should be cached (same library state = same patterns)

### 3.2 Cross-Workflow Analysis Types

Three analysis endpoints, each solving a distinct problem:

| Analysis | Input | Output | Value |
|----------|-------|--------|-------|
| **Pattern Detection** | All workflows | Recurring patterns, systemic issues, cross-cutting concerns | "Your org has a consistent handoff problem between design and engineering" |
| **Implementation Roadmap** | Selected workflow + all gaps | Phased plan with dependencies, effort, owner assignments | "Here is a 90-day plan to remediate your top workflow" |
| **Predictive Health Scoring** | All workflows + version history | Risk predictions, trend extrapolations | "Based on version trajectory, fragility will exceed 80 by Q3 without intervention" |

### 3.3 New KV Data Model for Cross-Workflow Analysis

```
NEW KEYS:
  analysis:patterns:{hash}     -> PatternAnalysis JSON (TTL: 24 hours)
  analysis:roadmap:{workflowId}:{hash} -> RoadmapAnalysis JSON (TTL: 7 days)
  analysis:predictions:{hash}  -> PredictionAnalysis JSON (TTL: 24 hours)
```

**Why hash-based cache keys:** The analysis result depends on the current state of the workflow library. If a workflow is added or modified, the hash changes and a fresh analysis is triggered. The hash is computed from a fingerprint of the library state (workflow IDs + updatedAt timestamps).

**Library state hash computation:**

```typescript
function computeLibraryHash(workflows: Workflow[]): string {
  // Sort by ID for deterministic ordering
  const sorted = [...workflows].sort((a, b) => a.id.localeCompare(b.id));
  const fingerprint = sorted.map(w => `${w.id}:${w.updatedAt}`).join('|');
  return createHash('sha256').update(fingerprint).digest('hex').slice(0, 16);
}
```

### 3.4 Pattern Detection Architecture

```
[Dashboard: "Detect Patterns" button]
    |
    v
[POST /api/analysis/patterns]
    |
    v
[Server: aggregate workflow data]
    | - Count gap types across all workflows
    | - Identify owner hotspots (>3 single-dependency gaps)
    | - Find tool overlap patterns
    | - Compute inter-workflow step similarity
    | - Build structured summary (NOT raw JSON)
    v
[Check cache: analysis:patterns:{libraryHash}]
    |
    +-- HIT: return cached PatternAnalysis
    |
    +-- MISS:
        |
        v
    [Send structured summary to Claude]
        | System prompt: "You are an operations analyst..."
        | User prompt: aggregated library summary
        v
    [Claude returns PatternAnalysis]
        |
        v
    [Cache result, return to client]
```

**PatternAnalysis type:**

```typescript
interface PatternAnalysis {
  id: string;
  libraryHash: string;
  patterns: {
    type: 'recurring_gap' | 'owner_bottleneck' | 'tool_fragmentation' |
          'handoff_failure' | 'automation_opportunity' | 'process_duplication';
    title: string;
    description: string;
    severity: 'high' | 'medium' | 'low';
    affectedWorkflows: string[];    // workflow IDs
    recommendation: string;
    estimatedImpact: string;        // "Could reduce fragility by ~15% across 4 workflows"
  }[];
  summary: string;                   // Executive summary paragraph
  createdAt: string;
  modelUsed: string;
  tokenUsage: { inputTokens: number; outputTokens: number };
}
```

**Critical design: curated prompt, not raw data dump.** Do NOT send all workflow JSON to Claude. The existing `org-context.ts` already shows the right pattern: aggregate statistics and summaries, then format them into a prompt section. For pattern detection, build a structured summary:

```
## Library Overview
- 12 workflows analyzed
- 47 total steps, 23 gaps identified
- Average automation: 42%, average fragility: 61%

## Gap Distribution
- Manual Bottleneck: 8 occurrences across 6 workflows (67% affected)
- Single-Person Dependency: 6 occurrences across 5 workflows (42% affected)
- Context Loss: 4 occurrences across 3 workflows (25% affected)

## Owner Hotspots
- "Sarah" appears as single dependency in 4 workflows
- "DevOps Team" has lowest automation scores (avg 22%)

## Tool Landscape
- Notion appears in 8 workflows, always at handoff points
- Slack appears in 6 workflows, always as notification layer

## Workflow Similarities
- "Client Onboarding" and "Partner Onboarding" share 70% step overlap
- "Monthly Reporting" and "Quarterly Review" have identical gap profiles

[... more structured data ...]
```

This curated prompt approach keeps token costs low (5-10K tokens vs 50-100K for raw data) and produces more focused analysis.

### 3.5 Implementation Roadmap Architecture

The existing `RemediationPlan` type (already in types.ts) is close to what an implementation roadmap needs. The key difference: a roadmap synthesizes across a workflow's gaps to create a unified plan, while the existing remediation operates per-gap.

**Recommendation:** Extend the existing `/api/remediation` route rather than creating a new route. The current remediation already sends workflow + gaps to Claude and receives a phased plan. The "roadmap" feature is the same thing with richer context (organizational patterns from cross-workflow analysis injected into the prompt).

```
MODIFY: /api/remediation
  Current: workflow + gaps -> Claude -> RemediationPlan
  Enhanced: workflow + gaps + orgContext + crossWorkflowPatterns -> Claude -> EnhancedRemediationPlan
```

**EnhancedRemediationPlan additions:**

```typescript
// Extend existing RemediationPlan with:
interface EnhancedRemediationPlan extends RemediationPlan {
  crossWorkflowInsights?: {
    sharedPatterns: string[];        // Patterns this workflow shares with others
    relatedWorkflows: string[];      // IDs of workflows with similar issues
    consolidationOpportunities: string[]; // "Fix X here and it helps Y too"
  };
}
```

### 3.6 Predictive Health Scoring Architecture

This feature extracts value from the version chain data that already exists:

```
[Dashboard: "Predict Trends" section]
    |
    v
[POST /api/analysis/predictions]
    |
    v
[Server: aggregate version chain data]
    | - For each version chain: compute health deltas
    | - Identify trending metrics (improving vs degrading)
    | - Calculate rates of change
    | - Build prediction input
    v
[Send to Claude with time-series context]
    |
    v
[PredictionAnalysis result]
```

**PredictionAnalysis type:**

```typescript
interface PredictionAnalysis {
  id: string;
  libraryHash: string;
  predictions: {
    workflowId: string;
    workflowTitle: string;
    metric: 'fragility' | 'complexity' | 'automationPotential' | 'teamLoadBalance';
    currentValue: number;
    predictedValue: number;        // 90-day projection
    trend: 'improving' | 'stable' | 'degrading';
    confidence: 'high' | 'medium' | 'low';
    rationale: string;
    recommendation: string;
  }[];
  libraryWidePredictions: {
    title: string;
    description: string;
    timeframe: string;
    confidence: 'high' | 'medium' | 'low';
  }[];
  createdAt: string;
  modelUsed: string;
  tokenUsage: { inputTokens: number; outputTokens: number };
}
```

**Important constraint:** Predictions are only meaningful for workflows with version chains (2+ versions). Single-version workflows lack trend data. The UI should clearly communicate this.

### 3.7 New API Routes for Cross-Workflow Analysis

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/analysis/patterns` | POST | Detect cross-workflow patterns | YES |
| `/api/analysis/predictions` | POST | Generate predictive health scores | YES |

The remediation roadmap enhancement modifies the existing `/api/remediation` route.

### 3.8 SSE Streaming for Analysis Endpoints

Cross-workflow analysis involves Claude calls that can take 15-30 seconds. Use the same SSE streaming pattern as `/api/decompose`:

```typescript
// /api/analysis/patterns/route.ts
type AnalysisEvent =
  | { type: 'progress'; step: string; message: string }
  | { type: 'complete'; analysis: PatternAnalysis }
  | { type: 'error'; code: string; message: string };
```

This provides real-time progress feedback to the user: "Aggregating workflow data... Analyzing patterns with AI... Processing results..."

---

## 4. Data Model Summary: All New KV Keys

```
EXISTING:
  workflow:{id}                          -> Workflow JSON
  workflow:ids                           -> Redis Set (workflow IDs)
  cache:{hash}                           -> CacheEntry JSON (7d TTL)

NEW -- SHARING:
  share:{token}                          -> ShareLink JSON (optional TTL)
  workflow:{id}:shares                   -> Redis Set (share tokens)

NEW -- COMMENTS:
  comment:{id}                           -> Comment JSON
  workflow:{id}:comments                 -> Redis Set (comment IDs)
  gap:{workflowId}:{gapIndex}:comments   -> Redis Set (comment IDs)
  workflow:{id}:gap-comment-keys         -> Redis Set (gap comment key names)

NEW -- CROSS-WORKFLOW ANALYSIS:
  analysis:patterns:{hash}               -> PatternAnalysis JSON (24h TTL)
  analysis:roadmap:{workflowId}:{hash}   -> RoadmapAnalysis JSON (7d TTL)
  analysis:predictions:{hash}            -> PredictionAnalysis JSON (24h TTL)
```

**Key count estimate per workflow:** 1 (workflow) + 1 (shares set) + 1 (comments set) + N (gap comment sets, typically 3-7) + N (individual comments) + N (individual shares). For a library of 50 workflows with ~5 comments each and ~2 share links each: ~50 + 50 + 50 + 250 + 250 + 100 = ~750 keys. Well within Vercel KV limits (Hobby: 256MB, Pro: 1GB+).

---

## 5. New Type Definitions

All new types should be added to `src/lib/types.ts` to maintain the single-source-of-truth pattern:

```typescript
// ---- Sharing Types ----

export interface ShareLink {
  token: string;
  workflowId: string;
  createdAt: string;
  expiresAt?: string;
  label?: string;
  accessCount: number;
  lastAccessedAt?: string;
  permissions: 'readonly';
}

// ---- Comment Types ----

export type CommentTarget = 'workflow' | 'gap';

export interface Comment {
  id: string;
  workflowId: string;
  targetType: CommentTarget;
  targetId: string;
  gapIndex?: number;
  author: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  resolved?: boolean;
  resolvedAt?: string;
}

// ---- Cross-Workflow Analysis Types ----

export type PatternType =
  | 'recurring_gap'
  | 'owner_bottleneck'
  | 'tool_fragmentation'
  | 'handoff_failure'
  | 'automation_opportunity'
  | 'process_duplication';

export interface DetectedPattern {
  type: PatternType;
  title: string;
  description: string;
  severity: Severity;
  affectedWorkflows: string[];
  recommendation: string;
  estimatedImpact: string;
}

export interface PatternAnalysis {
  id: string;
  libraryHash: string;
  patterns: DetectedPattern[];
  summary: string;
  createdAt: string;
  modelUsed: string;
  tokenUsage: { inputTokens: number; outputTokens: number };
}

export interface HealthPrediction {
  workflowId: string;
  workflowTitle: string;
  metric: keyof HealthMetrics;
  currentValue: number;
  predictedValue: number;
  trend: 'improving' | 'stable' | 'degrading';
  confidence: ConfidenceLevel;
  rationale: string;
  recommendation: string;
}

export interface PredictionAnalysis {
  id: string;
  libraryHash: string;
  predictions: HealthPrediction[];
  libraryWidePredictions: {
    title: string;
    description: string;
    timeframe: string;
    confidence: ConfidenceLevel;
  }[];
  createdAt: string;
  modelUsed: string;
  tokenUsage: { inputTokens: number; outputTokens: number };
}
```

---

## 6. New Zod Validation Schemas

Add to `src/lib/validation.ts`:

```typescript
// ---- /api/shares ----

export const CreateShareSchema = z.object({
  workflowId: z.string().min(1),
  label: z.string().max(200).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export const DeleteShareSchema = z.object({
  token: z.string().min(1),
});

// ---- /api/comments ----

export const CreateCommentSchema = z.object({
  workflowId: z.string().min(1),
  targetType: z.enum(['workflow', 'gap']),
  gapIndex: z.number().int().min(0).optional(),
  author: z.string().min(1).max(100),
  content: z.string().min(1).max(2000),
});

export const UpdateCommentSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1).max(2000).optional(),
  resolved: z.boolean().optional(),
});

// ---- /api/analysis/* ----

export const PatternAnalysisSchema = z.object({
  forceRefresh: z.boolean().optional(),
});

export const PredictionAnalysisSchema = z.object({
  forceRefresh: z.boolean().optional(),
});
```

---

## 7. Storage Layer Modifications

### 7.1 New db Functions

The existing `db.ts` needs new functions for shares, comments, and analysis caching. Rather than bloating `db.ts`, create focused modules:

```
src/lib/
  db.ts                  # EXISTING: workflow CRUD (no changes to existing functions)
  db-shares.ts           # NEW: share link CRUD
  db-comments.ts         # NEW: comment CRUD
  db-analysis.ts         # NEW: cross-workflow analysis cache
  analysis-cache.ts      # EXISTING: single-workflow analysis cache (no changes)
```

Each new module follows the same `getKv()` pattern established in `db.ts` and `analysis-cache.ts`:

```typescript
// db-shares.ts pattern
async function getKv() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { kv } = await import("@vercel/kv");
    return kv;
  }
  return null;
}
```

**Why separate files instead of extending db.ts:** The existing db.ts is 255 lines, cleanly scoped to workflow CRUD. Adding share, comment, and analysis operations would triple its size and mix concerns. Separate files maintain the existing pattern where each file owns one domain.

### 7.2 Workflow Deletion Cascade

The existing `deleteWorkflow` in `db.ts` must now cascade to shares and comments. Two approaches:

**Option A: Modify deleteWorkflow directly** -- Add share/comment cleanup inside db.ts.
**Option B: Create a higher-level delete function** -- New function that orchestrates deletion across modules.

**Recommendation: Option B.** Create `deleteWorkflowCascade()` in a new `db-cascade.ts` that calls `deleteWorkflow()`, `deleteSharesForWorkflow()`, and `deleteCommentsForWorkflow()`. The API route calls the cascade function instead of the raw delete. This keeps db.ts unchanged and makes the cascade logic testable in isolation.

```typescript
// src/lib/db-cascade.ts
import { deleteWorkflow, getWorkflow } from './db';
import { deleteSharesForWorkflow } from './db-shares';
import { deleteCommentsForWorkflow } from './db-comments';

export async function deleteWorkflowCascade(id: string): Promise<boolean> {
  const workflow = await getWorkflow(id);
  if (!workflow) return false;

  const gapCount = workflow.decomposition.gaps.length;

  // Cascade deletes (order does not matter, all independent)
  await Promise.all([
    deleteSharesForWorkflow(id),
    deleteCommentsForWorkflow(id, gapCount),
    deleteWorkflow(id),
  ]);

  return true;
}
```

---

## 8. Component Architecture

### 8.1 New Components

```
src/components/
  sharing/
    share-dialog.tsx          # Modal to create/manage share links
    share-link-list.tsx       # List of active share links with copy/revoke
    share-badge.tsx           # Small indicator on workflow card showing share count
  comments/
    comment-thread.tsx        # Threaded comment list
    comment-input.tsx         # Author name + text area + submit
    comment-badge.tsx         # Count badge for gap cards ("3 notes")
    resolve-toggle.tsx        # Mark gap comment as resolved
  analysis/
    pattern-analysis.tsx      # Display detected cross-workflow patterns
    pattern-card.tsx          # Individual pattern with severity, affected workflows
    prediction-card.tsx       # Health prediction with trend indicator
    prediction-dashboard.tsx  # Collection of prediction cards
```

### 8.2 Modified Components

| Component | What Changes | Why |
|-----------|-------------|-----|
| `xray/[id]/page.tsx` | Add "Share" button, "Notes" tab, load comments | Entry point for sharing and commenting on a workflow |
| `gap-card.tsx` | Add comment badge, expandable comment thread | Gap-level commenting |
| `gap-analysis.tsx` | Pass comment data to GapCards | Data flow for gap comments |
| `workflow-card.tsx` | Show share badge if workflow has active shares | Library view awareness |
| `workflow-library.tsx` | Show share count in card metadata | Library view awareness |
| `dashboard/page.tsx` | Add "Cross-Workflow Intelligence" section | Entry point for AI analysis |

### 8.3 New Pages

| Page | Purpose |
|------|---------|
| `src/app/share/[token]/page.tsx` | Read-only shared workflow view |
| `src/app/share/[token]/loading.tsx` | Loading state for share page |

---

## 9. Data Flow Diagrams

### 9.1 Share Link Creation Flow

```
[Owner on /xray/{id}]
    |
    | Clicks "Share" button
    v
[ShareDialog opens]
    |
    | Sets label, optional expiry
    | Clicks "Create Link"
    v
[POST /api/shares]
    |
    | Generates token, stores in KV
    v
[Returns URL: /share/{token}]
    |
    | Owner copies link, sends to client
    v
[Client opens /share/{token}]
    |
    | GET /api/share/{token}
    | No auth cookie needed
    v
[Share view renders read-only X-Ray]
```

### 9.2 Comment Creation Flow

```
[Owner on /xray/{id}, "Notes" tab]
    |
    | Types comment, enters author name
    | Clicks "Add Note"
    v
[POST /api/comments]
    | Body: { workflowId, targetType: 'workflow', author, content }
    v
[KV: SET comment:{id}, SADD workflow:{id}:comments]
    |
    v
[Comment appears in thread]

[Owner on /xray/{id}, gap card expanded]
    |
    | Types comment on specific gap
    v
[POST /api/comments]
    | Body: { workflowId, targetType: 'gap', gapIndex: 2, author, content }
    v
[KV: SET comment:{id}, SADD gap:{workflowId}:2:comments]
```

### 9.3 Cross-Workflow Pattern Detection Flow

```
[Owner on /dashboard, clicks "Detect Patterns"]
    |
    v
[POST /api/analysis/patterns]
    |
    v
[SSE Stream begins]
    |
    | Event: { type: 'progress', message: 'Loading workflow library...' }
    v
[Server: listWorkflows() -> all workflows]
    |
    | Event: { type: 'progress', message: 'Aggregating patterns...' }
    v
[Server: compute aggregates]
    | - Gap distribution across workflows
    | - Owner hotspots
    | - Tool patterns
    | - Workflow similarity scores
    v
[Compute library hash, check cache]
    |
    +-- HIT: Event: { type: 'complete', analysis }
    |
    +-- MISS:
        |
        | Event: { type: 'progress', message: 'AI analysis in progress...' }
        v
    [Build curated prompt from aggregates]
        |
        v
    [callClaude(prompt)]
        |
        v
    [Parse + validate response]
        |
        v
    [Cache result: KV SET analysis:patterns:{hash} (24h TTL)]
        |
        v
    [Event: { type: 'complete', analysis }]
```

---

## 10. Build Order and Dependencies

The three feature areas have strict dependencies that determine build order:

```
Phase 1: MIDDLEWARE + AUTH FOUNDATION
  |
  | middleware.ts (auth boundaries)
  | This is prerequisite for everything -- share routes need
  | explicit "no auth" and other routes need explicit "auth required"
  |
  v
Phase 2: SHAREABLE LINKS
  |
  | New: db-shares.ts, /api/shares, /api/share/[token],
  |      /share/[token] page, ShareDialog component
  | Modify: types.ts (ShareLink), validation.ts (schemas),
  |         workflows/route.ts DELETE (cascade)
  |
  | Must be before comments because share view needs to
  | render comments (so comments come after shares)
  |
  v
Phase 3: COMMENTS/NOTES
  |
  | New: db-comments.ts, /api/comments, comment components
  | Modify: types.ts (Comment), validation.ts (schemas),
  |         xray/[id]/page.tsx (Notes tab), gap-card.tsx (badges),
  |         /api/share/[token] (include comments in response),
  |         db-cascade.ts (comment cleanup on delete)
  |
  v
Phase 4: CROSS-WORKFLOW AI ANALYSIS
  |
  | New: db-analysis.ts, /api/analysis/*, analysis components,
  |      prompt files for pattern detection and prediction
  | Modify: types.ts (analysis types), dashboard/page.tsx (new section),
  |         /api/remediation (enhanced with cross-workflow context)
  |
  | Depends on: existing workflow library, existing Claude integration,
  |             and the org-context.ts pattern for prompt building
```

### Phase Ordering Rationale

1. **Middleware first** because the current app has NO auth enforcement on API routes. Adding new public routes (share) alongside authenticated routes requires a clear boundary. Every subsequent phase assumes middleware exists.

2. **Shares before comments** because the share view page needs to display comments. If comments are built first, we would need to retrofit them into the share view later. Building shares first creates the page structure, then comments fill it.

3. **Comments before AI analysis** because comments are purely a data/UI feature (no Claude calls, no complex aggregation). They provide immediate collaboration value and are lower risk. AI analysis is higher complexity and benefits from having the collaboration foundation in place.

4. **AI analysis last** because it depends on the richest possible library state (workflows + comments + share usage data could all inform pattern detection). It also requires new Claude prompts that need careful engineering and testing.

---

## 11. Anti-Patterns to Avoid

### Anti-Pattern 1: Embedding Comments Inside Workflow JSON

**What people do:** Add a `comments: Comment[]` array directly to the Workflow type and store everything in one KV entry.

**Why it is wrong:** The Workflow JSON is already 5-15 KB. Comments grow unboundedly. More critically, every time a comment is added, the entire Workflow must be read, modified, and written back -- creating race conditions when two people comment simultaneously. KV does not support atomic partial updates on JSON values.

**Do this instead:** Store comments as separate KV entries with Set-based indexes. Adding a comment is an atomic SADD + SET, not a read-modify-write cycle.

### Anti-Pattern 2: Using Workflow ID as Share Token

**What people do:** Use the workflow ID directly in the share URL: `/share/{workflowId}`.

**Why it is wrong:** Workflow IDs are UUIDs generated by `crypto.randomUUID()`. If someone guesses or enumerates IDs, they bypass the auth gate. The share token must be a separate, purpose-generated credential that can be revoked without affecting the workflow.

**Do this instead:** Generate a separate share token per share link. Multiple share links can point to the same workflow with different expiry dates and labels.

### Anti-Pattern 3: Sending All Workflow JSON to Claude for Pattern Detection

**What people do:** Concatenate all workflow JSON into Claude's context and ask "what patterns do you see?"

**Why it is wrong:** 50 workflows at 10 KB each = 500 KB of JSON = ~125K tokens. Claude Sonnet has a 200K context window, but at this volume, costs are enormous (~$0.40 per analysis) and response quality degrades with noise. Most of the JSON is irrelevant to pattern detection (step descriptions, tool lists, etc.).

**Do this instead:** Pre-aggregate statistics server-side (gap distributions, owner hotspots, metric trends) and send a curated 2-3K token summary to Claude. This matches the existing `org-context.ts` pattern. Cost drops to ~$0.01 per analysis.

### Anti-Pattern 4: Building a Full User Account System

**What people do:** See "collaboration" and immediately build registration, email verification, user profiles, role-based access control.

**Why it is wrong:** The app serves small consulting teams sharing one password. A full account system is 10x the complexity for features they do not need. The comment author field (free-text name) provides "who said what" without any infrastructure.

**Do this instead:** Keep the single-password auth. Comments have a free-text author name (persisted in localStorage). Share links are the collaboration mechanism for external stakeholders. If user accounts become necessary later, the comment and share data models already support it (swap `author: string` for `authorId: string`).

### Anti-Pattern 5: Real-Time Comments via WebSocket

**What people do:** Build a real-time comment system with WebSocket connections, typing indicators, and live updates.

**Why it is wrong:** This is a workflow analysis tool, not a chat app. Comments are asynchronous notes (think Google Docs comments, not Slack). Real-time adds massive infrastructure complexity (WebSocket server, connection management, Vercel Function limits) for a feature that does not match the use case.

**Do this instead:** Comments load when the page loads and refresh on a 30-second polling interval or when the user manually refreshes. Simple, reliable, zero infrastructure.

---

## 12. Complete File Impact Matrix

### New Files (22 files)

| File | Feature | Phase |
|------|---------|-------|
| `middleware.ts` | Auth boundaries | 1 |
| `src/lib/db-shares.ts` | Share link storage | 2 |
| `src/lib/db-cascade.ts` | Cascading delete orchestration | 2 |
| `src/app/api/shares/route.ts` | Share CRUD API | 2 |
| `src/app/api/share/[token]/route.ts` | Public share access API | 2 |
| `src/app/share/[token]/page.tsx` | Share view page | 2 |
| `src/app/share/[token]/loading.tsx` | Share view loading state | 2 |
| `src/components/sharing/share-dialog.tsx` | Share link creation modal | 2 |
| `src/components/sharing/share-link-list.tsx` | Manage active share links | 2 |
| `src/components/sharing/share-badge.tsx` | Share indicator on cards | 2 |
| `src/lib/db-comments.ts` | Comment storage | 3 |
| `src/app/api/comments/route.ts` | Comment CRUD API | 3 |
| `src/components/comments/comment-thread.tsx` | Comment display | 3 |
| `src/components/comments/comment-input.tsx` | Comment creation | 3 |
| `src/components/comments/comment-badge.tsx` | Comment count badges | 3 |
| `src/components/comments/resolve-toggle.tsx` | Resolve gap comments | 3 |
| `src/lib/db-analysis.ts` | Cross-workflow analysis cache | 4 |
| `src/app/api/analysis/patterns/route.ts` | Pattern detection API | 4 |
| `src/app/api/analysis/predictions/route.ts` | Predictive scoring API | 4 |
| `src/components/analysis/pattern-card.tsx` | Pattern display card | 4 |
| `src/components/analysis/pattern-analysis.tsx` | Pattern analysis view | 4 |
| `src/components/analysis/prediction-dashboard.tsx` | Prediction display | 4 |

### Modified Files (10 files)

| File | What Changes | Phase |
|------|-------------|-------|
| `src/lib/types.ts` | Add ShareLink, Comment, PatternAnalysis, PredictionAnalysis types | 2-4 |
| `src/lib/validation.ts` | Add share, comment, analysis Zod schemas | 2-4 |
| `src/app/api/workflows/route.ts` | DELETE handler uses cascade delete | 2 |
| `src/app/xray/[id]/page.tsx` | Add Share button, Notes tab | 2-3 |
| `src/components/gap-card.tsx` | Add comment badge, expandable comment thread | 3 |
| `src/components/gap-analysis.tsx` | Pass comment data to GapCards | 3 |
| `src/components/workflow-card.tsx` | Show share badge | 2 |
| `src/components/workflow-library.tsx` | Show share count | 2 |
| `src/app/dashboard/page.tsx` | Add Cross-Workflow Intelligence section | 4 |
| `src/app/api/remediation/route.ts` | Inject cross-workflow context into prompt | 4 |

### Untouched Core Files

These critical files require NO changes:

- `src/lib/db.ts` -- Workflow CRUD stays as-is
- `src/lib/claude.ts` -- Claude integration stays as-is
- `src/lib/decompose.ts` -- Decompose pipeline stays as-is
- `src/lib/scoring.ts` -- Health scoring stays as-is
- `src/lib/analysis-cache.ts` -- Single-workflow cache stays as-is
- `src/lib/store.ts` -- Zustand store stays as-is (new state goes in component local state)
- `src/lib/auth.ts` -- Auth utilities stay as-is (middleware imports them)
- All PDF export files
- All other 11 existing API routes (except workflows DELETE and remediation)

---

## 13. Zustand Store Decisions

**Should new state go in the global Zustand store?**

The current store holds: `inputMode`, `isDecomposing`, `error`, `progressMessage`, `selectedNodeId`, `activeTab`, `workflows`. These are all cross-component UI state.

**Comment state:** NO. Comments are loaded per-workflow-page. Use local state in `xray/[id]/page.tsx` and pass via props. No component outside the X-Ray view needs comment data.

**Share state:** NO. Share links are managed in a modal dialog. Local state in the dialog component suffices.

**Analysis state:** MAYBE. If the dashboard's pattern analysis should persist while navigating to a specific workflow and back, it needs persistent state. But `useMemo` + the existing `workflows` array in the store already handles this. The analysis results themselves are cached in KV. Client-side, a simple `useState` in the dashboard with a loading flag is sufficient.

**Recommendation:** Do NOT expand the Zustand store. All new feature state lives in component-local `useState`/`useEffect` hooks, consistent with the existing pattern where the dashboard manages its own data loading.

---

## 14. Edge Cases and Failure Modes

### Share Links
- **Workflow deleted while share link active:** `/api/share/[token]` returns 404 with message "This workflow has been removed."
- **Share link expired:** Return 410 Gone with message "This share link has expired."
- **KV unavailable:** Share view returns 503 with retry message.
- **Token collision:** Cryptographically impossible with UUID v4 (2^122 space).

### Comments
- **Comment on deleted workflow:** POST /api/comments validates workflow exists before saving.
- **Gap index out of bounds:** POST /api/comments validates gapIndex < gaps.length.
- **Concurrent comments:** No conflict -- each comment is a separate KV entry with SADD to the index set (both atomic).
- **Empty author name:** Zod validation rejects (min length 1).

### Cross-Workflow Analysis
- **Empty library (0 workflows):** Return early with "Add workflows to enable pattern detection."
- **Single workflow:** Pattern detection has limited value. Return with note that cross-workflow patterns require 3+ workflows.
- **Claude failure during analysis:** SSE stream sends error event. Cached results not affected.
- **Stale cache after workflow added:** Library hash changes, cache miss triggers fresh analysis.

---

## Sources

- Full codebase audit: All `src/lib/*.ts` files (27 files), all `src/app/api/*/route.ts` files (13 routes), all `src/components/*.tsx` files (30 components), all page files (7 pages)
- v1.1 Architecture Research (`.planning/research/ARCHITECTURE.md`, dated 2026-02-18) -- prior milestone architecture
- Redis data modeling patterns: Sets for indexes, separate keys for entities (established pattern from training data, HIGH confidence)
- Vercel KV documentation: Redis-compatible API, SADD/SREM/SMEMBERS support confirmed by codebase usage in db.ts
- Next.js 16 middleware: Established pattern from training data, confirmed by Next.js config matcher syntax (HIGH confidence)
- Token-based sharing: UUID v4 tokens as URL credentials (standard pattern, HIGH confidence)
- Existing codebase patterns: SSE streaming in decompose route, KV access in analysis-cache.ts, Zod validation in validation.ts

---
*Architecture research for: Workflow X-Ray v1.2 Collaboration & Deeper AI Intelligence*
*Researched: 2026-02-18*
