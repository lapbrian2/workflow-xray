"use client";

import { useState } from "react";

const VIEWS = [
  "architecture",
  "gaps",
  "components",
  "api",
  "dataflow",
  "filestructure",
] as const;

type View = (typeof VIEWS)[number];

const VIEW_LABELS: Record<View, string> = {
  architecture: "System Architecture",
  gaps: "Glass-Box Gaps Filled",
  components: "Component Breakdown",
  api: "API Routes",
  dataflow: "Data Flow",
  filestructure: "File Structure",
};

const ARCH_LAYERS = [
  {
    id: "presentation",
    label: "PRESENTATION LAYER",
    color: "#E8553A",
    modules: [
      {
        name: "WorkflowInput",
        desc: "Natural language + structured form input",
      },
      {
        name: "XRayVisualization",
        desc: "Interactive flow map with layered view",
      },
      { name: "GapAnalysis", desc: "Bottleneck + opportunity cards" },
      { name: "HealthCard", desc: "Workflow health scoring dashboard" },
      { name: "WorkflowLibrary", desc: "Saved workflows browser + search" },
      {
        name: "ModeToggle",
        desc: "Guided \u2194 Professional dual-mode switch",
      },
      {
        name: "CompositionCanvas",
        desc: "Drag-and-drop skill assembly",
      },
    ],
  },
  {
    id: "state",
    label: "STATE & ROUTING",
    color: "#2D7DD2",
    modules: [
      {
        name: "Next.js App Router",
        desc: "File-based routing, layouts, loading states",
      },
      {
        name: "React Context / Zustand",
        desc: "Client-side workflow state management",
      },
      {
        name: "SWR / React Query",
        desc: "Server state, caching, revalidation",
      },
    ],
  },
  {
    id: "api",
    label: "API LAYER (Next.js Route Handlers)",
    color: "#8E44AD",
    modules: [
      {
        name: "/api/decompose",
        desc: "Claude API \u2192 workflow decomposition",
      },
      {
        name: "/api/recompose",
        desc: "Validate + simulate edited flows",
      },
      { name: "/api/workflows", desc: "CRUD for saved workflow library" },
      {
        name: "/api/skills",
        desc: "CRUD for extracted reusable cells",
      },
      {
        name: "/api/memory",
        desc: "Context retrieval + interaction logging",
      },
      { name: "/api/compare", desc: "Before/after diff engine" },
      {
        name: "/api/approvals",
        desc: "Human-in-the-loop decision tracking",
      },
      {
        name: "/api/notion-sync",
        desc: "Pull/link Notion pages via MCP",
      },
    ],
  },
  {
    id: "intelligence",
    label: "INTELLIGENCE ENGINE",
    color: "#17A589",
    modules: [
      {
        name: "Decomposition Prompt",
        desc: "System prompt that maps input \u2192 framework layers",
      },
      {
        name: "Schema Enforcer",
        desc: "Structured JSON output from Claude",
      },
      {
        name: "Scoring Engine",
        desc: "Health, fragility, automation opportunity calcs",
      },
      {
        name: "Gap Detector",
        desc: "Pattern matching for common workflow pathologies",
      },
      {
        name: "Context Enricher",
        desc: "Injects memory + past X-Rays into prompt context",
      },
      {
        name: "Skill Extractor",
        desc: "Identifies reusable patterns from completed analyses",
      },
      {
        name: "Pattern Detector",
        desc: "Cross-references new X-Rays against library",
      },
    ],
  },
  {
    id: "data",
    label: "DATA & INTEGRATIONS",
    color: "#616A6B",
    modules: [
      {
        name: "Vercel KV / Postgres",
        desc: "Workflow library persistence",
      },
      { name: "Notion MCP", desc: "Link workflows to existing docs" },
      {
        name: "n8n Webhooks",
        desc: "Trigger automations from X-Ray results",
      },
      {
        name: "Claude API",
        desc: "Anthropic Messages API (sonnet-4)",
      },
    ],
  },
];

const COMPONENTS = [
  {
    group: "Pages",
    color: "#E8553A",
    items: [
      {
        name: "/ (Home)",
        file: "app/page.tsx",
        desc: "Landing \u2014 quick-start input or browse library",
        props: "\u2014",
        children: ["WorkflowInput", "RecentWorkflows"],
      },
      {
        name: "/xray/[id]",
        file: "app/xray/[id]/page.tsx",
        desc: "Full X-Ray results view for a decomposed workflow",
        props: "params.id",
        children: [
          "XRayVisualization",
          "GapAnalysis",
          "HealthCard",
          "TeamView",
        ],
      },
      {
        name: "/library",
        file: "app/library/page.tsx",
        desc: "Browse, search, compare saved workflows",
        props: "\u2014",
        children: ["WorkflowLibrary", "CompareDrawer"],
      },
    ],
  },
  {
    group: "Input Components",
    color: "#2D7DD2",
    items: [
      {
        name: "WorkflowInput",
        file: "components/workflow-input.tsx",
        desc: "Dual-mode input: freeform text area OR structured step-by-step form. Toggle between modes. Supports paste from Notion.",
        props: "onSubmit(workflow), mode",
        children: ["FreeformInput", "StructuredForm", "NotionImport"],
      },
      {
        name: "FreeformInput",
        file: "components/freeform-input.tsx",
        desc: "Large textarea with example prompts, character count, team member @mentions",
        props: "value, onChange, onSubmit",
        children: [],
      },
      {
        name: "StructuredForm",
        file: "components/structured-form.tsx",
        desc: "Step-by-step stage builder \u2014 name, owner, tools used, inputs/outputs per stage",
        props: "stages[], onAdd, onRemove, onSubmit",
        children: ["StageCard"],
      },
    ],
  },
  {
    group: "Visualization Components",
    color: "#17A589",
    items: [
      {
        name: "XRayVisualization",
        file: "components/xray-viz.tsx",
        desc: "Main flow map \u2014 nodes are workflow steps, edges show data flow. Color-coded by framework layer. Click node for detail panel.",
        props: "decomposition, onNodeSelect",
        children: ["FlowNode", "FlowEdge", "DetailPanel", "LayerLegend"],
      },
      {
        name: "FlowNode",
        file: "components/flow-node.tsx",
        desc: "Individual step in the flow. Shows: name, owner, layer type (cell/orchestration/memory/human), automation score badge.",
        props: "step, selected, onClick",
        children: [],
      },
      {
        name: "GapAnalysis",
        file: "components/gap-analysis.tsx",
        desc: "Card grid showing identified gaps: manual bottlenecks, context loss, single-person dependencies, missing automations.",
        props: "gaps[]",
        children: ["GapCard"],
      },
      {
        name: "HealthCard",
        file: "components/health-card.tsx",
        desc: "Summary dashboard \u2014 complexity score, fragility index, automation potential %, team load distribution.",
        props: "metrics",
        children: ["ScoreRing", "MetricBar"],
      },
    ],
  },
  {
    group: "Library Components",
    color: "#8E44AD",
    items: [
      {
        name: "WorkflowLibrary",
        file: "components/workflow-library.tsx",
        desc: "Grid/list of saved workflows with search, filter by team member, sort by health score or date.",
        props: "workflows[], onSelect, onDelete",
        children: ["WorkflowCard", "SearchBar", "FilterChips"],
      },
      {
        name: "CompareDrawer",
        file: "components/compare-drawer.tsx",
        desc: "Side-by-side before/after view when a workflow has been optimized. Diff highlighting on changed steps.",
        props: "before, after, open, onClose",
        children: ["DiffNode"],
      },
      {
        name: "TeamView",
        file: "components/team-view.tsx",
        desc: "Who touches what \u2014 shows each team member\u2019s involvement across workflow steps. Surfaces load imbalances.",
        props: "decomposition, team[]",
        children: ["MemberRow", "LoadBar"],
      },
    ],
  },
];

