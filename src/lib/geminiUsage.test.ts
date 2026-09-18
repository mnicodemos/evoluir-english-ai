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
      extractGeminiUsage({ usageMetadata: { promptTokenCount: "120", candidatesTokenCount: null } }),
    ).toEqual({});
  });
});
