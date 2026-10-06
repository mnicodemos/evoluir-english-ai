import { describe, expect, it } from "vitest";

import { parseGeminiStreamEvent } from "./gemini.server";

describe("parseGeminiStreamEvent", () => {
  it("joins the answer text and skips thinking parts", () => {
    const event = `data: ${JSON.stringify({
      candidates: [
        {
          content: { parts: [{ text: "plan", thought: true }, { text: "Hi " }, { text: "there" }] },
        },
      ],
    })}`;
    expect(parseGeminiStreamEvent(event)).toEqual({ delta: "Hi there" });
  });

  it("reports errors and token usage", () => {
    const event = [
      `data: ${JSON.stringify({ error: { message: "quota" } })}`,
      `data: ${JSON.stringify({ usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5 } })}`,
    ].join("\n");
    const parsed = parseGeminiStreamEvent(event);
    expect(parsed.error).toBe("quota");
    expect(parsed.usage?.inputTokens).toBe(12);
    expect(parsed.usage?.outputTokens).toBe(5);
  });

  it("ignores keep-alives and partial lines", () => {
    expect(parseGeminiStreamEvent(": ping\ndata: {not json")).toEqual({ delta: "" });
  });
});