const API_ROUTES = [
  {
    method: "POST",
    path: "/api/decompose",
    color: "#17A589",
    desc: "Core intelligence endpoint. Sends workflow description to Claude, returns structured decomposition.",
    input: `{
  description: string,      // freeform text
  stages?: Stage[],         // optional structured input
  context?: {
    team: string[],         // team member names
    tools: string[],        // known tools (n8n, Notion, etc.)
    systems: string[]       // S1-S7 references
  }
}`,
    output: `{
  id: string,
  title: string,
  steps: [{
    id: string,
    name: string,
    description: string,
    owner: string | null,
    layer: "cell" | "orchestration" | "memory" | "human" | "integration",
    inputs: string[],
    outputs: string[],
    tools: string[],
    automationScore: 0-100,
    dependencies: string[]    // step IDs
  }],
  gaps: [{
    type: "bottleneck" | "context_loss" | "single_dependency" | "manual_overhead",
    severity: "low" | "medium" | "high",
    stepIds: string[],
    description: string,
    suggestion: string
  }],
  health: {
    complexity: 0-100,
    fragility: 0-100,
    automationPotential: 0-100,
    teamLoadBalance: 0-100
  }
}`,
    notes:
      "Claude system prompt maps to Platform-as-Skill framework layers. Uses structured JSON mode. ~2-4s response time.",
  },
  {
    method: "GET/POST/DELETE",
    path: "/api/workflows",
    color: "#8E44AD",
    desc: "CRUD for the workflow library. GET lists all, POST saves new, DELETE removes.",
    input:
      "GET: ?search=&owner=&sort=\nPOST: { decomposition, metadata }\nDELETE: ?id=",
    output:
      "{ workflows: Workflow[] } | { workflow: Workflow } | { deleted: true }",
    notes:
      "Persisted to Vercel KV or Postgres. Include version history for before/after compare.",
  },
  {
    method: "POST",
    path: "/api/compare",
    color: "#2D7DD2",
    desc: "Diff engine \u2014 takes two workflow versions and returns structured delta.",
    input: `{
  before: Decomposition,
  after: Decomposition
}`,
    output: `{
  added: Step[],
  removed: Step[],
  modified: [{ step, changes }],
  healthDelta: { ... },
  summary: string           // Claude-generated narrative
}`,
    notes:
      "Compares step-by-step, recalculates health metrics, generates natural language summary of improvements.",
  },
  {
    method: "POST",
    path: "/api/notion-sync",
    color: "#D4A017",
    desc: "Links workflow steps to existing Notion pages. Pulls context from your workspace.",
    input:
      '{ workflowId, stepId, notionPageUrl } | { query: "search term" }',
    output:
      "{ linked: true, pageTitle, pageUrl } | { results: NotionPage[] }",
    notes:
      "Uses Notion MCP connection. Enables clicking a workflow step \u2192 opens related Notion doc.",
  },
];

