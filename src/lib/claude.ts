import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";

let systemPrompt: string | null = null;

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
      return systemPrompt;
    } catch {
      // Try next path
    }
  }

  throw new Error(
    `System prompt file not found. Searched: ${paths.join(", ")}. Check that deployment includes src/prompts/.`
  );
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
