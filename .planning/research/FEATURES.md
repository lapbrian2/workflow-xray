# Feature Research

**Domain:** AI-powered workflow analysis / operational diagnostics for consulting teams
**Researched:** 2026-02-16
**Confidence:** MEDIUM (domain knowledge from training data; web search unavailable for verification)

## Current State Inventory

Before mapping the feature landscape, here is what the app already has (verified via code review):

| Feature | Status | Implementation |
|---------|--------|----------------|
| Workflow decomposition (AI) | Complete | Claude Sonnet 4, Zod-validated JSON, referential integrity checks |
| Multi-source extraction | Complete | Text, URL, file (PDF/DOCX/XLSX), screenshot (vision), Notion, site crawl (Firecrawl) |
| Visual flow diagrams | Complete | @xyflow/react, custom nodes/edges with layer coloring |
| Gap analysis (7 types) | Complete | bottleneck, context_loss, single_dependency, manual_overhead, missing_feedback, missing_fallback, scope_ambiguity |
| Health metrics (4 scores) | Complete | complexity, fragility, automationPotential, teamLoadBalance |
| Remediation plans | Complete | AI-generated phased plans with projected impact, task tracking |
| Version comparison | Complete | Fuzzy step matching (Levenshtein + Jaccard), gap/health delta |
| PDF export | Complete | Single workflow, batch, compare, remediation exports via jspdf + html2canvas |
| Notion sync | Complete | Import from Notion, export remediation plans to Notion |
| Team dashboard | Complete | Aggregated health scores, team workload, tool usage, gap stats, layer distribution, volume chart |
| Workflow library | Complete | CRUD, search, version timeline |
| Password auth | Complete | SHA-256 hashed cookie-based auth, timing-safe comparison |
| Rate limiting | Complete | In-memory per-IP, per-route limits |
| Cost context input | Complete | Hourly rate, hours/step, team size, team context text |
| Org memory context | Complete | Cross-workflow pattern injection into Claude prompts |
| Error boundaries | Complete | Component-level error handling |
| Token tracking | Complete | Input/output token counts per analysis |

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist for a production-quality consulting tool. Missing these = the tool feels unfinished or unreliable for professional use.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Input validation with clear feedback** | Consulting users paste messy content; unclear errors = distrust | LOW | Currently has length limits and JSON parse error handling, but error messages could be more actionable. The decompose route returns generic messages for some failure modes. Harden all API error paths. |
| **Team-size-aware analysis calibration** | A 1-person workflow and a 50-person workflow need fundamentally different gap analysis. Suggesting "delegate" to a solo operator is a credibility killer. | MEDIUM | Team size/context fields exist in CostContext and are injected into the prompt, but the scoring algorithm (scoring.ts) does NOT use team size -- it only uses raw step/gap counts. The health computation should weight differently based on team context (e.g., teamLoadBalance is meaningless for solo operators). |
| **Graceful degradation on AI failures** | Claude will sometimes return malformed JSON, hallucinate step IDs, or timeout. Users need retry with context, not blank errors. | MEDIUM | Some retry logic exists (progressive loading messages, timeout handling). Missing: automatic retry with temperature adjustment, partial result display ("we got 8 of 12 steps, here is what we have"), stale-while-revalidate pattern for re-analysis. |
| **Test coverage** | Zero tests = zero confidence for a consulting-grade tool. Any regression breaks client trust. | HIGH | No test files exist anywhere in the project. Need unit tests for scoring.ts, decompose.ts, compare logic, extraction schemas. Need integration tests for API routes. Need E2E smoke tests for core user flows. |
| **Consistent error handling across all API routes** | Some routes have rich error handling (decompose), others have bare try/catch. Inconsistency = unpredictable UX. | MEDIUM | Each route implements its own error handling pattern. Need a shared error handler middleware or utility. Standardize error response shape: `{ error: string, code: string, retryable: boolean }`. |
| **Loading states for all async operations** | Users click "Generate Remediation Plan" and see nothing for 15 seconds. Every AI call needs a loading state. | LOW | Main decompose has excellent progressive loading. Remediation generation, Notion sync, PDF export, and comparison need similar treatment. |
| **Data persistence reliability** | In-memory storage loses data on serverless cold start. A consulting team running analyses for a client engagement cannot lose data. | MEDIUM | Three backends (KV > Blob > Memory). The memory fallback is the default without Vercel config. If someone self-hosts or runs locally, every server restart wipes data. Need: explicit warning when running on memory backend, localStorage-to-server sync robustness, export/import for data portability. |
| **Prompt version tracking and reproducibility** | Consultants need to explain why results changed. "We updated the prompt" is not acceptable without being able to reproduce old results. | LOW | Prompt version hashing exists. Missing: ability to view which prompt version produced a given analysis, ability to pin a prompt version for a project, changelog of prompt changes. |
| **Accessibility basics** | Consulting tools are used in large organizations with accessibility requirements. WCAG violations = deal breaker for enterprise consulting firms. | MEDIUM | Some aria attributes exist (aria-live on loading state). Flow diagram, color-coded layers, and score rings likely have accessibility gaps. Need: keyboard navigation for flow diagram, color-blind-safe palettes (or pattern fills), screen reader labels on all interactive elements. |

