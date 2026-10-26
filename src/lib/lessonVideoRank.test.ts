import { describe, expect, it } from "vitest";

import {
  isTrustedChannel,
  rankVideoCandidates,
  topicKeywords,
  unsuitableVideo,
} from "./lessonVideoRank";

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
    expect(ranked.map((video) => video.id).sort()).toEqual(["aaaaaaaaaaa", "ccccccccccc"]);
  });

  it("recognises teaching channels", () => {
    expect(isTrustedChannel("English with Lucy")).toBe(true);
    expect(isTrustedChannel("Gaming Clips")).toBe(false);
  });

  // Owner review of A1 (2026-10-26): the three videos students got.
  it("drops teacher-training videos at every level", () => {
    const guide = {
      id: "xh8M_x57pa4",
      seconds: 270,
      title: "Reading effectively - a 3-stage lesson guide",
      channel: "Teaching English with Oxford",
    };
    expect(unsuitableVideo(guide, ["reading"], "b2")).toBe(true);
    expect(
      unsuitableVideo(
        { ...guide, title: "Reading tips for teachers", channel: "Some channel" },
        ["reading"],
        "c1",
      ),
    ).toBe(true);
  });

  it("asks beginners for the lesson's topic even on a teaching channel", () => {
    const keywords = topicKeywords("Hearing Greetings and Names A1");
    const offTopic = {
      id: "Y681hXWwhQY",
      seconds: 380,
      title: "The benefits of doing nothing ⏲️ 6 Minute English",
      channel: "BBC Learning English",
    };
    expect(unsuitableVideo(offTopic, keywords, "a1")).toBe(true);
    expect(unsuitableVideo(offTopic, keywords, "b1")).toBe(false);
    expect(
      unsuitableVideo({ ...offTopic, title: "Greetings in English for beginners" }, keywords, "a1"),
    ).toBe(false);
  });

  it("keeps 6 Minute English for B1 and up", () => {
    const sixMinute = {
      id: "aaaaaaaaaaa",
      seconds: 360,
      title: "Greetings around the world ⏲️ 6 Minute English",
      channel: "BBC Learning English",
    };
    expect(unsuitableVideo(sixMinute, ["greetings"], "a2")).toBe(true);
    expect(unsuitableVideo(sixMinute, ["greetings"], "b1")).toBe(false);
  });
});
