import { describe, expect, it } from "vitest";

import { buildLessonGuide } from "@/lib/lessonGuide";

const lesson = {
  title: "Present Perfect vs Past Simple",
  objective: "Choose the right tense to talk about experience and news.",
  summary:
    "The present perfect connects the past with now. You use it when the exact time is not important. " +
    "The past simple is used when you say exactly when something happened. Remember that yesterday and last week ask for the past simple. " +
    "This difference is the most common mistake for Brazilian learners.",
  skill: "grammar",
  level: "b1",
};

const cards = [
  {
    word: "have been",
    definition: "experience up to now",
    answer: "I have been to London twice.",
    example: "I have been to London twice.",
    difficulty: "hard",
  },
  {
    word: "last week",
    definition: "a finished time",
    answer: "I went there last week.",
    example: "I went there last week.",
    difficulty: "easy",
  },
];

describe("lesson learning guide", () => {
  it("builds the guide sections in order", () => {
    const sections = buildLessonGuide(lesson, cards);
    expect(sections.map((section) => section.id)).toEqual([
      "objectives",
      "essentials",
      "usage",
      "attention",
      "quick",
      "before-quiz",
    ]);
  });

  it("uses the lesson objective and stays short", () => {
    const sections = buildLessonGuide(lesson, cards);
    const objectives = sections.find((section) => section.id === "objectives")!;
    expect(objectives.items[0]).toContain("Choose the right tense");
    sections.forEach((section) => expect(section.items.length).toBeLessThanOrEqual(8));
  });

  it("never copies a transcript, because it does not receive one", () => {
    const guideText = buildLessonGuide(lesson, cards)
      .flatMap((section) => section.items)
      .join(" ");
    expect(guideText).not.toContain("transcript");
    expect(guideText.length).toBeLessThan(lesson.summary.length * 3);
  });

  it("drops empty sections when the lesson has no cards", () => {
    const ids = buildLessonGuide(lesson, []).map((section) => section.id);
    expect(ids).not.toContain("usage");
    expect(ids).not.toContain("quick");
    expect(ids).toContain("objectives");
  });

  it("warns about the hardest cards", () => {
    const attention = buildLessonGuide(lesson, cards).find(
      (section) => section.id === "attention",
    )!;
    expect(attention.items.join(" ")).toContain("have been");
  });
});
