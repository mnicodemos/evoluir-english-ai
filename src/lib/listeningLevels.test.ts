import { describe, expect, it } from "vitest";

import {
  fitsLevel,
  listeningLevelConfig,
  pickListeningSentences,
  sentencesFromText,
} from "@/lib/listeningLevels";

describe("listening level configuration", () => {
  it("adapts word range and playback rate to the CEFR level", () => {
    const a1 = listeningLevelConfig("a1");
    const c1 = listeningLevelConfig("c1");
    expect(a1.maxWords).toBeLessThan(c1.minWords);
    expect(a1.rate).toBeLessThan(c1.rate);
    expect(a1.slowMode).toBe("word-by-word");
    expect(c1.slowMode).toBe("slow-sentence");
  });

  it("keeps the current behaviour for B2 and legacy levels", () => {
    expect(listeningLevelConfig("upper-intermediate").level).toBe("b2");
    expect(listeningLevelConfig(null).rate).toBe(1);
  });

  it("only keeps sentences inside the level range", () => {
    const a1 = listeningLevelConfig("a1");
    expect(a1.sentences.every((sentence) => fitsLevel(sentence, a1))).toBe(true);
    expect(fitsLevel("Despite considerable investment the initiative has not delivered yet.", a1)).toBe(
      false,
    );
  });

  it("extracts lesson sentences that match the level", () => {
    const b1 = listeningLevelConfig("b1");
    const found = sentencesFromText(
      "Hi. I think we should finish this report before the end of Friday.",
      b1,
    );
    expect(found).toEqual(["I think we should finish this report before the end of Friday."]);
  });

  it("rotates the picked sentences so recent practice is not repeated", () => {
    const config = listeningLevelConfig("a1");
    const first = pickListeningSentences({ config, rotation: 0 });
    const second = pickListeningSentences({ config, rotation: 1 });
    expect(first).toHaveLength(3);
    expect(second).toHaveLength(3);
    expect(second[0]).not.toBe(first[0]);
  });

  it("adds lesson sentences of the level to the pool", () => {
    const config = listeningLevelConfig("a1");
    const picked = pickListeningSentences({
      config,
      lessonSentences: ["Open your book now."],
      rotation: config.sentences.length,
    });
    expect(picked).toContain("Open your book now.");
  });
});
