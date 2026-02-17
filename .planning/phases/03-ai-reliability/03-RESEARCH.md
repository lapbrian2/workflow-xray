# Phase 3: AI Reliability - Research

**Researched:** 2026-02-17
**Domain:** API retry/resilience, partial JSON recovery, streaming progress UX
**Confidence:** HIGH

## Summary

This phase makes Claude API interactions resilient across three axes: automatic retry with backoff (AIRE-01), graceful degradation on malformed output (AIRE-02), and meaningful progress feedback during long-running AI analysis (AIRE-03).

The key discovery is that the Anthropic TypeScript SDK (`@anthropic-ai/sdk@^0.74.0`) already has **built-in retry with exponential backoff** -- it retries connection errors, 408, 409, 429, and >=500 errors **2 times by default**. The current codebase does NOT leverage this; it uses the default `maxRetries: 2` but catches and re-throws errors at the route level in ways that mask the SDK's retry behavior. The main work for AIRE-01 is: (a) increase `maxRetries` to 3-4 on the Anthropic client, (b) classify SDK error types properly in catch blocks so retried-and-still-failing errors produce correct user-facing messages, and (c) ensure the existing 45-second per-request timeout is compatible with retry math.

For AIRE-02, the codebase already has a strong partial recovery pattern in `extraction-schemas.ts` (`recoverPartialExtraction` function). The decompose route (`decompose.ts`) does NOT use this pattern -- it throws hard errors on both `JSON.parse` failure and Zod validation failure. The fix is to apply the same recovery approach: attempt JSON extraction with multiple regex strategies, then validate with Zod `safeParse`, then fall back to manual field extraction for whatever is salvageable.

For AIRE-03, the home page already has elapsed-time-based loading messages (good start), but they are purely time-based guesses, not reflecting actual progress. The decompose route is a single synchronous `callClaude()` call with no intermediate events. Converting to SSE streaming (like `crawl-site` already does) would enable real server-driven progress. However, since decompose is a single Claude call (not a multi-step pipeline), the progress messages should be driven by a simulated step progression on the client side, enhanced with better copy and potentially converting the decompose endpoint to SSE so we can send at least "started"/"parsing"/"validating"/"complete" events.

**Primary recommendation:** Increase SDK maxRetries to 3, add partial JSON recovery to decompose.ts using the existing extraction-schemas pattern, and convert the decompose endpoint to SSE with 4-5 server-sent progress stages.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | ^0.74.0 | Claude API calls with built-in retry | Already installed; has native exponential backoff, typed errors |
| zod | ^4.3.6 | Schema validation with safeParse for graceful degradation | Already installed; safeParse returns Result instead of throwing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | SDK retry is sufficient; no external retry library needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SDK built-in retry | p-retry / async-retry | Adds dependency for functionality the SDK already provides. Only use if we need retry around non-SDK operations |
| Time-based client progress | SSE streaming progress | SSE is more accurate but adds complexity. Worth it for decompose since it takes 10-30s |
| Manual JSON recovery | jsonrepair npm package | External dep for edge case; hand-rolled regex + safeParse is simpler and already proven in the codebase |

**Installation:**
```bash
# No new packages needed -- all tools are already in the project
```

## Architecture Patterns

### Current Codebase Architecture (What We're Modifying)

```
src/
  lib/
    claude.ts            # Anthropic client + callClaude/callClaudeRemediation/callClaudeExtraction
    decompose.ts         # decomposeWorkflow() -- JSON parse, Zod validate, post-process
    extraction-schemas.ts # parseExtractionJson() + recoverPartialExtraction() -- REUSE THIS
    api-errors.ts        # AppError class, error response builders
    api-handler.ts       # withApiHandler HOF -- catches AppError/ZodError
    store.ts             # Zustand store with isDecomposing/error state
  app/
    api/decompose/route.ts  # POST handler -- calls decomposeWorkflow, catches errors
    api/crawl-site/route.ts # SSE streaming pipeline -- existing pattern to follow
    page.tsx                # Home page with time-based loading messages
  components/
    workflow-input.tsx      # Client submit logic with fetchWithTimeout
```

### Pattern 1: SDK-Level Retry Configuration
**What:** Configure the Anthropic client with appropriate maxRetries and timeout
**When to use:** All Claude API calls automatically benefit
**Example:**
```typescript
// Source: @anthropic-ai/sdk client.d.ts (installed package) + npm docs
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,      // Up from default 2; covers transient 429/5xx
  timeout: 45_000,    // Per-attempt timeout (total worst case = ~3min with backoff)
});
```

