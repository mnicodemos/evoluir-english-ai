import { describe, expect, it } from "vitest";

import {
  READING_SPECS,
  fallbackReading,
  gradeReading,
  lookupTerm,
  parseDailyReading,
  readingLevel,
  readingParagraphs,
  readingSpeechChunks,
  readingThemeForDay,
  readingTokens,
  wordCount,
} from "./dailyReading";

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

const question = (answer = 1) => ({
  question: "What does she do?",
  options: ["She runs", "She reads", "She sleeps", "She cooks"],
  answer,
  explanation_pt: "Ela lê.",
});

const reply = (textWords: number, questions: number) =>
  JSON.stringify({
    title: "A Day",
    text: words(textWords),
    text_pt: "Um dia.",
    glossary: [{ word: "word1", pt: "palavra" }],
    questions: Array.from({ length: questions }, () => question()),
  });

describe("daily reading rules", () => {
  it("grows in length and questions with the level", () => {
    expect(READING_SPECS.a1.maxWords).toBeLessThan(READING_SPECS.b1.minWords);
    expect(READING_SPECS.b1.maxWords).toBeLessThan(READING_SPECS.c1.minWords);
    expect(READING_SPECS.a1.questions).toBeLessThan(READING_SPECS.c1.questions);
  });

  it("reads any profile level, B1 when unknown", () => {
    expect(readingLevel("C1")).toBe("c1");
    expect(readingLevel("a2")).toBe("a2");
    expect(readingLevel(null)).toBe("b1");
    expect(readingLevel("intermediate")).toBe("b1");
  });

  it("alternates the theme day by day", () => {
    const today = readingThemeForDay("2026-10-17");
    const tomorrow = readingThemeForDay("2026-10-18");
    expect(today).not.toBe(tomorrow);
    expect(readingThemeForDay("2026-10-19")).toBe(today);
  });

  it("accepts a reply that fits the level", () => {
    const reading = parseDailyReading(reply(75, 3), "a1");
    expect(reading?.questions).toHaveLength(3);
    expect(reading?.textPt).toBe("Um dia.");
  });

  it("rejects a text far too long for A1 or with too few questions", () => {
    expect(parseDailyReading(reply(300, 3), "a1")).toBeNull();
    expect(parseDailyReading(reply(330, 2), "c1")).toBeNull();
    expect(parseDailyReading("not json", "a1")).toBeNull();
  });

  it("grades the answers, unanswered counting as wrong", () => {
    expect(gradeReading([question(1), question(2), question(0)], [1, 2, null])).toEqual({
      right: 2,
      total: 3,
      score: 67,
    });
  });

  it("splits paragraphs and voice chunks within the speech limit", () => {
    expect(readingParagraphs("One.\n\nTwo.")).toEqual(["One.", "Two."]);
    const long = Array.from({ length: 40 }, (_, i) => `This is sentence number ${i}.`).join(" ");
    const chunks = readingSpeechChunks(long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 400)).toBe(true);
    expect(chunks.join(" ")).toBe(long);
  });

  it("has a fallback for every level with the level's question count", () => {
    for (const level of ["a1", "a2", "b1", "b2", "c1", "c2"] as const) {
      const reading = fallbackReading(level);
      expect(reading.questions).toHaveLength(READING_SPECS[level].questions);
      expect(wordCount(reading.text)).toBeGreaterThan(40);
    }
  });

  it("makes every word tappable and keeps the text between them", () => {
    const tokens = readingTokens("Maria's well-known café, don't stop!");
    expect(tokens.filter((token) => token.word).map((token) => token.text)).toEqual([
      "Maria's",
      "well-known",
      "café",
      "don't",
      "stop",
    ]);
    expect(tokens.map((token) => token.text).join("")).toBe("Maria's well-known café, don't stop!");
  });

  it("looks words up without capitals or a possessive", () => {
    expect(lookupTerm("Maria’s")).toBe("maria");
    expect(lookupTerm("Habits")).toBe("habits");
    expect(lookupTerm("don't")).toBe("don't");
  });
});
