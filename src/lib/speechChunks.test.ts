import { describe, expect, it } from "vitest";

import { takeSpeechBlocks } from "@/lib/speechChunks";

describe("takeSpeechBlocks", () => {
  it("keeps short replies in a single block instead of one request per phrase", () => {
    const { blocks, rest } = takeSpeechBlocks("Hi there. How are you today? Tell me more.");
    expect(blocks).toEqual([]);
    expect(rest).toBe("Hi there. How are you today? Tell me more.");
  });

  it("splits long text only at a natural pause after the minimum size", () => {
    const first =
      "That is a great answer and I can hear real progress in your pronunciation today, well done.";
    const second = " Now tell me about the last trip you took with your family, please.";
    const { blocks, rest } = takeSpeechBlocks(`${first}${second}`, 80);
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks[0]!.length).toBeGreaterThanOrEqual(80);
    expect(/[.!?,;]$/.test(blocks[0]!)).toBe(true);
    expect(`${blocks.join(" ")} ${rest}`.replace(/\s+/g, " ").trim()).toBe(
      `${first}${second}`.replace(/\s+/g, " ").trim(),
    );
  });

  it("never emits empty blocks", () => {
    const { blocks } = takeSpeechBlocks(" ,,,,, ", 2);
    expect(blocks.every((block) => block.length > 0)).toBe(true);
  });
});
