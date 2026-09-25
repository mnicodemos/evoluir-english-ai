import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
const { estimateAiCost } = await import("./ai-usage.server");

describe("estimateAiCost", () => {
  it("prices Gemini models with official per-1M rates", () => {
    expect(estimateAiCost("gemini-3.5-flash-lite", 1_000_000, 1_000_000)).toBeCloseTo(2.8);
    expect(estimateAiCost("gemini-3.5-flash", 1_000_000, 1_000_000)).toBeCloseTo(10.5);
  });
  it("keeps unpriced models and missing tokens as null", () => {
    expect(estimateAiCost("openai/gpt-6-astra", 100, 100)).toBeNull();
    expect(estimateAiCost("gemini-2.5-flash-preview-tts", 100, 100)).toBeNull();
    expect(estimateAiCost("gemini-3.5-flash-lite", null, 100)).toBeNull();
  });
});
