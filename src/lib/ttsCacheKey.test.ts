import { describe, expect, it } from "vitest";

import { isValidTtsEntry, normalizeTtsText, ttsCacheKey } from "./ttsCacheKey";

const base = { text: "Good morning!", voice: "Kore", model: "m1", prompt: "p" };

describe("ttsCacheKey", () => {
  it("is deterministic and ignores redundant whitespace only", async () => {
    expect(await ttsCacheKey(base)).toBe(
      await ttsCacheKey({ ...base, text: "  Good   morning! " }),
    );
    expect(normalizeTtsText("Hi,  there?")).toBe("Hi, there?");
  });
  it("changes with text, punctuation, voice, model and prompt", async () => {
    const k = await ttsCacheKey(base);
    for (const v of [
      { ...base, text: "Good evening!" },
      { ...base, text: "Good morning?" },
      { ...base, voice: "Puck" },
      { ...base, model: "m2" },
      { ...base, prompt: "q" },
    ])
      expect(await ttsCacheKey(v)).not.toBe(k);
    expect(k).toMatch(/^[0-9a-f]{64}$/);
  });
  it("rejects empty or invalid cached entries", () => {
    expect(isValidTtsEntry({ chunks: ["QUJD"] })).toBe(true);
    expect(isValidTtsEntry({ chunks: [] })).toBe(false);
    expect(isValidTtsEntry({ chunks: [""] })).toBe(false);
    expect(isValidTtsEntry({ chunks: ["{bad}"] })).toBe(false);
    expect(isValidTtsEntry(null)).toBe(false);
  });
});
