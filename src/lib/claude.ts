import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

// ─── Prompt cache: keyed by prompt filename ───
const promptCache = new Map<string, { text: string; hash: string }>();

const CLAUDE_MODEL = "claude-sonnet-4-20250514";

const LOG_TOKENS = process.env.LOG_TOKEN_USAGE === "true";

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
