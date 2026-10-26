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
    expect(listeningLevelConfig("b2").rate).toBe(1);
    // Unknown levels keep the ladder default instead of failing.
    expect(listeningLevelConfig(null).level).toBe("b1");
  });

  it("only keeps sentences inside the level range", () => {
    const a1 = listeningLevelConfig("a1");
    expect(a1.sentences.every((sentence) => fitsLevel(sentence, a1))).toBe(true);
    expect(
      fitsLevel("Despite considerable investment the initiative has not delivered yet.", a1),
    ).toBe(false);
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

describe("pickListeningSentences fallback", () => {
  it("uses the level's built-in drills when no sentence fits its word range", () => {
    const config = listeningLevelConfig("b2");
    expect(pickListeningSentences({ config, rotation: 5, count: 3 })).toHaveLength(3);
  });

  it("fills a whole session of 9 at every level", () => {
    for (const level of ["a1", "a2", "b1", "b2", "c1", "c2"]) {
      const config = listeningLevelConfig(level);
      const picked = pickListeningSentences({ config, rotation: 2, count: 9 });
      expect(picked).toHaveLength(9);
      expect(new Set(picked).size).toBe(9);
    }
  });
});

// Owner request (2026-10-26): a new student's sessions of 9 repeated most of
// the 10 to 14 built-in sentences.
describe("listening drills per level", () => {
  const levels = ["a1", "a2", "b1", "b2", "c1", "c2"];

  it("has about 60 distinct drills inside each level's range", () => {
    for (const level of levels) {
      const config = listeningLevelConfig(level);
      const fitting = new Set(config.sentences.filter((sentence) => fitsLevel(sentence, config)));
      expect(fitting.size, level).toBeGreaterThanOrEqual(55);
      expect(new Set(config.sentences).size, level).toBe(config.sentences.length);
    }
  });

  it("gives a new student six sessions without repeating a sentence", () => {
    for (const level of levels) {
      const config = listeningLevelConfig(level);
      const seen = new Set<string>();
      for (let rotation = 0; rotation < 6; rotation += 1) {
        for (const sentence of pickListeningSentences({ config, rotation, count: 9 })) {
          expect(seen.has(sentence), `${level} session ${rotation}`).toBe(false);
          seen.add(sentence);
        }
      }
    }
  });
});

describe("the lesson opened last", () => {
  it("opens the session with its sentences, then the usual rotation", () => {
    const config = listeningLevelConfig("a1");
    const recent = [
      "I like my new teacher.",
      "We read a short story.",
      "The class starts at eight.",
    ];
    const session = pickListeningSentences({
      config,
      recentSentences: recent,
      rotation: 4,
      count: 9,
    });
    expect(session.slice(0, 3)).toEqual(recent);
    expect(session).toHaveLength(9);
    expect(new Set(session).size).toBe(9);
  });

  it("skips its sentences that do not fit the level", () => {
    const config = listeningLevelConfig("a1");
    const session = pickListeningSentences({
      config,
      recentSentences: ["This sentence is much too long for a beginner to repeat."],
      count: 9,
    });
    expect(session).not.toContain("This sentence is much too long for a beginner to repeat.");
    expect(session).toHaveLength(9);
  });
});