### Pattern 2: Typed Error Classification in Catch Blocks
**What:** Use SDK error types to produce specific user-facing messages
**When to use:** Every catch block around Claude calls
**Example:**
```typescript
// Source: @anthropic-ai/sdk core/error.d.ts (installed package)
import Anthropic from "@anthropic-ai/sdk";

try {
  result = await callClaude(prompt);
} catch (error) {
  if (error instanceof Anthropic.RateLimitError) {
    // SDK already retried 3 times -- this is exhausted
    throw new AppError("RATE_LIMITED", "AI service is busy. Please try again in a moment.", 429);
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    throw new AppError("AI_ERROR", "Request timed out after multiple retries. Try a shorter description.", 504);
  }
  if (error instanceof Anthropic.APIConnectionError) {
    throw new AppError("AI_ERROR", "Could not reach AI service. Check your connection and try again.", 503);
  }
  if (error instanceof Anthropic.APIError) {
    // Catch-all for other API errors (400, 401, 403, etc.)
    throw new AppError("AI_ERROR", "AI service error. Please try again.", error.status ?? 502);
  }
  // Unknown error
  throw new AppError("AI_ERROR", "Decomposition failed unexpectedly. Please try again.", 502);
}
```

### Pattern 3: Partial JSON Recovery (Extend Existing Pattern)
**What:** Apply the extraction-schemas.ts recovery pattern to decompose output
**When to use:** When Claude returns malformed/incomplete JSON for decomposition
**Example:**
```typescript
// Source: existing pattern in src/lib/extraction-schemas.ts
// Apply same strategy to decompose.ts:

// Step 1: Try multiple JSON extraction strategies
function extractJson(raw: string): unknown {
  // Strategy 1: Code fence extraction
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]); } catch { /* next */ }
  }
  // Strategy 2: Direct parse
  try { return JSON.parse(raw); } catch { /* next */ }
  // Strategy 3: Find largest JSON object
  const objMatch = raw.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch { /* next */ }
  }
  return null;
}

// Step 2: Zod safeParse + manual recovery
const parsed = extractJson(jsonStr);
if (!parsed) {
  // Total failure -- return minimal result with error context
  return buildMinimalDecomposition(request, "Could not parse AI response");
}

const zodResult = DecompositionResponseSchema.safeParse(parsed);
if (zodResult.success) {
  validated = zodResult.data;
} else {
  // Partial recovery: extract what we can
  validated = recoverPartialDecomposition(parsed);
}
```

### Pattern 4: SSE Progress for Decompose Endpoint
**What:** Convert decompose from single JSON response to SSE stream with progress events
**When to use:** The decompose endpoint (10-30 second operations)
**Example:**
```typescript
// Source: existing pattern in src/app/api/crawl-site/route.ts
// Mirror the SSE approach for decompose:

const stream = new ReadableStream({
  async start(controller) {
    const send = (event: object) => {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    };

    send({ type: "progress", step: "started", message: "Decomposing workflow..." });

    // Build org context
    send({ type: "progress", step: "context", message: "Loading organizational context..." });
    const orgCtx = await buildOrgContext(request.description);

    // Call Claude
    send({ type: "progress", step: "analyzing", message: "Analyzing with Claude..." });
    const response = await callClaude(prompt);

    // Parse & validate
    send({ type: "progress", step: "parsing", message: "Processing results..." });
    const validated = parseAndValidate(response.text);

    // Final result
    send({ type: "complete", workflow: result });
    controller.close();
  }
});
```

### Anti-Patterns to Avoid
- **Wrapping SDK retry in another retry layer:** The SDK already retries 429/5xx with exponential backoff. Adding p-retry around it would cause retry-of-retry cascading delays.
- **Throwing hard on Zod validation failure:** Use `safeParse()` + recovery, never `parse()` + catch for Claude output. Claude's output is inherently non-deterministic.
- **Showing raw error messages to users:** The codebase already maps errors to user-friendly messages in decompose/route.ts. Maintain this pattern.
- **Blocking the response until Claude finishes:** For long operations, stream progress events so the user sees something happening.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exponential backoff retry | Custom retry loop with setTimeout | Anthropic SDK `maxRetries` config | SDK handles jitter, backoff math, Retry-After header parsing, and error classification |
| JSON extraction from markdown | Custom parser | `parseExtractionJson()` from extraction-schemas.ts | Already handles code fences, embedded objects; tested in production |
| Partial data recovery | Custom field-by-field extractor from scratch | Extend `recoverPartialExtraction()` pattern | Pattern proven in extraction flow; adapt for decomposition schema |
| SSE streaming | WebSocket or polling | ReadableStream + text/event-stream (existing crawl-site pattern) | Already implemented and working in crawl-site route |

