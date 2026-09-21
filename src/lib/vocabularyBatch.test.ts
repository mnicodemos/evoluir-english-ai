import { describe, expect, it } from "vitest";

import { lessonBatchKey, ownedWordSet, selectNewWords } from "./vocabularyBatch";

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
