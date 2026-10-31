import { describe, expect, it } from "vitest";

import { optionSeed, quizRoundOrder, stableShuffle } from "./quizRound";

const questions = Array.from({ length: 8 }, (_, i) => ({ id: `q${i + 1}` }));
const ids = (list: { id: string }[]) => list.map((q) => q.id);

describe("quiz rounds", () => {
  it("keeps the lesson's order in the first round", () => {
    expect(ids(quizRoundOrder(questions, "lesson", 0, ["q5"]))).toEqual(ids(questions));
  });

  it("shuffles each retake the same way on every render", () => {
    const first = ids(quizRoundOrder(questions, "lesson", 1, []));
    expect(first).toEqual(ids(quizRoundOrder(questions, "lesson", 1, [])));
    expect(first).not.toEqual(ids(questions));
    expect([...first].sort()).toEqual(ids(questions).sort());
    expect(first).not.toEqual(ids(quizRoundOrder(questions, "lesson", 2, [])));
  });

  it("puts the questions missed last time first", () => {
    const order = ids(quizRoundOrder(questions, "lesson", 1, ["q7", "q2"]));
    expect(new Set(order.slice(0, 2))).toEqual(new Set(["q7", "q2"]));
    expect(order).toHaveLength(questions.length);
  });

  it("shuffles options by question and round", () => {
    expect(optionSeed("q1", 0)).toBe("q1");
    expect(optionSeed("q1", 3)).toBe("q1:3");
    const options = ["a", "b", "c", "d"];
    expect(stableShuffle(options, "q1").sort()).toEqual(options);
    expect(stableShuffle(options, "q1")).toEqual(stableShuffle(options, "q1"));
  });
});
