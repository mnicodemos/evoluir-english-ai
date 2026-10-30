import { describe, expect, it } from "vitest";

import { quizSkillSummary } from "./quizSummary";

describe("quiz skill summary", () => {
  it("counts right answers by skill and marks a weak one", () => {
    expect(
      quizSkillSummary([
        { skill: "grammar", right: true },
        { skill: "grammar", right: false },
        { skill: "grammar", right: false },
        { skill: "vocabulary", right: true },
        { skill: null, right: false },
      ]),
    ).toEqual([
      { skill: "grammar", label: "Grammar", right: 1, total: 3, weak: true },
      { skill: "vocabulary", label: "Vocabulary", right: 1, total: 1, weak: false },
    ]);
  });

  it("leaves out skills with no question", () => {
    expect(quizSkillSummary([{ skill: "vocabulary", right: true }])).toHaveLength(1);
  });
});