const FILE_STRUCTURE = `workflow-xray/
\u251c\u2500\u2500 app/
\u2502   \u251c\u2500\u2500 layout.tsx              # Root layout \u2014 fonts, providers, nav
\u2502   \u251c\u2500\u2500 page.tsx                # Home \u2014 input + recent workflows
\u2502   \u251c\u2500\u2500 globals.css             # Tailwind + custom properties
\u2502   \u251c\u2500\u2500 xray/
\u2502   \u2502   \u2514\u2500\u2500 [id]/
\u2502   \u2502       \u251c\u2500\u2500 page.tsx        # X-Ray results view
\u2502   \u2502       \u2514\u2500\u2500 loading.tsx     # Skeleton while Claude processes
\u2502   \u251c\u2500\u2500 library/
\u2502   \u2502   \u2514\u2500\u2500 page.tsx            # Saved workflow browser
\u2502   \u2514\u2500\u2500 api/
\u2502       \u251c\u2500\u2500 decompose/
\u2502       \u2502   \u2514\u2500\u2500 route.ts        # POST \u2014 Claude decomposition
\u2502       \u251c\u2500\u2500 workflows/
\u2502       \u2502   \u2514\u2500\u2500 route.ts        # GET/POST/DELETE \u2014 CRUD
\u2502       \u251c\u2500\u2500 compare/
\u2502       \u2502   \u2514\u2500\u2500 route.ts        # POST \u2014 diff engine
\u2502       \u2514\u2500\u2500 notion-sync/
\u2502           \u2514\u2500\u2500 route.ts        # POST \u2014 Notion integration
\u251c\u2500\u2500 components/
\u2502   \u251c\u2500\u2500 workflow-input.tsx       # Dual-mode input
\u2502   \u251c\u2500\u2500 freeform-input.tsx       # Natural language textarea
\u2502   \u251c\u2500\u2500 structured-form.tsx      # Step-by-step builder
\u2502   \u251c\u2500\u2500 stage-card.tsx           # Single stage in form
\u2502   \u251c\u2500\u2500 xray-viz.tsx             # Main flow visualization
\u2502   \u251c\u2500\u2500 flow-node.tsx            # Individual step node
\u2502   \u251c\u2500\u2500 flow-edge.tsx            # Connection between nodes
\u2502   \u251c\u2500\u2500 detail-panel.tsx         # Selected step details
\u2502   \u251c\u2500\u2500 layer-legend.tsx         # Color legend for layers
\u2502   \u251c\u2500\u2500 gap-analysis.tsx         # Gap cards grid
\u2502   \u251c\u2500\u2500 gap-card.tsx             # Individual gap card
\u2502   \u251c\u2500\u2500 health-card.tsx          # Health score dashboard
\u2502   \u251c\u2500\u2500 score-ring.tsx           # Circular progress indicator
\u2502   \u251c\u2500\u2500 metric-bar.tsx           # Horizontal metric bar
\u2502   \u251c\u2500\u2500 workflow-library.tsx     # Library browser
\u2502   \u251c\u2500\u2500 workflow-card.tsx        # Library item card
\u2502   \u251c\u2500\u2500 compare-drawer.tsx       # Before/after drawer
\u2502   \u251c\u2500\u2500 team-view.tsx            # Team load visualization
\u2502   \u2514\u2500\u2500 ui/                      # shadcn/ui primitives
\u2502       \u251c\u2500\u2500 button.tsx
\u2502       \u251c\u2500\u2500 card.tsx
\u2502       \u251c\u2500\u2500 input.tsx
\u2502       \u251c\u2500\u2500 dialog.tsx
\u2502       \u251c\u2500\u2500 tabs.tsx
\u2502       \u2514\u2500\u2500 badge.tsx
\u251c\u2500\u2500 lib/
\u2502   \u251c\u2500\u2500 claude.ts                # Claude API client + system prompt
\u2502   \u251c\u2500\u2500 decompose.ts             # Decomposition logic + schema
\u2502   \u251c\u2500\u2500 scoring.ts               # Health/gap scoring algorithms
\u2502   \u251c\u2500\u2500 db.ts                    # Vercel KV/Postgres client
\u2502   \u251c\u2500\u2500 types.ts                 # TypeScript interfaces
\u2502   \u2514\u2500\u2500 utils.ts                 # Helpers
\u251c\u2500\u2500 prompts/
\u2502   \u2514\u2500\u2500 decompose-system.md      # Claude system prompt (versioned)
\u251c\u2500\u2500 .env.local                   # ANTHROPIC_API_KEY, DB creds
\u251c\u2500\u2500 next.config.js
\u251c\u2500\u2500 tailwind.config.ts
\u251c\u2500\u2500 tsconfig.json
\u2514\u2500\u2500 package.json`;

