import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

let systemPrompt: string | null = null;
let systemPromptHash: string | null = null;

const CLAUDE_MODEL = "claude-sonnet-4-20250514";

function getSystemPrompt(): string {
  if (systemPrompt) return systemPrompt;

  const paths = [
    join(process.cwd(), "src/prompts/decompose-system.md"),
    join(process.cwd(), "prompts/decompose-system.md"),
    join(process.cwd(), ".next/server/src/prompts/decompose-system.md"),
  ];

  for (const p of paths) {
    try {
      systemPrompt = readFileSync(p, "utf-8");
      systemPromptHash = createHash("sha256")
        .update(systemPrompt)
        .digest("hex")
        .slice(0, 12);
      return systemPrompt;
    } catch {
      // Try next path
    }
  }

  throw new Error(
    `System prompt file not found. Searched: ${paths.join(", ")}. Check that deployment includes src/prompts/.`
  );
}

/** Returns the short hash of the current system prompt. */
export function getPromptVersion(): string {
  getSystemPrompt(); // ensure loaded
  return systemPromptHash || "unknown";
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
    system: getSystemPrompt(),
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
