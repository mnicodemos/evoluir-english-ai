import { describe, expect, it } from "vitest";

import { readingQuizEvidence } from "./dualWrite";

const details = [
  { question_id: "11111111-1111-4111-8111-111111111111", is_correct: true },
  { question_id: "22222222-2222-4222-8222-222222222222", is_correct: false },
  { is_correct: true },
] as Parameters<typeof readingQuizEvidence>[0];

describe("reading quiz evidence", () => {
  it("adds one reading-comprehension signal per answered question of a reading lesson", () => {
    const evidence = readingQuizEvidence(details, "reading", "B1");
    expect(evidence).toHaveLength(2);
    expect(evidence.map((item) => [item.skill, item.subskill, item.rawScore])).toEqual([
      ["reading", "reading_comprehension", 100],
      ["reading", "reading_comprehension", 0],
    ]);
    expect(evidence[0]).toMatchObject({ sourceType: "quiz", itemCefr: "B1" });
  });

  it("adds nothing for other lessons", () => {
    expect(readingQuizEvidence(details, "grammar", "B1")).toEqual([]);
    expect(readingQuizEvidence(details, null)).toEqual([]);
  });
});
