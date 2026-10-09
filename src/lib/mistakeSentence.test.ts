import { describe, expect, it } from "vitest";

import { findMistakeSentence } from "./mistakeSentence";

describe("findMistakeSentence", () => {
  const texts = [
    "Yesterday I go to the beach with my friends. It was amazing!",
    "I have 30 years old.\nMy job is very interesting.",
  ];

  it("returns the whole sentence split around the wrong phrase", () => {
    expect(findMistakeSentence("I go", texts)).toEqual({
      before: "Yesterday ",
      wrong: "I go",
      after: " to the beach with my friends.",
    });
  });

  it("matches regardless of case and keeps the student's casing", () => {
    expect(findMistakeSentence("i have 30 years", texts)).toEqual({
      before: "",
      wrong: "I have 30 years",
      after: " old.",
    });
  });

  it("is null when the phrase is the whole sentence or not found", () => {
    expect(findMistakeSentence("It was amazing", texts)).toBeNull();
    expect(findMistakeSentence("she don't", texts)).toBeNull();
    expect(findMistakeSentence("  ", texts)).toBeNull();
  });
});