const GAPS = [
  {
    id: "dual-mode",
    category: "PRODUCT DESIGN",
    color: "#E8553A",
    gap: "Single-mode interface",
    title: "Dual-Mode UX: Guided + Professional",
    before:
      "The X-Ray treats all users the same \u2014 one input, one output, one view. Your team understands the results but a workshop attendee or new client team member would be lost.",
    after:
      "Two distinct interaction modes powered by the same reasoning cells. Guided mode scaffolds novices with task workflows, progressive disclosure, and reflection prompts. Professional mode gives your team raw inspection, parameter tuning, and macro recording.",
    impact: "high" as const,
    components: [
      {
        name: "ModeToggle",
        file: "components/mode-toggle.tsx",
        desc: "Persistent toggle: Guided \u2194 Professional. Remembers per user.",
      },
      {
        name: "GuidedShell",
        file: "components/guided-shell.tsx",
        desc: "Wraps X-Ray results with step-by-step walkthroughs, concept tooltips, and \u2018Why did this happen?\u2019 expandable cards.",
      },
      {
        name: "ReflectionPrompt",
        file: "components/reflection-prompt.tsx",
        desc: "After each X-Ray, prompts: \u2018What bottleneck surprised you most?\u2019 \u2018What would you automate first?\u2019 Builds metacognitive skill.",
      },
      {
        name: "ProInspector",
        file: "components/pro-inspector.tsx",
        desc: "Click any node \u2192 see the exact Claude reasoning chain, prompt used, model selected, confidence score. Edit parameters inline.",
      },
    ],
    apiChanges:
      "Add `mode` param to /api/decompose \u2014 guided mode returns enriched explanations per step; pro mode returns raw cell data + reasoning traces.",
    hocAngle:
      "Guided mode becomes your workshop delivery mechanism. Students X-Ray a workflow live, get scaffolded explanations, answer reflection prompts. Professional mode is for your core team and advanced clients like Christelle.",
  },
  {
    id: "memory",
    category: "INTELLIGENCE",
    color: "#17A589",
    gap: "Stateless decomposition",
    title: "Memory-Bearing Collaborator",
    before:
      "Each X-Ray is independent \u2014 the system forgets everything between sessions. No learning from past analyses, no relationship building, no context accumulation.",
    after:
      "Four memory types turn the X-Ray from a one-shot tool into a collaborator that grows with your team. Episodic memory recalls past analyses. Semantic memory learns your team\u2019s patterns. Procedural memory optimizes recurring workflows.",
    impact: "high" as const,
    components: [
      {
        name: "MemoryPanel",
        file: "components/memory-panel.tsx",
        desc: "Sidebar showing what the system \u2018remembers\u2019 \u2014 past X-Rays, learned patterns, team preferences. Full transparency.",
      },
      {
        name: "ContextEnricher",
        file: "lib/context-enricher.ts",
        desc: "Before Claude processes, injects relevant past X-Rays, known team roles, established tool preferences into the prompt context.",
      },
      {
        name: "PatternDetector",
        file: "lib/pattern-detector.ts",
        desc: "Cross-references new X-Rays against library to surface: \u2018This looks similar to the Christelle onboarding pipeline you analyzed last month.\u2019",
      },
    ],
    apiChanges:
      "New /api/memory endpoint \u2014 GET retrieves relevant context for a workflow, POST saves interaction events. Enrichment layer sits between input and Claude call.",
    hocAngle:
      "The system learns that Brian handles architecture, Laurie handles education design, Israel handles tools. It learns your S1\u2013S7 system names. It starts suggesting connections between client workflows automatically.",
  },
  {
    id: "compounding",
    category: "ECOSYSTEM",
    color: "#8E44AD",
    gap: "Isolated workflow snapshots",
    title: "Compounding Skill Library",
    before:
      "Saved workflows are static records \u2014 useful for reference but they don\u2019t build on each other. No reuse, no composition, no organizational learning curve.",
    after:
      "Every X-Ray produces reusable \u2018cells\u2019 that compose into larger workflows. When an expert builds a new pattern, it becomes a building block for everyone. Recursive nesting means skills contain skills.",
    impact: "high" as const,
    components: [
      {
        name: "SkillExtractor",
        file: "lib/skill-extractor.ts",
        desc: "After X-Ray, identifies reusable patterns and offers to save them as standalone cells: \u2018Save Client Discovery \u2192 Proposal as a reusable template?\u2019",
      },
      {
        name: "CompositionCanvas",
        file: "components/composition-canvas.tsx",
        desc: "Drag-and-drop interface where saved cells compose into new workflows. This is the Skill Builder Studio emerging from inside the X-Ray.",
      },
      {
        name: "SkillCatalog",
        file: "components/skill-catalog.tsx",
        desc: "Browsable library of team-created cells with usage stats, ratings, and origin tracking. Filter by creator, domain, system (S1\u2013S7).",
      },
      {
        name: "NestingView",
        file: "components/nesting-view.tsx",
        desc: "Expand any skill to see its sub-cells. Collapse to treat as single unit. Visual recursion.",
      },
    ],
    apiChanges:
      "New /api/skills endpoint \u2014 CRUD for extracted cells. /api/decompose accepts skill references in input: \u2018Use our standard client onboarding flow for the first three steps.\u2019",
    hocAngle:
      "This is where HoC\u2019s institutional knowledge becomes executable. The Christelle pipeline becomes a reusable skill. Your workshop structure becomes a skill. When you onboard a new team member, they inherit the full skill library.",
  },
  {
    id: "cell-editing",
    category: "CONTROL",
    color: "#2D7DD2",
    gap: "Read-only decomposition",
    title: "No-Code Cell Editing",
    before:
      "The X-Ray shows you what\u2019s happening but you can\u2019t change it. It\u2019s a diagnostic tool, not a design tool. You see the gaps but can\u2019t fix them from within the app.",
    after:
      "Every reasoning cell is editable inline. Adjust parameters, swap models, modify constraints, change routing logic \u2014 all without code. The X-Ray becomes a workbench, not just a microscope.",
    impact: "medium" as const,
    components: [
      {
        name: "CellEditor",
        file: "components/cell-editor.tsx",
        desc: "Slide-out panel when clicking any node. Edit: name, description, model selection (fast/frontier), temperature, constraints, fallback behavior.",
      },
      {
        name: "ModelPicker",
        file: "components/model-picker.tsx",
        desc: "Dropdown with cost/speed/capability indicators. \u2018Use Haiku for extraction, Sonnet for reasoning, Opus for complex analysis.\u2019",
      },
      {
        name: "ConstraintBuilder",
        file: "components/constraint-builder.tsx",
        desc: "Visual rule builder: \u2018IF output contains PII THEN flag for review.\u2019 \u2018IF confidence < 70% THEN escalate to human.\u2019",
      },
      {
        name: "FlowRewirer",
        file: "components/flow-rewirer.tsx",
        desc: "Drag edges between nodes to change routing. Add conditional branches. Insert human-in-the-loop checkpoints.",
      },
    ],
    apiChanges:
      "/api/decompose evolves to /api/decompose + /api/recompose \u2014 the second endpoint takes a modified flow and validates/simulates it before saving.",
    hocAngle:
      "Your team stops being consumers of X-Ray output and starts being designers of optimized workflows. Laurie can adjust the education-specific cells. Israel can tune the tool integration cells. Everyone shapes the intelligence.",
  },
  {
    id: "human-loop",
    category: "SAFETY",
    color: "#D4A017",
    gap: "No escalation paths",
    title: "Human-in-the-Loop Decision Points",
    before:
      "The X-Ray identifies gaps but doesn\u2019t model where human judgment is required vs. where automation is safe. Everything is treated equally.",
    after:
      "Explicit escalation modeling \u2014 the decomposition flags steps that require human approval tokens, configurable by risk tolerance. High-stakes decisions pause the flow.",
    impact: "medium" as const,
    components: [
      {
        name: "EscalationNode",
        file: "components/escalation-node.tsx",
        desc: "Distinct visual node type in the flow \u2014 yellow checkpoint with approval/reject actions. Shows who is responsible.",
      },
      {
        name: "RiskThreshold",
        file: "components/risk-threshold.tsx",
        desc: "Slider per workflow: how aggressive should automation be? Conservative = more human checkpoints. Aggressive = auto-proceed unless critical.",
      },
      {
        name: "ApprovalLog",
        file: "components/approval-log.tsx",
        desc: "Audit trail of every human decision point \u2014 who approved, when, what context they saw. Essential for client-facing work.",
      },
    ],
    apiChanges:
      "Decomposition output adds `escalation_required: boolean` and `risk_level` per step. New /api/approvals endpoint for tracking decisions.",
    hocAngle:
      "For the Christelle engagement: \u2018AI generates product imagery \u2192 human reviews for brand consistency \u2192 approved \u2192 published.\u2019 The approval chain is visible and auditable. This is what makes clients trust the system.",
  },
  {
    id: "evolution",
    category: "SUSTAINABILITY",
    color: "#196F3D",
    gap: "No versioning or safe evolution",
    title: "Modular Swap & Safe Evolution",
    before:
      "If a client\u2019s requirements change or a new tool becomes available, you\u2019d re-run the entire X-Ray from scratch. No incremental updates, no version tracking of how workflows evolve.",
    after:
      "Modular cell replacement \u2014 swap one reasoning cell without touching the rest. Version history shows how workflows evolved over time. Before/after comparison with health score deltas.",
    impact: "medium" as const,
    components: [
      {
        name: "VersionTimeline",
        file: "components/version-timeline.tsx",
        desc: "Horizontal timeline showing each saved version of a workflow. Click any point to see that snapshot. Compare any two versions.",
      },
      {
        name: "CellSwapper",
        file: "components/cell-swapper.tsx",
        desc: "Right-click any cell \u2192 \u2018Replace with...\u2019 Shows compatible alternatives from the skill library. Preview impact before committing.",
      },
      {
        name: "EvolutionDiff",
        file: "components/evolution-diff.tsx",
        desc: "Rich diff view: added steps (green), removed (red), modified (amber). Health score change prominently displayed.",
      },
    ],
    apiChanges:
      "Workflows store version arrays. /api/compare already exists \u2014 extend to support arbitrary version pairs. Add /api/workflows/[id]/versions endpoint.",
    hocAngle:
      "When a new AI model drops, you don\u2019t rebuild \u2014 you swap the relevant cells. When a client\u2019s needs evolve, you fork the workflow and modify. The system\u2019s history becomes a teaching tool: \u2018Here\u2019s how our approach improved over 6 months.\u2019",
  },
];

