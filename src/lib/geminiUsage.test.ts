import { describe, expect, it } from "vitest";

import { extractGeminiUsage } from "./gemini.server";

describe("extractGeminiUsage", () => {
  it("reads the token counts the provider reports", () => {
    expect(
      extractGeminiUsage({ usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 45 } }),
    ).toEqual({ inputTokens: 120, outputTokens: 45 });
  });

  it("returns nothing when the provider omits usage", () => {
    expect(extractGeminiUsage({ candidates: [] })).toEqual({});
    expect(extractGeminiUsage(null)).toEqual({});
  });

  it("never invents a value from a non-numeric field", () => {
    expect(
      extractGeminiUsage({
        usageMetadata: { promptTokenCount: "120", candidatesTokenCount: null },
      }),
    ).toEqual({});
  });

  it("bills cached prompt tokens at a tenth and thinking as output", () => {
    expect(
      extractGeminiUsage({
        usageMetadata: {
          promptTokenCount: 1000,
          cachedContentTokenCount: 800,
          candidatesTokenCount: 40,
          thoughtsTokenCount: 60,
        },
      }),
    ).toEqual({ inputTokens: 280, outputTokens: 100 });
  });
});