**Key insight:** Every piece of infrastructure needed for this phase already exists in the codebase or the installed SDK. The work is wiring it up correctly, not building new primitives.

## Common Pitfalls

### Pitfall 1: Retry Timeout Math Overflow
**What goes wrong:** With maxRetries=3 and timeout=45000ms per attempt, worst case is ~3 minutes of waiting (45s + backoff + 45s + backoff + 45s + backoff + 45s). The client-side fetchWithTimeout is 120s (2 min), which would abort before server-side retries complete.
**Why it happens:** Client timeout and server retry config are set independently.
**How to avoid:** Either (a) increase client fetchWithTimeout to 180s for decompose, or (b) set per-request timeout on the SDK call to 30s so worst case is ~2 min, or (c) use SSE streaming so the client connection stays alive.
**Warning signs:** "Request timed out" errors on the client while the server is still retrying in the background.

### Pitfall 2: Double Error Handling
**What goes wrong:** The SDK retries silently, then throws. The catch block in decompose/route.ts does string matching on error messages (e.g., `includes("429")`). After SDK retries are exhausted, the thrown error is a `RateLimitError` class, not a string containing "429".
**Why it happens:** Current error handling was written before considering SDK retry behavior.
**How to avoid:** Use `instanceof` checks against SDK error classes instead of string matching.
**Warning signs:** Error messages showing "Decomposition failed" instead of rate-limit-specific guidance.

### Pitfall 3: Partial Recovery Losing Critical Fields
**What goes wrong:** Recovery produces a decomposition with steps but empty gaps array, or steps with missing IDs, causing downstream rendering to crash.
**Why it happens:** Manual recovery skips validation of referential integrity (step IDs, dependency refs, gap stepIds).
**How to avoid:** Always run the existing referential integrity checks (dedup step IDs, filter invalid deps, filter invalid gap stepIds) even on recovered data. The code in decompose.ts lines 129-207 already does this -- ensure recovered data passes through the same pipeline.
**Warning signs:** Blank flow diagram, "Cannot read property of undefined" in xray-viz component.

### Pitfall 4: SSE Connection Dropping on Vercel
**What goes wrong:** Vercel's default function timeout (10s on Hobby, 60s on Pro) kills the SSE stream before Claude responds.
**Why it happens:** The project already uses `maxDuration = 300` on crawl-site but would need it on decompose too.
**How to avoid:** Add `export const maxDuration = 120;` to the decompose route if converting to SSE.
**Warning signs:** SSE stream closes prematurely with no error event.

### Pitfall 5: Client Not Handling Partial Results in UI
**What goes wrong:** Partial decomposition (e.g., steps but no gaps, or title but malformed steps) causes the xray view components to crash because they assume complete data.
**Why it happens:** Components don't check for empty/missing arrays.
**How to avoid:** Add a `_partial: boolean` flag to the decomposition result. UI components check this flag and show degraded views (e.g., "Gap analysis unavailable" instead of crash). Also add null checks on `.gaps`, `.steps`, `.health`.
**Warning signs:** White screen on xray/[id] page after partial recovery.

## Code Examples

### Example 1: Updated claude.ts Client Configuration
```typescript
// Source: @anthropic-ai/sdk client.d.ts maxRetries docs
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,
  // timeout stays at default 10min globally; override per-call
});

// Each call function passes per-request timeout:
export async function callClaude(userMessage: string): Promise<ClaudeResponse> {
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: [{ type: "text", text: getSystemPrompt(), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMessage }],
  }, {
    timeout: 45_000,    // 45s per attempt
    maxRetries: 3,      // Override if different from client default
  });
  // ... rest unchanged
}
```

