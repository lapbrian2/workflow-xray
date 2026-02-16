export type Layer =
  | "cell"
  | "orchestration"
  | "memory"
  | "human"
  | "integration";

export type GapType =
  | "bottleneck"
  | "context_loss"
  | "single_dependency"
  | "manual_overhead"
  | "missing_feedback"
  | "missing_fallback"
  | "scope_ambiguity";

export type Severity = "low" | "medium" | "high";

export interface Step {
  id: string;
  name: string;
  description: string;
  owner: string | null;
  layer: Layer;
  inputs: string[];
  outputs: string[];
  tools: string[];
  automationScore: number; // 0-100
  dependencies: string[]; // step IDs
}

export type ConfidenceLevel = "high" | "inferred";

export interface Gap {
  type: GapType;
  severity: Severity;
  stepIds: string[];
  description: string;
  suggestion: string;
  timeWaste?: string;         // e.g. "~6 hrs/week"
  effortLevel?: "quick_win" | "incremental" | "strategic";  // quick_win=1 week, incremental=1 month, strategic=3+ months
  impactedRoles?: string[];   // e.g. ["IC", "manager"]
  confidence?: ConfidenceLevel; // per-gap confidence indicator
}

export interface HealthMetrics {
  complexity: number; // 0-100
  fragility: number; // 0-100
  automationPotential: number; // 0-100
  teamLoadBalance: number; // 0-100
  teamSize?: number; // team size used for calibration (if provided)
  confidence?: { level: ConfidenceLevel; reason: string }; // whether scores are calibrated or using defaults
}

export interface Decomposition {
  id: string;
  title: string;
  steps: Step[];
  gaps: Gap[];
  health: HealthMetrics;
}

export interface CostContext {
  hourlyRate?: number;     // avg team hourly cost ($)
  hoursPerStep?: number;   // avg hours spent per workflow step
  teamSize?: number;       // number of people executing this workflow
  teamContext?: string;    // free-text team description (e.g. "Solo operator" or "3-person marketing team")
}

export interface ExtractionSource {
  type: "notion" | "url" | "manual" | "crawl" | "file";
  url?: string;           // source URL (Notion page or web page)
  title?: string;         // page title from source
  extractedAt: string;    // ISO timestamp
  // Crawl-specific provenance
  crawlRootUrl?: string;           // root URL that initiated the crawl
  sourceSection?: string;           // section within the page where workflow was found
  totalWorkflowsInDocument?: number; // how many workflows on this particular page
  // File-specific provenance
  fileName?: string;                // original file name
  fileType?: string;                // file extension (.pdf, .docx, .txt, etc.)
  fileSizeBytes?: number;           // original file size
}

export interface ExtractedWorkflow {
  title: string;
  description: string;    // extracted workflow description ready for decompose
  confidence: "high" | "medium" | "low";
  sourceSnippet?: string; // short excerpt showing where it was found
}

export interface Workflow {
  id: string;
  decomposition: Decomposition;
  description: string; // original input text
  createdAt: string;
  updatedAt: string;
  parentId?: string;     // links to the original workflow (for versioning)
  version?: number;      // 1, 2, 3, etc.
  costContext?: CostContext; // optional cost data for ROI estimation
  promptVersion?: string;  // hash of system prompt used for this analysis
  modelUsed?: string;      // Claude model used (e.g. "claude-sonnet-4-20250514")
  tokenUsage?: {           // token counts for cost monitoring
    inputTokens: number;
    outputTokens: number;
  };
  remediationPlan?: RemediationPlan; // attached remediation plan (if generated)
  extractionSource?: ExtractionSource; // how this workflow was sourced
}

export interface StageInput {
  name: string;
  owner: string;
  tools: string;
  inputs: string;
  outputs: string;
}

export interface DecomposeRequest {
  description: string;
  stages?: StageInput[];
  context?: {
    team: string[];
    tools: string[];
  };
}

export interface CompareResult {
  added: Step[];
  removed: Step[];
  modified: { step: Step; beforeStep: Step; changes: string[] }[];
  unchanged: Step[];
  gapsResolved: Gap[];
  gapsNew: Gap[];
  gapsPersistent: Gap[];
  healthDelta: {
    complexity: number;
    fragility: number;
    automationPotential: number;
    teamLoadBalance: number;
  };
  healthBefore: HealthMetrics;
  healthAfter: HealthMetrics;
  summary: string;
}

export const LAYER_COLORS: Record<Layer, string> = {
  cell: "#17A589",
  orchestration: "#2D7DD2",
  memory: "#8E44AD",
  human: "#D4A017",
  integration: "#616A6B",
};

export const LAYER_LABELS: Record<Layer, string> = {
  cell: "Reasoning Cell",
  orchestration: "Orchestration",
  memory: "Memory",
  human: "Human-in-the-Loop",
  integration: "Integration",
};

export const GAP_LABELS: Record<GapType, string> = {
  bottleneck: "Manual Bottleneck",
  context_loss: "Context Loss",
  single_dependency: "Single-Person Dependency",
  manual_overhead: "Manual Overhead",
  missing_feedback: "Missing Feedback",
  missing_fallback: "Missing Fallback",
  scope_ambiguity: "Scope Ambiguity",
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  low: "#17A589",
  medium: "#D4A017",
  high: "#E8553A",
};

// ─── Remediation Plan Types ───

export type TaskPriority = "critical" | "high" | "medium" | "low";
export type TaskStatus = "not_started" | "in_progress" | "completed" | "blocked";
export type TaskEffort = "quick_win" | "incremental" | "strategic";

export interface RemediationTask {
  id: string;                      // task_1, task_2, etc.
  title: string;                   // Short action-oriented name
  description: string;             // What to do, 2-3 sentences
  priority: TaskPriority;
  effort: TaskEffort;              // quick_win = 1 week, incremental = 1 month, strategic = 3+ months
  owner: string | null;            // Suggested assignee role
  gapIds: number[];                // Indices of gaps this task addresses
  stepIds: string[];               // Step IDs this task improves
  tools: string[];                 // Tools/platforms to use
  successMetric: string;           // How to measure completion
  dependencies: string[];          // task IDs this depends on
  status: TaskStatus;
}

export interface RemediationPhase {
  id: string;                      // phase_1, phase_2, etc.
  name: string;                    // "Quick Wins", "Process Improvements", etc.
  description: string;
  timeframe: string;               // "Week 1-2", "Month 1-2", etc.
  tasks: RemediationTask[];
}

export interface ProjectedImpact {
  metricName: string;              // e.g., "Fragility", "Automation %", "Weekly hours saved"
  currentValue: string;
  projectedValue: string;
  confidence: "high" | "medium" | "low";
  assumption: string;              // Basis for projection
}

export interface RemediationPlan {
  id: string;
  workflowId: string;             // Links to the X-Ray workflow
  title: string;                   // "Remediation Plan: {workflow title}"
  summary: string;                 // Executive summary, 3-5 sentences
  phases: RemediationPhase[];
  projectedImpact: ProjectedImpact[];
  teamContext?: {
    teamSize?: number;
    budget?: string;
    timeline?: string;
    constraints?: string[];
  };
  createdAt: string;
  updatedAt: string;
  promptVersion?: string;
  modelUsed?: string;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  critical: "#E8553A",
  high: "#D4A017",
  medium: "#2D7DD2",
  low: "#17A589",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const TASK_EFFORT_LABELS: Record<TaskEffort, string> = {
  quick_win: "Quick Win (1 week)",
  incremental: "Incremental (1 month)",
  strategic: "Strategic (3+ months)",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
  blocked: "Blocked",
};