### Differentiators (Competitive Advantage)

Features that set Workflow X-Ray apart. Not expected, but create "wow" moments and consulting value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Team-size-adaptive scoring engine** | Health metrics that actually change meaning based on team size. A fragility score of 70 means "concerning" for a 20-person team but "expected and manageable" for a solo operator. No competitor does context-aware health scoring. | MEDIUM | Extend computeHealth() to accept CostContext. Create team-size tiers (solo: 1, small: 2-5, mid: 6-20, large: 21+). Adjust thresholds: solo operators get penalized for complexity but not for load imbalance; large teams get penalized for single dependencies but not for high step count. Add "team fitness" composite score. |
| **Structured confidence indicators per analysis section** | Show users where the AI is confident vs. guessing. "High confidence: 9 of 12 steps clearly described. Low confidence: 3 steps inferred from context." This is consultancy gold -- clients trust analysis that admits its limits. | MEDIUM | Have Claude return confidence per step and per gap. Display confidence badges in the UI. Roll up into an overall analysis confidence score. Flag low-confidence areas for human review. |
| **Batch comparison across engagement** | Compare a client's workflow at intake vs. after remediation across ALL their workflows simultaneously. Dashboard-level before/after showing "this engagement reduced total fragility by 34%." | HIGH | The compare endpoint works for single workflow pairs. Need aggregate comparison: select a set of workflows, compare their collective health to a previous point in time. Requires snapshot/baseline concept. |
| **Time-series health tracking** | Show how a workflow's health changes across versions over time. Consulting engagements need progress charts: "fragility went from 75 to 32 over 3 months." | MEDIUM | Version timeline exists but only shows version list. Add sparkline health trends per metric across versions. Add a "progress report" view aggregating version-over-version improvements. |
| **AI analysis caching and deduplication** | Same workflow description should not cost another API call. Cache by content hash. Save 40-60% on API costs for iterative workflows. | LOW | No caching exists. Hash the (description + prompt version) and check for existing results before calling Claude. Add cache hit/miss indicator. Reduces cost and latency. |
| **Export as consulting deliverable** | PDF export exists but consulting teams need branded, polished reports with executive summary, methodology section, and appendix. The current PDF is a data dump. | HIGH | Current PDF uses html2canvas (screenshot-based). For consulting-grade reports, need structured PDF generation with proper typography, company logo placement, executive summary page, methodology boilerplate, and findings-by-severity ordering. Consider a templating approach. |
| **Role-based analysis perspectives** | Same workflow viewed from an executive perspective (ROI, risk, timeline) vs. operator perspective (daily tasks, tool changes, training needs). Consultants present to different audiences. | HIGH | Would require multiple prompt variants or post-processing filters. Executive view: suppress step-level detail, emphasize aggregate metrics and cost impact. Operator view: suppress ROI, emphasize step changes and tool instructions. |
| **Industry/domain templates** | Pre-loaded workflow templates for common consulting verticals: "SaaS onboarding," "Manufacturing QC," "Marketing campaign," "HR hiring pipeline." Accelerates first-time usage. | LOW | Workflow library exists. Need curated template entries with realistic descriptions and expected outputs. Templates reduce blank-page paralysis and demonstrate the tool's capabilities. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this specific product and audience.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time collaborative editing** | "We want our team to edit workflows together like Google Docs" | Workflow analysis is an asynchronous, deliberate process -- not a real-time collaboration task. Adding real-time sync (WebSocket, CRDT) would 5x the infrastructure complexity for a feature consultants use alone while preparing client deliverables. | Use the existing version system. Consultant A creates v1, Consultant B re-analyzes to create v2. The comparison view shows what changed. This is how consulting actually works. |
| **Custom AI model selection** | "Let users pick GPT-4, Claude, Gemini, etc." | Multi-model support means validating structured output across different APIs with different capabilities, different failure modes, and different JSON adherence rates. The prompt engineering is model-specific. Supporting 3 models triples the maintenance burden. | Stick with Claude Sonnet. It is the best at structured JSON output for this use case. If model switching is ever needed, make it an admin-level config, not a per-analysis choice. |
| **Workflow execution/automation engine** | "Let users actually run the workflow from the tool" | Workflow X-Ray is a diagnostic tool, not an orchestration platform. Building execution would require integration with every tool users mention (Slack, JIRA, Salesforce, etc.). This is a different product entirely. | Stay diagnostic. Link to tools like Zapier, Make, or n8n in remediation suggestions. The value is in the analysis, not the execution. |
| **Granular per-user permissions and roles** | "We need admin, editor, viewer roles" | The current user base is small consulting teams (2-10 people). Role-based access control adds significant complexity to every feature for minimal value. The shared-password auth is appropriate for this scale. | Keep shared password for now. If the product grows to multi-tenant (multiple consulting firms), then add proper auth with roles. Do not prematurely build for enterprise scale. |
| **Plugin/extension system** | "Let users write custom gap types or scoring algorithms" | Plugin systems are maintenance nightmares. Every API change breaks plugins. The surface area for bugs multiplies. For a focused diagnostic tool, this is over-engineering. | Instead, make the prompt customizable. A prompt editor that lets power users modify the system prompt gives 80% of the value with 5% of the complexity. Consider this as a v2+ feature. |
| **Mobile-native app** | "We need iOS and Android apps" | Flow diagrams and detailed analysis tables are unusable on phone screens. The primary use case is desktop-based analytical work. Mobile development doubles the codebase. | Ensure the web app is responsive enough for tablet use (iPad in client meetings). Full mobile is unnecessary. |
| **Unlimited free tier / freemium model** | "Give users unlimited free analyses to grow the user base" | Each analysis costs ~$0.02-0.10 in Claude API fees. Unlimited free usage without rate limiting enables abuse and unpredictable costs. Consulting tools are B2B -- users expect to pay. | Keep rate limiting. Consider a generous trial (5 free analyses) then require API key or subscription. Free tier with limits is fine; unlimited free is not. |

