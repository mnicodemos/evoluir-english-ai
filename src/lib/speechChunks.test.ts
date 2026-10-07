import { describe, expect, it } from "vitest";

import { takeSpeechBlocks, takeStreamBlocks } from "@/lib/speechChunks";

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

describe("takeStreamBlocks", () => {
  it("speaks the first sentence as soon as it is written", () => {
    const { blocks, rest } = takeStreamBlocks(
      "That sounds like a really great plan for the weekend! What",
      false,
    );
    expect(blocks).toEqual(["That sounds like a really great plan for the weekend!"]);
    expect(rest.trim()).toBe("What");
  });

  it("waits while the first sentence is still being written", () => {
    expect(takeStreamBlocks("That sounds like a great", false)).toEqual({
      blocks: [],
      rest: "That sounds like a great",
    });
  });

  it("does not split a burst of text into many small blocks", () => {
    const burst =
      "Nice, you went to the beach! Did you swim? I love the sea. The water is cold in July. " +
      "What else did you do there with your friends on Sunday afternoon? Tell me more. ";
    const { blocks } = takeStreamBlocks(burst, false);
    // The first pause after 40 characters ends the opening block.
    expect(blocks[0]).toBe("Nice, you went to the beach! Did you swim?");
    expect(blocks.length).toBeLessThanOrEqual(2);
    expect(blocks.slice(1).every((block) => block.length >= 140)).toBe(true);
  });

  it("uses the regular size once the first block is out", () => {
    expect(takeStreamBlocks("Did you swim? I love the sea. ", true).blocks).toEqual([]);
  });
});