const EVOLUTION_PATH = [
  {
    phase: "Phase 1 \u2014 Now",
    label: "Internal Diagnostic",
    desc: "What you\u2019re building: X-Ray as read-only decomposition tool for the HoC team. Input workflows, get visual maps, identify gaps.",
    color: "#616A6B",
    features: [
      "Natural language input",
      "Claude decomposition",
      "Flow visualization",
      "Gap analysis",
      "Health scores",
      "Saved library",
    ],
  },
  {
    phase: "Phase 2 \u2014 +4 weeks",
    label: "Glass-Box Workbench",
    desc: "Add the editing and memory layer. X-Ray becomes a design tool where your team shapes workflows, not just diagnoses them.",
    color: "#2D7DD2",
    features: [
      "Dual-mode UX",
      "Cell editing",
      "Memory system",
      "Human-in-the-loop modeling",
      "Version history",
    ],
  },
  {
    phase: "Phase 3 \u2014 +8 weeks",
    label: "Compounding Platform",
    desc: "Skill extraction and composition. Every workflow produces reusable cells. Recursive nesting. The organizational brain emerges.",
    color: "#8E44AD",
    features: [
      "Skill extraction",
      "Composition canvas",
      "Skill catalog",
      "Recursive nesting",
      "Cross-workflow intelligence",
    ],
  },
  {
    phase: "Phase 4 \u2014 +12 weeks",
    label: "Client-Facing Product",
    desc: "Package for external delivery. Guided mode becomes workshop tool. Professional mode becomes client engagement deliverable. HoC\u2019s signature offering.",
    color: "#E8553A",
    features: [
      "Multi-tenant",
      "Client branding",
      "Workshop integration",
      "Exportable reports",
      "Notion/n8n deep links",
    ],
  },
];

// ─── Sub-views ──────────────────────────────────────────