## Feature Dependencies

```
[Test coverage]
    |-- foundational, no dependencies but enables everything else
    |
[Input validation hardening]
    |-- no dependencies
    |
[Consistent error handling]
    |-- no dependencies, but should be done before other API changes
    |
[Team-size-aware scoring]
    |-- requires: team size input (ALREADY EXISTS in CostContext)
    |-- enhances: health metrics display, gap analysis, remediation plans
    |
[Graceful AI failure handling]
    |-- requires: consistent error handling
    |-- enhances: all AI-powered features
    |
[AI analysis caching]
    |-- requires: consistent error handling (cache miss = API call = needs good error handling)
    |
[Loading states for all operations]
    |-- no dependencies, independent UX work
    |
[Confidence indicators]
    |-- requires: prompt changes, schema changes (Step/Gap need confidence field)
    |-- enhances: flow diagram, gap analysis, remediation plans
    |
[Data persistence reliability]
    |-- no dependencies, infrastructure concern
    |
[Accessibility basics]
    |-- no dependencies, can be done incrementally
    |
[Time-series health tracking]
    |-- requires: version comparison (ALREADY EXISTS)
    |-- enhances: team dashboard
    |
[Batch engagement comparison]
    |-- requires: version comparison (ALREADY EXISTS), time-series tracking
    |-- enhances: team dashboard, PDF export
    |
[Consulting-grade PDF export]
    |-- requires: all analysis features to be stable (do this last in hardening)
    |-- enhances: existing PDF export
    |
[Industry templates]
    |-- requires: workflow library (ALREADY EXISTS)
    |-- no other dependencies
```

