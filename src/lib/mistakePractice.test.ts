import { describe, expect, it } from "vitest";

import { mistakePracticePrompt, parseMistakePractice } from "./mistakePractice";

const valid = {
  question: "She ___ to work every day.",
  options: ["go", "goes", "going"],
  answer_index: 1,
  explanation: "Na 3ª pessoa do singular do presente simples, o verbo recebe -s.",
};

describe("mistake practice", () => {
  it("accepts a well-formed question, also inside a code fence", () => {
    expect(parseMistakePractice(JSON.stringify(valid))).toEqual({
      question: valid.question,
      options: valid.options,
      answerIndex: 1,
      explanation: valid.explanation,
    });
    expect(parseMistakePractice("```json\n" + JSON.stringify(valid) + "\n```")).not.toBeNull();
  });

  it("rejects repeated options, an answer outside the options and broken JSON", () => {
    expect(
      parseMistakePractice(JSON.stringify({ ...valid, options: ["go", "Go", "goes"] })),
    ).toBeNull();
    expect(parseMistakePractice(JSON.stringify({ ...valid, answer_index: 3 }))).toBeNull();
    expect(parseMistakePractice(JSON.stringify({ ...valid, options: ["go", "goes"] }))).toBeNull();
    expect(parseMistakePractice("not json")).toBeNull();
  });

  it("asks for a different sentence on the same rule, at the student's level", () => {
    const [system, user] = mistakePracticePrompt({
      original: "He go to school.",
      corrected: "He goes to school.",
      explanation: "Third person -s.",
      category: "grammar",
      level: "b1",
    });
    expect(system!.content).toContain("DIFFERENT");
    expect(system!.content).toContain("B1");
    expect(user!.content).toContain("He go to school.");
  });
});
