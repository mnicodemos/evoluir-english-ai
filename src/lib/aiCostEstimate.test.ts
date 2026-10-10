import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
const { estimateAiCost } = await import("./ai-usage.server");

describe("estimateAiCost", () => {
  it("prices Gemini models with official per-1M rates", () => {
    expect(estimateAiCost("gemini-3.5-flash-lite", 1_000_000, 1_000_000)).toBeCloseTo(2.8);
    expect(estimateAiCost("gemini-3.5-flash", 1_000_000, 1_000_000)).toBeCloseTo(10.5);
    expect(estimateAiCost("gemini-3.6-flash", 1_000_000, 1_000_000)).toBeCloseTo(4.5);
  });
  it("keeps unpriced models and missing tokens as null", () => {
    expect(estimateAiCost("openai/gpt-6-astra", 100, 100)).toBeNull();
    expect(estimateAiCost("gemini-3.5-flash-lite", null, 100)).toBeNull();
  });
});

describe("TTS and transcription costs (user request: measure every call)", () => {
  it("prices the TTS model: text in, audio out", () => {
    expect(estimateAiCost("gemini-2.5-flash-preview-tts", 1_000_000, 1_000_000)).toBeCloseTo(10.5);
  });

  it("reads Gemini's token counts, thinking billed as output", async () => {
    const { geminiUsageTokens } = await import("./aiPricing");
    expect(
      geminiUsageTokens({ promptTokenCount: 120, candidatesTokenCount: 30, thoughtsTokenCount: 5 }),
    ).toEqual({ inputTokens: 120, outputTokens: 35 });
    expect(geminiUsageTokens({ promptTokenCount: 80 })).toEqual({
      inputTokens: 80,
      outputTokens: 0,
    });
    expect(geminiUsageTokens(undefined)).toBeNull();
    expect(geminiUsageTokens({ candidatesTokenCount: 3 })).toBeNull();
  });
});