### Example 2: Partial Decomposition Recovery
```typescript
// Source: pattern from src/lib/extraction-schemas.ts recoverPartialExtraction
interface PartialDecomposition {
  title: string;
  steps: Step[];
  gaps: Gap[];
  _partial: boolean;
  _recoveryReason?: string;
}

function recoverPartialDecomposition(raw: unknown): PartialDecomposition {
  const obj = raw as Record<string, unknown>;

  const title = typeof obj.title === "string" ? obj.title : "Untitled Analysis";

  // Recover steps
  const rawSteps = Array.isArray(obj.steps) ? obj.steps : [];
  const steps = rawSteps
    .map((s: unknown, i: number) => {
      if (typeof s !== "object" || !s) return null;
      const step = s as Record<string, unknown>;
      return {
        id: typeof step.id === "string" ? step.id : `step_${i + 1}`,
        name: typeof step.name === "string" ? step.name : `Step ${i + 1}`,
        description: typeof step.description === "string" ? step.description : "",
        owner: typeof step.owner === "string" ? step.owner : null,
        layer: ["cell","orchestration","memory","human","integration"].includes(step.layer as string)
          ? step.layer as string : "human",
        inputs: Array.isArray(step.inputs) ? step.inputs.filter((x: unknown) => typeof x === "string") : [],
        outputs: Array.isArray(step.outputs) ? step.outputs.filter((x: unknown) => typeof x === "string") : [],
        tools: Array.isArray(step.tools) ? step.tools.filter((x: unknown) => typeof x === "string") : [],
        automationScore: typeof step.automationScore === "number"
          ? Math.max(0, Math.min(100, Math.round(step.automationScore))) : 50,
        dependencies: Array.isArray(step.dependencies) ? step.dependencies.filter((x: unknown) => typeof x === "string") : [],
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  // Recover gaps (best effort)
  const rawGaps = Array.isArray(obj.gaps) ? obj.gaps : [];
  const gaps = rawGaps
    .map((g: unknown) => {
      if (typeof g !== "object" || !g) return null;
      const gap = g as Record<string, unknown>;
      const type = typeof gap.type === "string" ? gap.type : "manual_overhead";
      return {
        type,
        severity: ["low","medium","high"].includes(gap.severity as string) ? gap.severity as string : "medium",
        stepIds: Array.isArray(gap.stepIds) ? gap.stepIds.filter((x: unknown) => typeof x === "string") : [],
        description: typeof gap.description === "string" ? gap.description : "",
        suggestion: typeof gap.suggestion === "string" ? gap.suggestion : "",
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null && g.description.length > 0);

  return {
    title,
    steps,
    gaps,
    _partial: true,
    _recoveryReason: steps.length === 0
      ? "No valid steps could be recovered"
      : `Recovered ${steps.length} steps and ${gaps.length} gaps from malformed response`,
  };
}
```

### Example 3: SSE Decompose Endpoint Progress Events
```typescript
// Source: pattern from src/app/api/crawl-site/route.ts SSE implementation
// Event types for the decompose SSE stream:
type DecomposeEvent =
  | { type: "progress"; step: string; message: string }
  | { type: "complete"; workflow: Workflow }
  | { type: "partial"; workflow: Workflow; warning: string }
  | { type: "error"; code: string; message: string };

// Progress stages (server-sent, reflecting actual work):
// 1. { type: "progress", step: "context",   message: "Loading organizational context..." }
// 2. { type: "progress", step: "analyzing",  message: "Decomposing workflow with Claude..." }
// 3. { type: "progress", step: "parsing",    message: "Processing AI response..." }
// 4. { type: "progress", step: "validating", message: "Validating structure and dependencies..." }
// 5. { type: "progress", step: "saving",     message: "Saving workflow..." }
// 6. { type: "complete", workflow: { ... } }
```

