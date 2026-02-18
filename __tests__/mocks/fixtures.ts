import type {
  Step,
  Gap,
  Workflow,
  Decomposition,
  HealthMetrics,
  Layer,
  GapType,
  Severity,
} from "@/lib/types";

// ─── Helper factories ───

export function makeStep(overrides: Partial<Step> = {}): Step {
  return {
    id: "step_1",
    name: "Default Step",
    description: "A default step for testing",
    owner: "Engineer",
    layer: "human" as Layer,
    inputs: ["input_1"],
    outputs: ["output_1"],
    tools: ["tool_1"],
    automationScore: 50,
    dependencies: [],
    ...overrides,
  };
}

export function makeGap(overrides: Partial<Gap> = {}): Gap {
  return {
    type: "manual_overhead" as GapType,
    severity: "medium" as Severity,
    stepIds: ["step_1"],
    description: "A default gap for testing",
    suggestion: "Fix the gap",
    ...overrides,
  };
}

export function makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  const defaultHealth: HealthMetrics = {
    complexity: 50,
    fragility: 40,
    automationPotential: 60,
    teamLoadBalance: 70,
  };

  const defaultDecomposition: Decomposition = {
    id: "decomp_1",
    title: "Test Workflow Decomposition",
    steps: [makeStep()],
    gaps: [makeGap()],
    health: defaultHealth,
  };

  return {
    id: "wf_1",
    description: "A test workflow",
    decomposition: defaultDecomposition,
    createdAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-01-15T10:00:00Z",
    ...overrides,
  };
}

// ─── Static mock data ───

export const MOCK_STEPS: Step[] = [
  makeStep({
    id: "step_1",
    name: "Receive Request",
    description: "Intake customer request via email",
    owner: "Support",
    layer: "human",
    inputs: ["customer_email"],
    outputs: ["ticket_id"],
    tools: ["Zendesk"],
    automationScore: 20, // low automation => lowAutoSteps detection
    dependencies: [],
  }),
  makeStep({
    id: "step_2",
    name: "Triage & Classify",
    description: "Classify the request type and priority",
    owner: "Support",
    layer: "cell",
    inputs: ["ticket_id"],
    outputs: ["classification"],
    tools: ["AI Classifier"],
    automationScore: 85,
    dependencies: ["step_1"],
  }),
  makeStep({
    id: "step_3",
    name: "Route to Team",
    description: "Route classified ticket to the right team",
    owner: "Ops",
    layer: "orchestration",
    inputs: ["classification"],
    outputs: ["assigned_team"],
    tools: ["Slack", "Jira"],
    automationScore: 60,
    dependencies: ["step_2"],
  }),
  makeStep({
    id: "step_4",
    name: "Resolve & Close",
    description: "Resolve the ticket and notify customer",
    owner: "Engineering",
    layer: "integration",
    inputs: ["assigned_team"],
    outputs: ["resolution"],
    tools: ["Jira", "Email"],
    automationScore: 25, // low automation
    dependencies: ["step_3"],
  }),
];

export const MOCK_GAPS: Gap[] = [
  makeGap({
    type: "bottleneck",
    severity: "high",
    stepIds: ["step_1"],
    description: "Manual email intake creates bottleneck during peak hours",
    suggestion: "Implement automated email parsing with AI classification",
  }),
  makeGap({
    type: "single_dependency",
    severity: "high",
    stepIds: ["step_3"],
    description: "Only one person handles routing decisions",
    suggestion: "Create routing rules engine to automate assignment",
  }),
  makeGap({
    type: "manual_overhead",
    severity: "medium",
    stepIds: ["step_4"],
    description: "Resolution requires manual status updates across 3 tools",
    suggestion: "Integrate tools via API for automatic status sync",
  }),
  makeGap({
    type: "bottleneck",
    severity: "low",
    stepIds: ["step_2"],
    description: "Classification backlog during high-volume periods",
    suggestion: "Batch processing for low-priority tickets",
  }),
];

export const MOCK_DECOMPOSE_RESPONSE = {
  title: "Customer Support Ticket Workflow",
  steps: MOCK_STEPS.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    owner: s.owner,
    layer: s.layer,
    inputs: s.inputs,
    outputs: s.outputs,
    tools: s.tools,
    automationScore: s.automationScore,
    dependencies: s.dependencies,
  })),
  gaps: MOCK_GAPS.map((g) => ({
    type: g.type,
    severity: g.severity,
    stepIds: g.stepIds,
    description: g.description,
    suggestion: g.suggestion,
  })),
};

// ─── Workflows spanning multiple weeks for chart-data testing ───

export const MOCK_WORKFLOWS: Workflow[] = [
  makeWorkflow({
    id: "wf_week1_a",
    createdAt: "2026-01-06T10:00:00Z", // Monday, Week 1
    updatedAt: "2026-01-06T10:00:00Z",
    decomposition: {
      id: "d1",
      title: "Workflow Week 1A",
      steps: [makeStep({ id: "s1" })],
      gaps: [],
      health: {
        complexity: 40,
        fragility: 30,
        automationPotential: 70,
        teamLoadBalance: 80,
      },
    },
  }),
  makeWorkflow({
    id: "wf_week1_b",
    createdAt: "2026-01-08T14:00:00Z", // Wednesday, same Week 1
    updatedAt: "2026-01-08T14:00:00Z",
    decomposition: {
      id: "d2",
      title: "Workflow Week 1B",
      steps: [makeStep({ id: "s2" })],
      gaps: [],
      health: {
        complexity: 60,
        fragility: 50,
        automationPotential: 50,
        teamLoadBalance: 60,
      },
    },
  }),
  makeWorkflow({
    id: "wf_week2",
    createdAt: "2026-01-13T09:00:00Z", // Monday, Week 2
    updatedAt: "2026-01-13T09:00:00Z",
    decomposition: {
      id: "d3",
      title: "Workflow Week 2",
      steps: [makeStep({ id: "s3" })],
      gaps: [],
      health: {
        complexity: 80,
        fragility: 20,
        automationPotential: 90,
        teamLoadBalance: 50,
      },
    },
  }),
  makeWorkflow({
    id: "wf_week3",
    createdAt: "2026-01-22T11:00:00Z", // Thursday, Week 3
    updatedAt: "2026-01-22T11:00:00Z",
    decomposition: {
      id: "d4",
      title: "Workflow Week 3",
      steps: [makeStep({ id: "s4" })],
      gaps: [],
      health: {
        complexity: 55,
        fragility: 45,
        automationPotential: 65,
        teamLoadBalance: 75,
      },
    },
  }),
];
