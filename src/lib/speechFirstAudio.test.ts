import { describe, expect, it } from "vitest";

import {
  FIRST_BLOCK_MAX_CHARS,
  MAX_SPEECH_BLOCKS,
  splitForFirstAudio,
} from "@/lib/speechChunks";

const SHORT = "Good morning, how are you today?";
const MEDIUM =
  "I have been working on my English for three months and I can already talk about my daily routine with confidence.";
const LONG =
  "Yesterday I went to the market with my sister and we bought fruit, bread and cheese. After that we walked in the park, talked about our plans for next year, and decided to start studying English together every evening for at least thirty minutes.";

describe("splitForFirstAudio", () => {
  it("keeps a short sentence as a single audio request", () => {
    expect(splitForFirstAudio(SHORT)).toEqual([SHORT]);
  });

  it("keeps a single word (Vocabulary, Flashcards, Listening) as one request", () => {
    expect(splitForFirstAudio("resilient")).toEqual(["resilient"]);
  });

  it("starts a medium answer with a shorter opening block", () => {
    const blocks = splitForFirstAudio(MEDIUM);
    expect(blocks.length).toBeGreaterThan(1);
    expect(blocks[0]!.length).toBeLessThanOrEqual(FIRST_BLOCK_MAX_CHARS);
  });

  it("starts a long answer with a shorter opening block", () => {
    const blocks = splitForFirstAudio(LONG);
    expect(blocks.length).toBeGreaterThan(1);
    expect(blocks[0]!.length).toBeLessThanOrEqual(FIRST_BLOCK_MAX_CHARS);
  });

  it("cuts only at a natural pause, never inside a word", () => {
    for (const block of splitForFirstAudio(LONG).slice(0, -1)) {
      expect(/[.!?,;]$/.test(block)).toBe(true);
    }
  });

  it("keeps the order and the full text of the answer", () => {
    const joined = splitForFirstAudio(LONG).join(" ").replace(/\s+/g, " ").trim();
    expect(joined).toBe(LONG.replace(/\s+/g, " ").trim());
  });

  it("never produces more requests than the allowed maximum", () => {
    const veryLong = Array.from({ length: 20 }, () => LONG).join(" ");
    expect(splitForFirstAudio(veryLong).length).toBeLessThanOrEqual(MAX_SPEECH_BLOCKS);
  });

  it("never emits an empty block", () => {
    expect(splitForFirstAudio(LONG).every((block) => block.trim().length > 0)).toBe(true);
  });

  it("is deterministic, so a repeated tap reuses the same cache keys", () => {
    expect(splitForFirstAudio(LONG)).toEqual(splitForFirstAudio(LONG));
  });

  it("returns nothing for empty text", () => {
    expect(splitForFirstAudio("   ")).toEqual([]);
  });
});
