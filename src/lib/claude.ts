import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";

let systemPrompt: string | null = null;

function getSystemPrompt(): string {
  if (systemPrompt) return systemPrompt;
  try {
    systemPrompt = readFileSync(
      join(process.cwd(), "src/prompts/decompose-system.md"),
      "utf-8"
    );
  } catch {
    // Fallback for production builds where file paths differ
    systemPrompt = readFileSync(
      join(process.cwd(), "prompts/decompose-system.md"),
      "utf-8"
    );
  }
  return systemPrompt;
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function callClaude(userMessage: string): Promise<string> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: getSystemPrompt(),
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }
  return textBlock.text;
}
