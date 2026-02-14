import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

// ─── Prompt cache: keyed by prompt filename ───
const promptCache = new Map<string, { text: string; hash: string }>();

const CLAUDE_MODEL = "claude-sonnet-4-20250514";

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

  throw new Error(
    `System prompt file "${filename}" not found. Searched: ${paths.join(", ")}. Check that deployment includes src/prompts/.`
  );
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

/** Returns the model identifier being used. */
export function getModelId(): string {
  return CLAUDE_MODEL;
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
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
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;

  // Log token usage for cost monitoring
  console.log(
    `[Claude] model=${CLAUDE_MODEL} prompt=${getPromptVersion()} in=${inputTokens} out=${outputTokens} total=${inputTokens + outputTokens}`
  );

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
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;

  console.log(
    `[Claude:Remediation] model=${CLAUDE_MODEL} prompt=${getRemediationPromptVersion()} in=${inputTokens} out=${outputTokens} total=${inputTokens + outputTokens}`
  );

  return {
    text: textBlock.text,
    inputTokens,
    outputTokens,
  };
}