function GapsView() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div>
      <p
        style={{
          fontSize: 15,
          color: "#4A5568",
          fontFamily: "var(--body)",
          lineHeight: 1.7,
          margin: "0 0 8px",
          maxWidth: 620,
        }}
      >
        The &ldquo;Glass-Box Professional Partner&rdquo; blueprint identifies
        six critical gaps that transform the X-Ray from an internal diagnostic
        into a compounding intelligence platform. Here&rsquo;s what each gap
        means for the build &mdash; with components, API changes, and
        HoC-specific application.
      </p>
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        {(["high", "medium"] as const).map((level) => (
          <span
            key={level}
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10.5,
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: 5,
              background: level === "high" ? "#E8553A15" : "#D4A01715",
              color: level === "high" ? "#E8553A" : "#D4A017",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            &#9679; {level} impact
          </span>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {GAPS.map((gap, i) => {
          const isOpen = expanded === gap.id;
          return (
            <div
              key={gap.id}
              style={{
                background: "#fff",
                border: `1px solid ${isOpen ? gap.color + "50" : "#E8ECF1"}`,
                borderRadius: 11,
                overflow: "hidden",
                transition: "border-color 0.25s",
                animation: `slideIn 0.4s ease ${i * 0.06}s both`,
              }}
            >
              <button
                onClick={() => setExpanded(isOpen ? null : gap.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "16px 20px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background:
                      gap.impact === "high" ? "#E8553A" : "#D4A017",
                    marginTop: 7,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 10,
                        fontWeight: 700,
                        color: gap.color,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                      }}
                    >
                      {gap.category}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "#B0B8C4",
                        fontFamily: "var(--mono)",
                      }}
                    >
                      gap: {gap.gap}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#1C2536",
                      fontFamily: "var(--display)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {gap.title}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 16,
                    color: "#B0B8C4",
                    transform: isOpen ? "rotate(90deg)" : "none",
                    transition: "transform 0.2s",
                    marginTop: 4,
                  }}
                >
                  &#8250;
                </span>
              </button>
              {isOpen && (
                <div
                  style={{
                    padding: "0 20px 20px",
                    paddingLeft: 42,
                    animation: "fadeIn 0.25s ease",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        background: "#FDF0EE",
                        borderRadius: 8,
                        padding: "12px 16px",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#C0392B",
                          letterSpacing: "0.08em",
                          marginBottom: 6,
                        }}
                      >
                        BEFORE (GAP)
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "#6B3A35",
                          fontFamily: "var(--body)",
                          lineHeight: 1.55,
                        }}
                      >
                        {gap.before}
                      </div>
                    </div>
                    <div
                      style={{
                        background: "#E9F7EF",
                        borderRadius: 8,
                        padding: "12px 16px",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#196F3D",
                          letterSpacing: "0.08em",
                          marginBottom: 6,
                        }}
                      >
                        AFTER (FILLED)
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "#1E5631",
                          fontFamily: "var(--body)",
                          lineHeight: 1.55,
                        }}
                      >
                        {gap.after}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#8895A7",
                      letterSpacing: "0.08em",
                      marginBottom: 8,
                    }}
                  >
                    NEW COMPONENTS
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      marginBottom: 14,
                    }}
                  >
                    {gap.components.map((c) => (
                      <div
                        key={c.name}
                        style={{
                          display: "flex",
                          gap: 10,
                          padding: "8px 12px",
                          background: "#F7F8FA",
                          borderRadius: 7,
                          borderLeft: `3px solid ${gap.color}30`,
                        }}
                      >
                        <div style={{ minWidth: 160 }}>
                          <div
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#1C2536",
                            }}
                          >
                            {c.name}
                          </div>
                          <div
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: 10.5,
                              color: "#8895A7",
                            }}
                          >
                            {c.file}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 12.5,
                            color: "#5A6577",
                            fontFamily: "var(--body)",
                            lineHeight: 1.5,
                          }}
                        >
                          {c.desc}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      padding: "10px 14px",
                      background: "#1C2536",
                      borderRadius: 7,
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#6B7A8D",
                        letterSpacing: "0.08em",
                        marginBottom: 4,
                      }}
                    >
                      API CHANGES
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: "#C5D0DC",
                        fontFamily: "var(--mono)",
                        lineHeight: 1.55,
                      }}
                    >
                      {gap.apiChanges}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "12px 16px",
                      background: `${gap.color}08`,
                      borderRadius: 7,
                      borderLeft: `3px solid ${gap.color}`,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 10,
                        fontWeight: 700,
                        color: gap.color,
                        letterSpacing: "0.08em",
                        marginBottom: 4,
                      }}
                    >
                      HOC APPLICATION
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#2C3E50",
                        fontFamily: "var(--body)",
                        lineHeight: 1.6,
                        fontStyle: "italic",
                      }}
                    >
                      {gap.hocAngle}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Evolution Path */}
      <div style={{ marginTop: 32 }}>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            fontWeight: 700,
            color: "#1C2536",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          Evolution Path &mdash; From Diagnostic to Product
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
          }}
        >
          {EVOLUTION_PATH.map((phase, i) => (
            <div
              key={phase.phase}
              style={{
                background: "#fff",
                border: `1px solid ${phase.color}30`,
                borderRadius: 10,
                padding: "16px",
                position: "relative",
                overflow: "hidden",
                animation: `slideIn 0.4s ease ${i * 0.1}s both`,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: phase.color,
                }}
              />
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  fontWeight: 700,
                  color: phase.color,
                  letterSpacing: "0.06em",
                  marginBottom: 4,
                }}
              >
                {phase.phase}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#1C2536",
                  fontFamily: "var(--display)",
                  marginBottom: 6,
                }}
              >
                {phase.label}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#5A6577",
                  fontFamily: "var(--body)",
                  lineHeight: 1.5,
                  marginBottom: 10,
                }}
              >
                {phase.desc}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {phase.features.map((f) => (
                  <span
                    key={f}
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--mono)",
                      padding: "2px 7px",
                      borderRadius: 4,
                      background: `${phase.color}10`,
                      color: phase.color,
                      fontWeight: 500,
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ArchLayer({
  layer,
  index,
}: {
  layer: (typeof ARCH_LAYERS)[number];
  index: number;
}) {
  return (
    <div
      style={{
        background: `${layer.color}08`,
        borderLeft: `4px solid ${layer.color}`,
        borderRadius: "0 10px 10px 0",
        padding: "16px 20px",
        animation: `slideIn 0.4s ease ${index * 0.08}s both`,
      }}
    >
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10.5,
          fontWeight: 700,
          color: layer.color,
          letterSpacing: "0.12em",
          marginBottom: 10,
        }}
      >
        {layer.label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {layer.modules.map((m) => (
          <div
            key={m.name}
            style={{
              background: "#fff",
              border: `1px solid ${layer.color}25`,
              borderRadius: 7,
              padding: "8px 12px",
              flex: "1 1 auto",
              minWidth: 180,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#1C2536",
                fontFamily: "var(--mono)",
                marginBottom: 3,
              }}
            >
              {m.name}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#6B7A8D",
                fontFamily: "var(--body)",
                lineHeight: 1.4,
              }}
            >
              {m.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArchView() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p
        style={{
          fontSize: 14.5,
          color: "#4A5568",
          fontFamily: "var(--body)",
          lineHeight: 1.7,
          margin: "0 0 12px",
          maxWidth: 600,
        }}
      >
        Five layers from UI to data, each independently deployable. The
        intelligence engine is isolated behind an API route &mdash; swap Claude
        for any model without touching the frontend.
      </p>
      {ARCH_LAYERS.map((layer, i) => (
        <ArchLayer key={layer.id} layer={layer} index={i} />
      ))}
      <div
        style={{
          marginTop: 16,
          padding: "14px 18px",
          background: "#FDF6E3",
          borderRadius: 8,
          border: "1px solid #D4A01730",
          fontSize: 13,
          color: "#6B5B1B",
          fontFamily: "var(--body)",
          lineHeight: 1.6,
        }}
      >
        <strong
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            letterSpacing: "0.05em",
          }}
        >
          KEY PRINCIPLE:
        </strong>{" "}
        The Claude system prompt in{" "}
        <code
          style={{
            fontSize: 11.5,
            background: "#fff3cd",
            padding: "1px 5px",
            borderRadius: 3,
          }}
        >
          prompts/decompose-system.md
        </code>{" "}
        is the brain &mdash; it maps natural language workflows onto the
        Platform-as-Skill framework layers. Everything else is plumbing and
        visualization.
      </div>
    </div>
  );
}

function ComponentView() {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {COMPONENTS.map((group) => (
        <div key={group.group}>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              fontWeight: 700,
              color: group.color,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            {group.group}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {group.items.map((item) => {
              const isOpen = expanded === item.name;
              return (
                <div
                  key={item.name}
                  style={{
                    background: "#fff",
                    border: `1px solid ${isOpen ? group.color + "40" : "#E8ECF1"}`,
                    borderRadius: 9,
                    overflow: "hidden",
                    transition: "border-color 0.2s",
                  }}
                >
                  <button
                    onClick={() => setExpanded(isOpen ? null : item.name)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "12px 16px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "#1C2536",
                        }}
                      >
                        {item.name}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 11,
                          color: "#8895A7",
                          marginLeft: 10,
                        }}
                      >
                        {item.file}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 14,
                        color: "#8895A7",
                        transform: isOpen ? "rotate(90deg)" : "none",
                        transition: "transform 0.2s",
                      }}
                    >
                      &#8250;
                    </span>
                  </button>
                  {isOpen && (
                    <div
                      style={{
                        padding: "0 16px 14px",
                        animation: "fadeIn 0.2s ease",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          color: "#4A5568",
                          fontFamily: "var(--body)",
                          lineHeight: 1.6,
                          marginBottom: 10,
                        }}
                      >
                        {item.desc}
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 8,
                          fontSize: 12,
                        }}
                      >
                        <div
                          style={{
                            background: "#F7F8FA",
                            borderRadius: 6,
                            padding: "8px 12px",
                          }}
                        >
                          <div
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#8895A7",
                              letterSpacing: "0.08em",
                              marginBottom: 4,
                            }}
                          >
                            PROPS
                          </div>
                          <code
                            style={{
                              fontSize: 11.5,
                              color: "#2C3E50",
                              fontFamily: "var(--mono)",
                            }}
                          >
                            {item.props}
                          </code>
                        </div>
                        <div
                          style={{
                            background: "#F7F8FA",
                            borderRadius: 6,
                            padding: "8px 12px",
                          }}
                        >
                          <div
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#8895A7",
                              letterSpacing: "0.08em",
                              marginBottom: 4,
                            }}
                          >
                            CHILDREN
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 4,
                            }}
                          >
                            {item.children.length ? (
                              item.children.map((c) => (
                                <span
                                  key={c}
                                  style={{
                                    fontSize: 11,
                                    background: `${group.color}12`,
                                    color: group.color,
                                    padding: "2px 8px",
                                    borderRadius: 4,
                                    fontFamily: "var(--mono)",
                                    fontWeight: 500,
                                  }}
                                >
                                  {c}
                                </span>
                              ))
                            ) : (
                              <span
                                style={{
                                  color: "#B0B8C4",
                                  fontFamily: "var(--mono)",
                                  fontSize: 11,
                                }}
                              >
                                leaf component
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ApiView() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {API_ROUTES.map((route) => (
        <div
          key={route.path}
          style={{
            background: "#fff",
            border: "1px solid #E8ECF1",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid #F0F2F5",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10.5,
                fontWeight: 700,
                color: "#fff",
                background: route.color,
                padding: "3px 8px",
                borderRadius: 4,
                letterSpacing: "0.05em",
              }}
            >
              {route.method}
            </span>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 14,
                fontWeight: 600,
                color: "#1C2536",
              }}
            >
              {route.path}
            </span>
          </div>
          <div style={{ padding: "14px 18px" }}>
            <div
              style={{
                fontSize: 13.5,
                color: "#4A5568",
                fontFamily: "var(--body)",
                lineHeight: 1.6,
                marginBottom: 12,
              }}
            >
              {route.desc}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#8895A7",
                    letterSpacing: "0.08em",
                    marginBottom: 6,
                  }}
                >
                  REQUEST
                </div>
                <pre
                  style={{
                    background: "#1C2536",
                    color: "#C5D0DC",
                    borderRadius: 7,
                    padding: "12px 14px",
                    fontSize: 11,
                    fontFamily: "var(--mono)",
                    lineHeight: 1.55,
                    overflow: "auto",
                    margin: 0,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {route.input}
                </pre>
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#8895A7",
                    letterSpacing: "0.08em",
                    marginBottom: 6,
                  }}
                >
                  RESPONSE
                </div>
                <pre
                  style={{
                    background: "#1C2536",
                    color: "#C5D0DC",
                    borderRadius: 7,
                    padding: "12px 14px",
                    fontSize: 11,
                    fontFamily: "var(--mono)",
                    lineHeight: 1.55,
                    overflow: "auto",
                    margin: 0,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {route.output}
                </pre>
              </div>
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#6B7A8D",
                fontFamily: "var(--body)",
                fontStyle: "italic",
                lineHeight: 1.5,
                borderTop: "1px solid #F0F2F5",
                paddingTop: 10,
              }}
            >
              {route.notes}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DataFlowView() {
  const steps = [
    {
      label: "User Input",
      desc: "Natural language or structured stages",
      icon: "\u270E",
      color: "#E8553A",
    },
    {
      label: "API Route",
      desc: "/api/decompose validates + enriches context",
      icon: "\u27E1",
      color: "#2D7DD2",
    },
    {
      label: "Claude API",
      desc: "System prompt maps to framework layers",
      icon: "\u25C8",
      color: "#17A589",
    },
    {
      label: "Schema Parse",
      desc: "Zod validates structured JSON response",
      icon: "\u25A4",
      color: "#8E44AD",
    },
    {
      label: "Scoring",
      desc: "Health, fragility, automation scores computed",
      icon: "\u25C9",
      color: "#D4A017",
    },
    {
      label: "Persist",
      desc: "Save to Vercel KV with version history",
      icon: "\u25A3",
      color: "#616A6B",
    },
    {
      label: "Render",
      desc: "X-Ray visualization + gap cards + health",
      icon: "\u25C7",
      color: "#E8553A",
    },
  ];
  return (
    <div>
      <p
        style={{
          fontSize: 14.5,
          color: "#4A5568",
          fontFamily: "var(--body)",
          lineHeight: 1.7,
          margin: "0 0 24px",
          maxWidth: 560,
        }}
      >
        The critical path from user input to rendered X-Ray. The entire
        intelligence layer is a single API call to Claude with a carefully
        engineered system prompt &mdash; keep this simple.
      </p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          position: "relative",
        }}
      >
        {steps.map((step, i) => (
          <div
            key={step.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              animation: `slideIn 0.4s ease ${i * 0.08}s both`,
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                background: `${step.color}15`,
                border: `2px solid ${step.color}40`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                color: step.color,
                flexShrink: 0,
                position: "relative",
                zIndex: 1,
              }}
            >
              {step.icon}
            </div>
            <div
              style={{
                flex: 1,
                padding: "12px 16px",
                background: `${step.color}06`,
                borderRadius: 8,
                borderLeft: `3px solid ${step.color}`,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#1C2536",
                  marginBottom: 2,
                }}
              >
                {i + 1}. {step.label}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: "#5A6577",
                  fontFamily: "var(--body)",
                }}
              >
                {step.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 24,
          padding: "14px 18px",
          background: "#EDF4FC",
          borderRadius: 8,
          border: "1px solid #2D7DD220",
          fontSize: 13,
          color: "#1A4971",
          fontFamily: "var(--body)",
          lineHeight: 1.6,
        }}
      >
        <strong style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
          STREAMING UX:
        </strong>{" "}
        Use Claude&rsquo;s streaming API to progressively render the X-Ray as
        steps are identified. Show skeleton nodes that fill in as the response
        streams &mdash; this turns a 3-second wait into a satisfying build-up
        animation.
      </div>
    </div>
  );
}

