import { describe, expect, it } from "vitest";

import {
  lessonBatchKey,
  ownedWordSet,
  selectNewWords,
  templateVocabularyCandidates,
} from "./vocabularyBatch";

const w = (word: string) => ({ word, translation: "tradução" });

describe("vocabulary batch selection", () => {
  it("keeps words that exist globally but not for this student", () => {
    const owned = ownedWordSet([{ word: "meeting" }]);
    const picked = selectNewWords([w("deadline"), w("budget")], owned, 10);
    expect(picked.map((p) => p.word)).toEqual(["deadline", "budget"]);
  });

  it("drops a word the student already owns", () => {
    const owned = ownedWordSet([{ word: "Deadline" }]);
    const picked = selectNewWords([w("deadline"), w("budget")], owned, 10);
    expect(picked.map((p) => p.word)).toEqual(["budget"]);
  });

  it("saves fewer than ten without failing and never pads", () => {
    const owned = ownedWordSet([{ word: "a" }, { word: "b" }, { word: "c" }, { word: "d" }]);
    const suggestions = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map(w);
    const picked = selectNewWords(suggestions, owned, 10);
    expect(picked).toHaveLength(6);
  });

  it("returns nothing when no suggestion is new", () => {
    const owned = ownedWordSet([{ word: "a" }, { word: "b" }]);
    expect(selectNewWords([w("a"), w("B")], owned, 10)).toEqual([]);
  });

  it("removes duplicates inside the same suggestion list", () => {
    const picked = selectNewWords([w("goal"), w("Goal")], new Set<string>(), 10);
    expect(picked).toHaveLength(1);
  });

  it("uses completed lessons for the batch key so retaking a lesson reuses it", () => {
    expect(lessonBatchKey(3)).toBe("completed-3");
    expect(lessonBatchKey(3)).toBe(lessonBatchKey(3));
    expect(lessonBatchKey(4)).not.toBe(lessonBatchKey(3));
  });
});

describe("shared lesson vocabulary templates", () => {
  it("extracts complete translated flashcards and maps their lesson title", () => {
    const candidates = templateVocabularyCandidates(
      [
        {
          curriculum_key: "b2-u1-l1",
          content: {
            flashcards: [
              {
                word: "negotiate",
                translation: "negociar",
                definition: "discuss to reach an agreement",
                pronunciation: "nɪˈɡəʊʃieɪt",
                example: "We need to negotiate the terms.",
                difficulty: "hard",
              },
            ],
          },
        },
      ],
      new Map([["b2-u1-l1", "Listening to a Debate"]]),
    );

    expect(candidates).toEqual([
      {
        word: "negotiate",
        translation: "negociar",
        meaning: "discuss to reach an agreement",
        pronunciation: "nɪˈɡəʊʃieɪt",
        example: "We need to negotiate the terms.",
        lesson_title: "Listening to a Debate",
        difficulty: "hard",
      },
    ]);
  });

  it("ignores untranslated or incomplete flashcards and duplicate words", () => {
    const candidates = templateVocabularyCandidates(
      [
        {
          curriculum_key: "b1-u1-l1",
          content: {
            flashcards: [
              {
                word: "meeting",
                translation: "",
                definition: "a work discussion",
                example: "The meeting starts at 9.",
              },
              {
                word: "meeting",
                translation: "reunião",
                definition: "a work discussion",
                example: "The meeting starts at 9.",
              },
              {
                word: "Meeting",
                translation: "encontro",
                definition: "a work discussion",
                example: "We had a meeting.",
              },
              {
                word: "deadline",
                translation: "prazo",
                definition: "the latest time to finish",
                example: "The deadline is Friday.",
              },
            ],
          },
        },
      ],
      new Map(),
    );

    expect(candidates.map((candidate) => candidate.word)).toEqual(["meeting", "deadline"]);
    expect(candidates[0]?.lesson_title).toBe("");
  });

  it("returns an empty list for malformed template content", () => {
    expect(
      templateVocabularyCandidates([{ curriculum_key: "b1-u1-l1", content: null }], new Map()),
    ).toEqual([]);
  });
});
