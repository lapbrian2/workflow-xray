import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

// ─── Prompt cache: keyed by prompt filename ───
const promptCache = new Map<string, { text: string; hash: string }>();

const CLAUDE_MODEL = "claude-sonnet-4-20250514";

const LOG_TOKENS = process.env.LOG_TOKEN_USAGE === "true";

// ─── Mock toggle for E2E testing (no real API calls) ───
const MOCK_CLAUDE = process.env.MOCK_CLAUDE === "true";

function getMockDecomposeResponse(): ClaudeResponse {
  const mockResponse = JSON.stringify({
    title: "Mock Workflow Analysis",
    steps: [
      { id: "step_1", name: "Receive Request", description: "Initial request intake", owner: "Operator", layer: "human", inputs: ["request"], outputs: ["ticket"], tools: ["email"], automationScore: 30, dependencies: [] },
      { id: "step_2", name: "Process Data", description: "Transform and validate data", owner: "System", layer: "orchestration", inputs: ["ticket"], outputs: ["processed_data"], tools: ["script"], automationScore: 85, dependencies: ["step_1"] },
      { id: "step_3", name: "Review Output", description: "Human review of processed results", owner: "Manager", layer: "human", inputs: ["processed_data"], outputs: ["approved_output"], tools: ["dashboard"], automationScore: 20, dependencies: ["step_2"] },
    ],
    gaps: [
      { type: "bottleneck", severity: "high", stepIds: ["step_3"], description: "Manager review creates delays", suggestion: "Add auto-approval for low-risk items", confidence: "high" },
      { type: "manual_overhead", severity: "medium", stepIds: ["step_1"], description: "Manual request intake", suggestion: "Implement web form submission", confidence: "inferred" },
    ],
  });
  return {
    text: "```json\n" + mockResponse + "\n```",
    inputTokens: 500,
    outputTokens: 300,
  };
}

function getMockExtractionResponse(): ClaudeResponse {
  const mockResponse = JSON.stringify({
    workflows: [
      {
        id: "wf_1",
        title: "Mock Extracted Workflow",
        description: "A workflow extracted from a mock document for testing purposes.",
        confidence: "high",
        sourceSnippet: "Mock source snippet",
      },
    ],
    totalWorkflowsFound: 1,
    extractionNotes: "Mock extraction completed successfully.",
  });
  return {
    text: "```json\n" + mockResponse + "\n```",
    inputTokens: 200,
    outputTokens: 150,
  };
}

function getMockRemediationResponse(): ClaudeResponse {
  const mockResponse = JSON.stringify({
    title: "Mock Remediation Plan",
    summary: "This is a mock remediation plan for testing purposes.",
    phases: [
      {
        id: "phase_1",
        name: "Quick Wins",
        description: "Immediate improvements",
        timeframe: "Week 1-2",
        tasks: [
          {
            id: "task_1",
            title: "Automate request intake",
            description: "Replace manual email intake with a web form.",
            priority: "high",
            effort: "quick_win",
            owner: null,
            gapIds: [0],
            stepIds: ["step_1"],
            tools: ["Typeform"],
            successMetric: "Zero manual intake emails per week",
            dependencies: [],
          },
        ],
      },
    ],
    projectedImpact: [
      {
        metricName: "Automation Potential",
        currentValue: "45%",
        projectedValue: "70%",
        confidence: "medium",
        assumption: "All quick wins implemented within 2 weeks",
      },
    ],
  });
  return {
    text: "```json\n" + mockResponse + "\n```",
    inputTokens: 300,
    outputTokens: 250,
  };
}

function loadPrompt(filename: string): { text: string; hash: string } {
  const cached = promptCache.get(filename);
  if (cached) return cached;

  const paths = [
    join(process.cwd(), `src/prompts/${filename}`),
    join(process.cwd(), `prompts/${filename}`),
    join(process.cwd(), `.next/server/src/prompts/${filename}`),
  ];

  for (const p of paths) {
    try {
      const text = readFileSync(p, "utf-8");
      // Normalize line endings for deterministic hashing across OS
      const normalized = text.replace(/\r\n/g, "\n").trim();
      const hash = createHash("sha256")
        .update(normalized)
        .digest("hex")
        .slice(0, 12);
      const entry = { text, hash };
      promptCache.set(filename, entry);
      return entry;
    } catch {
      // Try next path
    }
  }

  const msg = `System prompt file "${filename}" not found. CWD: ${process.cwd()}. Searched: ${paths.join(", ")}`;
  console.error(`[loadPrompt] ${msg}`);
  throw new Error(msg);
}

// ─── Decompose prompt (backward-compatible) ───
function getSystemPrompt(): string {
  return loadPrompt("decompose-system.md").text;
}