### Example 4: Client-Side SSE Consumption (workflow-input.tsx)
```typescript
// Source: standard EventSource / fetch+ReadableStream pattern
const res = await fetch("/api/decompose", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

const reader = res.body!.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });

  // Parse SSE events from buffer
  const lines = buffer.split("\n\n");
  buffer = lines.pop() || "";

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const event = JSON.parse(line.slice(6));

    if (event.type === "progress") {
      setProgressMessage(event.message);  // Update Zustand store
    } else if (event.type === "complete") {
      saveWorkflowLocal(event.workflow);
      router.push(`/xray/${event.workflow.id}`);
    } else if (event.type === "partial") {
      saveWorkflowLocal(event.workflow);
      router.push(`/xray/${event.workflow.id}?partial=true`);
    } else if (event.type === "error") {
      setError(event.message);
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual retry loops with setTimeout | SDK built-in retry with maxRetries config | Anthropic SDK 0.x series | No custom retry code needed; just configure the client |
| Hard throw on JSON parse failure | safeParse + manual recovery | Pattern already in codebase (extraction-schemas.ts) | Partial results instead of full errors |
| Generic spinner | SSE-driven step progress | crawl-site already does this | Users see real progress, not guesses |

**Deprecated/outdated:**
- String-matching on error.message for classification (e.g., `includes("429")`): Use `instanceof` on SDK error classes instead

## Open Questions

1. **Should decompose become SSE or keep JSON response with client-side progress?**
   - What we know: crawl-site already uses SSE successfully; decompose is a single Claude call (simpler pipeline)
   - What's unclear: Whether the overhead of SSE for 4-5 progress events justifies the complexity vs. keeping time-based client messages
   - Recommendation: Convert to SSE. The pattern already exists, and server-driven progress is strictly more accurate. Also solves the client timeout problem (SSE connections stay alive).

2. **How should partial results display in the UI?**
   - What we know: The xray view expects complete Decomposition objects with steps, gaps, and health scores
   - What's unclear: Exact UI treatment -- banner warning? Disabled tabs? Placeholder content?
   - Recommendation: Add `_partial: boolean` flag. Show a yellow warning banner. Display whatever data was recovered. Disable/hide tabs that require missing data (e.g., hide gaps tab if 0 gaps recovered).

3. **Should remediation and extraction routes also get retry improvements?**
   - What we know: They use the same `callClaude*` functions from claude.ts, so SDK-level retry config benefits them automatically. They already have some error handling.
   - What's unclear: Whether their catch blocks also need instanceof-based error classification
   - Recommendation: Yes, update all catch blocks in remediation/route.ts and extract-workflows/route.ts to use SDK error classes. This is low-effort since the pattern is the same.

## Sources

### Primary (HIGH confidence)
- `@anthropic-ai/sdk` installed package (`node_modules/@anthropic-ai/sdk/core/error.d.ts`) -- Error class hierarchy: APIError, RateLimitError, APIConnectionError, APIConnectionTimeoutError, BadRequestError, etc.
- `@anthropic-ai/sdk` installed package (`node_modules/@anthropic-ai/sdk/client.d.ts`) -- ClientOptions: maxRetries (default 2), timeout, per-request overrides
- [Anthropic SDK TypeScript GitHub](https://github.com/anthropics/anthropic-sdk-typescript) -- Retry behavior: auto-retries connection errors, 408, 409, 429, >=500 with exponential backoff
- Codebase: `src/lib/extraction-schemas.ts` -- Existing partial recovery pattern (recoverPartialExtraction, parseExtractionJson)
- Codebase: `src/app/api/crawl-site/route.ts` -- Existing SSE streaming pattern with ReadableStream
- Codebase: `src/lib/claude.ts` -- Current Anthropic client config (no maxRetries override, 45s timeout per call)
- Codebase: `src/lib/decompose.ts` -- Current hard-throw on JSON parse and Zod validation failure

### Secondary (MEDIUM confidence)
- [Anthropic SDK npm page](https://www.npmjs.com/package/@anthropic-ai/sdk) -- Confirmed maxRetries default = 2, built-in exponential backoff
- [How to Fix Claude API 429 Rate Limit Error](https://www.aifreeapi.com/en/posts/claude-api-429-error-fix) -- Token bucket algorithm, Retry-After header behavior
- [Fixing Slow SSE Streaming in Next.js and Vercel (Jan 2026)](https://medium.com/@oyetoketoby80/fixing-slow-sse-server-sent-events-streaming-in-next-js-and-vercel-99f42fbdb996) -- Buffering issues with Next.js SSE

### Tertiary (LOW confidence)
- None -- all findings verified against installed SDK source or existing codebase patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - SDK retry capabilities verified from installed package type definitions
- Architecture: HIGH - All patterns derived from existing codebase (extraction-schemas.ts, crawl-site/route.ts)
- Pitfalls: HIGH - Timeout math verified against actual config values in codebase; SSE pattern proven in crawl-site
- Partial recovery: HIGH - Pattern extracted from working recoverPartialExtraction() in production code

**Research date:** 2026-02-17
**Valid until:** 2026-03-19 (stable domain -- SDK retry API unlikely to change)