### Dependency Notes

- **Test coverage** is foundational: all other features should be built with tests. This must come first or in parallel with everything else.
- **Consistent error handling** should precede AI failure handling and caching, since those features depend on predictable error flows.
- **Team-size-aware scoring** is the highest-value differentiator that can be built immediately because the input mechanism (CostContext with teamSize) already exists -- only the scoring algorithm needs updating.
- **Confidence indicators** require schema changes that touch the core Decomposition type, so they should be batched with other schema changes to avoid multiple migration cycles.
- **Consulting-grade PDF export** should be the last feature in a hardening milestone because it depends on all analysis features being stable -- you do not want to redesign the PDF every time the data model changes.

## Milestone Recommendation

This research is for a hardening + team-size-awareness milestone on an existing app. The features below are prioritized accordingly -- not as MVP but as a maturity milestone.

### Priority 1: Foundation (do first)

- [ ] **Test coverage** -- Unit tests for scoring.ts, decompose.ts, compare route, extraction-schemas.ts. Integration tests for API routes. At least one E2E smoke test. Without tests, every subsequent change is a gamble.
- [ ] **Consistent error handling** -- Shared error utility across all API routes. Standardized error response format. This unblocks robust AI failure handling.
- [ ] **Input validation hardening** -- Max length enforcement is there but add: whitespace-only rejection, encoding safety (strip control characters), structured input validation for CostContext fields (negative numbers, absurd values like teamSize=99999).

### Priority 2: Core Value (the milestone's main deliverable)

- [ ] **Team-size-aware scoring engine** -- Modify computeHealth() to accept CostContext and adjust scoring thresholds by team tier. This is the milestone's headline feature and directly addresses the research question. Without this, a solo consultant and a 50-person department get identical analysis, which undermines consulting credibility.
- [ ] **Graceful AI failure handling** -- Automatic retry (1x) with slightly modified prompt on JSON parse failure. Partial result display when some steps parse but gaps fail. User-visible retry button with "try different approach" option.
- [ ] **Loading states for all async operations** -- Apply the decompose page's progressive loading pattern to remediation generation, Notion sync, PDF export, and comparison operations.

### Priority 3: Polish (do after core)

- [ ] **AI analysis caching** -- Content-hash-based deduplication. Reduces cost and latency for iterative analysis. Quick win with high ROI.
- [ ] **Accessibility basics** -- Keyboard navigation for flow diagram, aria-labels on score rings and health stats, color-blind-safe palette option. Does not need to be fully WCAG AA but should not have obvious violations.
- [ ] **Prompt version visibility** -- Show which prompt version produced each analysis in the UI. Add prompt changelog. Low effort, high trust signal for consulting users.
- [ ] **Data persistence warnings** -- Detect memory-only backend and show a warning banner. Add localStorage-to-server sync health check. Add data export (JSON download of all workflows).

### Defer to Future Milestone