/** Returns the short hash of the current decompose system prompt. */
export function getPromptVersion(): string {
  return loadPrompt("decompose-system.md").hash;
}

// ─── Remediation prompt ───
function getRemediationPrompt(): string {
  return loadPrompt("remediation-system.md").text;
}

export function getRemediationPromptVersion(): string {
  return loadPrompt("remediation-system.md").hash;
}

// ─── Extraction prompt ───
function getExtractionPrompt(): string {
  return loadPrompt("extract-system.md").text;
}

export function getExtractionPromptVersion(): string {
  return loadPrompt("extract-system.md").hash;
}

// ─── Vision extraction prompt ───
function getVisionExtractionPrompt(): string {
  return loadPrompt("vision-extract-system.md").text;
}

export function getVisionExtractionPromptVersion(): string {
  return loadPrompt("vision-extract-system.md").hash;
}

/** Returns the model identifier being used. */
export function getModelId(): string {
  return CLAUDE_MODEL;
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,
});

export interface ClaudeResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export async function callClaude(userMessage: string): Promise<ClaudeResponse> {
  if (MOCK_CLAUDE) {
    return getMockDecomposeResponse();
  }

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: getSystemPrompt(),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  }, { timeout: 45000 });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;

  if (LOG_TOKENS) {
    console.log(
      `[Claude] model=${CLAUDE_MODEL} prompt=${getPromptVersion()} in=${inputTokens} out=${outputTokens} total=${inputTokens + outputTokens}`
    );
  }

  return {
    text: textBlock.text,
    inputTokens,
    outputTokens,
  };
}

export async function callClaudeExtraction(userMessage: string): Promise<ClaudeResponse> {
  if (MOCK_CLAUDE) {
    return getMockExtractionResponse();
  }

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 6144,
    system: [
      {
        type: "text",
        text: getExtractionPrompt(),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  }, { timeout: 45000 });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;

  if (LOG_TOKENS) {
    console.log(
      `[Claude:Extraction] model=${CLAUDE_MODEL} prompt=${getExtractionPromptVersion()} in=${inputTokens} out=${outputTokens} total=${inputTokens + outputTokens}`
    );
  }

  return {
    text: textBlock.text,
    inputTokens,
    outputTokens,
  };
}

export async function callClaudeRemediation(userMessage: string): Promise<ClaudeResponse> {
  if (MOCK_CLAUDE) {
    return getMockRemediationResponse();
  }

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 6144,
    system: [
      {
        type: "text",
        text: getRemediationPrompt(),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  }, { timeout: 45000 });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;

  if (LOG_TOKENS) {
    console.log(
      `[Claude:Remediation] model=${CLAUDE_MODEL} prompt=${getRemediationPromptVersion()} in=${inputTokens} out=${outputTokens} total=${inputTokens + outputTokens}`
    );
  }

  return {
    text: textBlock.text,
    inputTokens,
    outputTokens,
  };
}

// ─── Error classification for typed catch blocks ───

export function classifyClaudeError(error: unknown): {
  type: "rate_limit" | "timeout" | "connection" | "api_error" | "unknown";
  status: number | null;
  retryable: boolean;
} {
  if (error instanceof Anthropic.RateLimitError) {
    return { type: "rate_limit", status: 429, retryable: false };
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return { type: "timeout", status: null, retryable: false };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return { type: "connection", status: null, retryable: false };
  }
  if (error instanceof Anthropic.APIError) {
    return { type: "api_error", status: (error as InstanceType<typeof Anthropic.APIError>).status ?? null, retryable: false };
  }
  return { type: "unknown", status: null, retryable: false };
}

// ─── Vision extraction (screenshot → workflow) ───

export async function callClaudeVisionExtraction(
  screenshot: string,
  additionalContext?: string
): Promise<ClaudeResponse> {
  // Strip data URL prefix if present (Firecrawl may return data:image/... format)
  const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, "");

  const userContent: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: base64Data,
      },
    },
    {
      type: "text",
      text: additionalContext
        ? `Additional context about this page: ${additionalContext}\n\nAnalyze the screenshot above and extract any workflows visible.`
        : "Analyze the screenshot above and extract any workflows visible.",
    },
  ];

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 6144,
    system: [
      {
        type: "text",
        text: getVisionExtractionPrompt(),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userContent }],
  }, { timeout: 45000 });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;

  if (LOG_TOKENS) {
    console.log(
      `[Claude:VisionExtraction] model=${CLAUDE_MODEL} prompt=${getVisionExtractionPromptVersion()} in=${inputTokens} out=${outputTokens} total=${inputTokens + outputTokens}`
    );
  }

  return {
    text: textBlock.text,
    inputTokens,
    outputTokens,
  };
}