function FileView() {
  return (
    <div>
      <p
        style={{
          fontSize: 14.5,
          color: "#4A5568",
          fontFamily: "var(--body)",
          lineHeight: 1.7,
          margin: "0 0 16px",
          maxWidth: 560,
        }}
      >
        Standard Next.js App Router structure. The{" "}
        <code
          style={{
            fontFamily: "var(--mono)",
            fontSize: 12,
            background: "#F0F2F5",
            padding: "1px 5px",
            borderRadius: 3,
          }}
        >
          prompts/
        </code>{" "}
        directory keeps the Claude system prompt versioned alongside the code
        &mdash; this is your most important file.
      </p>
      <pre
        style={{
          background: "#1C2536",
          color: "#C5D0DC",
          borderRadius: 10,
          padding: "20px 24px",
          fontSize: 12,
          fontFamily: "var(--mono)",
          lineHeight: 1.65,
          overflow: "auto",
          whiteSpace: "pre",
        }}
      >
        {FILE_STRUCTURE}
      </pre>
      <div
        style={{
          marginTop: 16,
          fontSize: 13,
          fontFamily: "var(--body)",
          color: "#4A5568",
          lineHeight: 1.7,
        }}
      >
        <strong
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: "#1C2536",
          }}
        >
          KEY DEPENDENCIES:
        </strong>{" "}
        next, react, @anthropic-ai/sdk, zustand (state), zod (schema
        validation), tailwindcss, reactflow (flow visualization), framer-motion
        (animations), @vercel/kv (persistence)
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────

