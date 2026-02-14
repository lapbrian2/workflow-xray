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

export interface Gap {
  type: GapType;
  severity: Severity;
  stepIds: string[];
  description: string;
  suggestion: string;
}

export interface HealthMetrics {
  complexity: number; // 0-100
  fragility: number; // 0-100
  automationPotential: number; // 0-100
  teamLoadBalance: number; // 0-100
}

export interface Decomposition {
  id: string;
  title: string;
  steps: Step[];
  gaps: Gap[];
  health: HealthMetrics;
}

export interface Workflow {
  id: string;
  decomposition: Decomposition;
  description: string; // original input text
  createdAt: string;
  updatedAt: string;
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
