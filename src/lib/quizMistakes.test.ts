import { describe, expect, it } from "vitest";

import { quizMistakes } from "./quizMistakes";

const question = (id: string, text: string, correct: string, skill = "grammar") => ({
  id,
  question: text,
  correct_answer: correct,
  explanation: "Use goes with she.",
  pedagogical_skill: skill,
});

describe("quiz mistakes", () => {
  it("turns a wrong fill-in answer into the sentence with and without the mistake", () => {
    const mistakes = quizMistakes(
      [question("q1", "She ___ to school every day.", "goes")],
      [{ question_id: "q1", answer: "go", is_correct: false }],
    );
    expect(mistakes).toEqual([
      {
        original: "She go to school every day.",
        corrected: "She goes to school every day.",
        explanation: "Use goes with she.",
        category: "grammar",
      },
    ]);
  });

  it("skips right answers, questions without a gap and empty answers", () => {
    const questions = [
      question("q1", "She ___ to school.", "goes"),
      question("q2", "What does 'kitchen' mean?", "A room to cook", "vocabulary"),
      question("q3", "They ___ happy.", "are"),
    ];
    expect(
      quizMistakes(questions, [
        { question_id: "q1", answer: "goes", is_correct: true },
        { question_id: "q2", answer: "A garden", is_correct: false },
        { question_id: "q3", answer: " ", is_correct: false },
      ]),
    ).toEqual([]);
  });

  it("labels word-choice items as vocabulary", () => {
    const [mistake] = quizMistakes(
      [question("q1", "I ___ a photo yesterday.", "took", "vocabulary")],
      [{ question_id: "q1", answer: "made", is_correct: false }],
    );
    expect(mistake?.category).toBe("vocabulary");
  });
});