export default function WorkflowXRayArch() {
  const [activeView, setActiveView] = useState<View>("architecture");

  const renderView = () => {
    switch (activeView) {
      case "architecture":
        return <ArchView />;
      case "gaps":
        return <GapsView />;
      case "components":
        return <ComponentView />;
      case "api":
        return <ApiView />;
      case "dataflow":
        return <DataFlowView />;
      case "filestructure":
        return <FileView />;
      default:
        return <ArchView />;
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F7F8FA",
        // @ts-expect-error CSS custom properties
        "--mono": "'JetBrains Mono', 'Fira Code', monospace",
        "--body": "'Source Serif 4', Georgia, serif",
        "--display": "'Playfair Display', Georgia, serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#1C2536",
          padding: "24px 28px 20px",
        }}
      >
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              color: "#6B7A8D",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Next.js &middot; Claude API &middot; Vercel
          </div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 900,
              color: "#F0F2F5",
              fontFamily: "var(--display)",
              margin: "0 0 4px",
              letterSpacing: "-0.02em",
            }}
          >
            Workflow X-Ray
          </h1>
          <div
            style={{
              fontSize: 13.5,
              color: "#6B7A8D",
              fontFamily: "var(--body)",
              fontStyle: "italic",
            }}
          >
            Architecture &amp; component blueprint &mdash; from internal
            diagnostic to Glass-Box platform
          </div>
        </div>
      </div>
      {/* Tab Nav */}
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid #E8ECF1",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: 880,
            margin: "0 auto",
            display: "flex",
            gap: 2,
            padding: "0 28px",
          }}
        >
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              style={{
                padding: "12px 16px",
                background: "none",
                border: "none",
                borderBottom:
                  activeView === v
                    ? "2px solid #1C2536"
                    : "2px solid transparent",
                cursor: "pointer",
                fontFamily: "var(--mono)",
                fontSize: 11.5,
                fontWeight: activeView === v ? 700 : 500,
                color: activeView === v ? "#1C2536" : "#8895A7",
                letterSpacing: "0.03em",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
      </div>
      {/* Content */}
      <div
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: "28px 28px 60px",
          animation: "fadeIn 0.3s ease",
        }}
      >
        {renderView()}
      </div>
    </div>
  );
}