- [ ] **Confidence indicators per analysis section** -- Requires schema changes and prompt rework. High value but high scope. Do in a dedicated "analysis quality" milestone.
- [ ] **Time-series health tracking** -- Requires version data to accumulate. Better after teams have been using the versioning system.
- [ ] **Batch engagement comparison** -- Requires baseline/snapshot concept. Design this after the team-size scoring is validated.
- [ ] **Consulting-grade PDF export** -- Do after all analysis features are stable. Current PDF works; upgrading it is polish.
- [ ] **Industry templates** -- Low effort, high onboarding value, but not a hardening feature. Add in a growth/onboarding milestone.
- [ ] **Role-based analysis perspectives** -- Significant prompt engineering effort. Future milestone after core analysis is rock-solid.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Test coverage | HIGH | HIGH | P1 |
| Team-size-aware scoring | HIGH | MEDIUM | P1 |
| Consistent error handling | HIGH | LOW | P1 |
| Input validation hardening | MEDIUM | LOW | P1 |
| Graceful AI failure handling | HIGH | MEDIUM | P1 |
| Loading states (all ops) | MEDIUM | LOW | P1 |
| AI analysis caching | MEDIUM | LOW | P2 |
| Accessibility basics | MEDIUM | MEDIUM | P2 |
| Prompt version visibility | LOW | LOW | P2 |
| Data persistence warnings | MEDIUM | LOW | P2 |
| Confidence indicators | HIGH | HIGH | P3 |
| Time-series health tracking | MEDIUM | MEDIUM | P3 |
| Batch engagement comparison | HIGH | HIGH | P3 |
| Consulting-grade PDF export | MEDIUM | HIGH | P3 |
| Industry templates | MEDIUM | LOW | P3 |
| Role-based perspectives | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for this hardening milestone
- P2: Should have, add if time permits within milestone
- P3: Future milestone -- defer

## Competitor Feature Analysis

| Feature | Process Street | Lucidchart | Kissflow | Workflow X-Ray Approach |
|---------|---------------|------------|----------|-------------------------|
| Workflow definition | Manual template builder | Manual diagram drawing | Form-based builder | AI-powered natural language decomposition (unique) |
| Gap analysis | Manual checklists | No built-in analysis | Basic bottleneck reports | AI-identified 7-type gap analysis with severity (unique) |
| Health scoring | No scoring | No scoring | Basic completion metrics | 4-dimensional health scoring (unique); add team-size calibration |
| Team-size awareness | Per-seat licensing, no analysis impact | N/A | Role-based views | Team context input exists; scoring needs to use it (gap to close) |
| Version comparison | Basic version history | Revision history | Audit log | Fuzzy-matched step-level comparison with health delta (unique) |
| Remediation plans | Manual action items | N/A | Workflow suggestions | AI-generated phased remediation with projected impact (unique) |
| PDF export | Basic PDF | Diagram export | Report export | Full diagnostic PDF; needs consulting polish |
| Multi-source intake | Manual only | Diagram import | Form import | URL, file, screenshot, Notion, crawl (strong advantage) |

**Key insight:** Workflow X-Ray's competitive advantage is the AI-powered diagnostic layer -- no mainstream workflow tool does automated gap analysis, health scoring, or remediation planning. The hardening milestone should strengthen this core advantage rather than expanding into workflow management features that competitors already own.

## Sources

- Direct code review of all source files in the workflow-xray repository (HIGH confidence -- primary source)
- Domain knowledge of workflow analysis tools, BPM software landscape, and consulting tool requirements (MEDIUM confidence -- training data, not verified with 2026 sources)
- Competitor analysis based on training data knowledge of Process Street, Lucidchart, Kissflow, and similar tools (LOW-MEDIUM confidence -- product features may have changed since training cutoff)

**Gaps in research:** Unable to verify current competitor feature sets, market sizing, or recent industry trends due to web search unavailability. Competitor analysis should be validated before making strategic product decisions based on it.

---
*Feature research for: AI-powered workflow analysis / operational diagnostics*
*Researched: 2026-02-16*
