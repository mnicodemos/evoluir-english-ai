import { describe, expect, it } from "vitest";

import {
  DONT_KNOW,
  PLACEMENT_QUESTIONS,
  isAnswered,
  isCorrectAnswer,
  normalizeWritten,
  placementComplete,
  scorePlacement,
} from "./placementTest";

const correctAnswer = (id: string) => {
  const q = PLACEMENT_QUESTIONS.find((item) => item.id === id)!;
  return q.kind === "listen" ? q.answer : q.accepted[0]!;
};

const allCorrectUpTo = (lastBand: string) => {
  const bands = ["a1", "a2", "b1", "b2", "c1", "c2"];
  const allowed = new Set(bands.slice(0, bands.indexOf(lastBand) + 1));
  return Object.fromEntries(
    PLACEMENT_QUESTIONS.filter((q) => allowed.has(q.band)).map((q) => [q.id, correctAnswer(q.id)]),
  );
};

describe("placement test", () => {
  it("has one listening and one writing question per CEFR band", () => {
    for (const band of ["a1", "a2", "b1", "b2", "c1", "c2"]) {
      const kinds = PLACEMENT_QUESTIONS.filter((q) => q.band === band).map((q) => q.kind);
      expect(kinds.sort()).toEqual(["listen", "write"]);
    }
  });

  it("every listening answer is one of its options", () => {
    for (const q of PLACEMENT_QUESTIONS) {
      if (q.kind === "listen") expect(q.options).toContain(q.answer);
    }
  });

  it("accepts typed answers regardless of case, spaces, punctuation and curly apostrophes", () => {
    const b2 = PLACEMENT_QUESTIONS.find((q) => q.id === "b2-write")!;
    expect(isCorrectAnswer(b2, "  Would  have called. ")).toBe(true);
    expect(isCorrectAnswer(b2, "would’ve called")).toBe(true);
    expect(isCorrectAnswer(b2, "would called")).toBe(false);
    expect(normalizeWritten("Went!")).toBe("went");
  });

  it("places by the highest band passed without skipping one", () => {
    expect(scorePlacement({}).level.value).toBe("a1");
    expect(scorePlacement(allCorrectUpTo("b1")).level.value).toBe("b1");
    expect(scorePlacement(allCorrectUpTo("c2")).level.value).toBe("c2");
    // Correct C1 answers do not count after a failed B2.
    const skipped = { ...allCorrectUpTo("a2"), "c1-write": "had" };
    expect(scorePlacement(skipped).level.value).toBe("a2");
  });

  it("one correct answer out of two passes a band", () => {
    const answers = { "a1-write": "is", "a2-listen": "On foot" };
    const result = scorePlacement(answers);
    expect(result.level.value).toBe("a2");
    expect(result.correct).toBe(2);
    expect(result.total).toBe(12);
  });

  it("blank typing does not count as answered", () => {
    expect(isAnswered("   ")).toBe(false);
    expect(isAnswered("went")).toBe(true);
  });

  it("ends once a band is fully answered with nothing right", () => {
    const passedA1 = allCorrectUpTo("a1");
    expect(placementComplete(passedA1)).toBe(false);
    const stopped = { ...passedA1, "a2-listen": DONT_KNOW, "a2-write": DONT_KNOW };
    expect(placementComplete(stopped)).toBe(true);
    expect(scorePlacement(stopped).level.value).toBe("a1");
  });

  it("goes on while the current band still has an open or a right answer", () => {
    expect(placementComplete({ ...allCorrectUpTo("a1"), "a2-listen": DONT_KNOW })).toBe(false);
    expect(placementComplete(allCorrectUpTo("b2"))).toBe(false);
    expect(placementComplete(allCorrectUpTo("c2"))).toBe(true);
  });

  it("'I don't know' counts as answered but never as right", () => {
    expect(isAnswered(DONT_KNOW)).toBe(true);
    for (const q of PLACEMENT_QUESTIONS) expect(isCorrectAnswer(q, DONT_KNOW)).toBe(false);
  });
});
