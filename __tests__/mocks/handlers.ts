import { http, HttpResponse } from "msw";
import { MOCK_DECOMPOSE_RESPONSE } from "./fixtures";

export const handlers = [
  http.post("https://api.anthropic.com/v1/messages", () => {
    return HttpResponse.json({
      id: "msg_mock_001",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-4-20250514",
      content: [
        {
          type: "text",
          text: "```json\n" + JSON.stringify(MOCK_DECOMPOSE_RESPONSE) + "\n```",
        },
      ],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: {
        input_tokens: 1500,
        output_tokens: 800,
      },
    });
  }),
];
