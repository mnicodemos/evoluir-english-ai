import { describe, expect, it } from "vitest";

import { parseWords } from "./vocabularyPlan.functions";

const word = {
  word: "outcome",
  translation: "resultado",
  meaning: "the final result",
  pronunciation: "/ˈaʊtkʌm/",
  example: "The outcome was positive.",
  lesson_title: "Lesson 1",
  difficulty: "Medium",
};

describe("parseWords", () => {
  it("reads the expected {words: [...]} answer", () => {
    const parsed = parseWords(JSON.stringify({ words: [word] }));
    expect(parsed.success && parsed.data.words[0]?.word).toBe("outcome");
  });

  it("accepts a bare array or another wrapper key", () => {
    expect(parseWords(JSON.stringify([word])).success).toBe(true);
    expect(parseWords(JSON.stringify({ vocabulary: [word] })).success).toBe(true);
  });

  it("strips code fences and keeps only well-formed items", () => {
    const raw = "```json\n" + JSON.stringify({ words: [word, { word: "x" }] }) + "\n```";
    const parsed = parseWords(raw);
    expect(parsed.success && parsed.data.words).toHaveLength(1);
  });

  it("fails on unreadable answers", () => {
    expect(parseWords("not json").success).toBe(false);
    expect(parseWords(JSON.stringify({ words: [] })).success).toBe(false);
  });
});
