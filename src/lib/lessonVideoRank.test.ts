import { describe, expect, it } from "vitest";

import { isTrustedChannel, rankVideoCandidates, topicKeywords } from "./lessonVideoRank";

describe("lesson video ranking", () => {
  it("keeps only the lesson's own words", () => {
    expect(topicKeywords("Greetings and Introductions A1")).toEqual(["greetings", "introductions"]);
    expect(topicKeywords("Review I")).toEqual([]);
  });

  it("prefers relevance over the 5-minute length", () => {
    const ranked = rankVideoCandidates(
      [
        {
          id: "aaaaaaaaaaa",
          seconds: 420,
          title: "Greetings in English for beginners",
          channel: "Some teacher",
        },
        { id: "bbbbbbbbbbb", seconds: 300, title: "My morning vlog", channel: "Random vlogger" },
        {
          id: "ccccccccccc",
          seconds: 240,
          title: "How to introduce yourself",
          channel: "BBC Learning English",
        },
      ],
      "Greetings and Introductions A1",
      "a1",
    );
    // The off-topic video closest to 5 minutes is dropped.
    expect(ranked.map((video) => video.id)).toEqual(["aaaaaaaaaaa", "ccccccccccc"]);
  });

  it("recognises teaching channels", () => {
    expect(isTrustedChannel("English with Lucy")).toBe(true);
    expect(isTrustedChannel("Gaming Clips")).toBe(false);
  });
});
