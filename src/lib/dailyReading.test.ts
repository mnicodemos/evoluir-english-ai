import { describe, expect, it } from "vitest";

import {
  answerParagraph,
  READING_SPECS,
  dailyReadingMessages,
  readingChoiceKey,
  readingReference,
  fallbackReading,
  gradeReading,
  lookupTerm,
  parseDailyReading,
  readingLevel,
  readingParagraphs,
  readingSpeechChunks,
  readingSpeechParts,
  readingWeekDays,
  readingThemeForDay,
  readingKindLabel,
  readingEstimate,
  sentenceWith,
  todaysPickForDay,
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

  it("rotates Today's pick through eight subjects, motivation once", () => {
    const days = Array.from({ length: 8 }, (_, index) =>
      new Date(Date.UTC(2026, 9, 30 + index)).toISOString().slice(0, 10),
    );
    const picks = days.map((day) => todaysPickForDay(day));
    expect(picks[0]).toBeNull();
    expect(readingThemeForDay("2026-10-30")).toBe("motivational");
    expect(picks.filter((pick) => pick === null)).toHaveLength(1);
    expect(new Set(picks.map((pick) => (pick ? `${pick.category}:${pick.style}` : "m"))).size).toBe(
      8,
    );
    expect(readingThemeForDay("2026-10-31")).toBe("story");
    expect(todaysPickForDay("2026-11-07")).toBeNull();
  });

  it("finds the sentence a marked word came from", () => {
    const text = "Ana gets up at seven. She drinks coffee!\n\nHer dog loves the park.";
    expect(sentenceWith(text, "coffee")).toBe("She drinks coffee!");
    expect(sentenceWith(text, "Dog")).toBe("Her dog loves the park.");
    expect(sentenceWith(text, "do")).toBe("");
    expect(sentenceWith(text, "gets up")).toBe("Ana gets up at seven.");
  });

  it("keeps a question's quote only when it is really in the text", () => {
    const raw = JSON.parse(reply(75, 3)) as { questions: Record<string, unknown>[] };
    raw.questions[0]!["evidence"] = "word3 word4 word5";
    raw.questions[1]!["evidence"] = "a sentence that is not there";
    const reading = parseDailyReading(JSON.stringify(raw), "a1");
    expect(reading?.questions[0]?.evidence).toBe("word3 word4 word5");
    expect(reading?.questions[1]?.evidence).toBeUndefined();
    expect(reading?.questions[2]?.evidence).toBeUndefined();
  });

  it("finds the paragraph that answers a question", () => {
    const text =
      "Ana wakes up early and drinks coffee in the kitchen.\n\nAt work, Ana answers emails and talks to customers about their orders.\n\nIn the evening she walks her dog in the park.";
    const base = {
      question: "Where does Ana walk her dog?",
      options: ["At the office", "In the park", "In the kitchen", "At the station"],
      answer: 1,
    };
    expect(answerParagraph(text, base)).toBe(2);
    expect(
      answerParagraph(text, { ...base, evidence: "Ana answers emails and talks to customers" }),
    ).toBe(1);
    expect(
      answerParagraph(text, {
        question: "Why is it nice?",
        options: ["Yes", "No", "Maybe", "Never"],
        answer: 0,
      }),
    ).toBeNull();
  });

  it("tags each spoken chunk with its paragraph", () => {
    const parts = readingSpeechParts("First one. Second one.\n\nThird paragraph here.");
    expect(parts).toEqual([
      { text: "First one. Second one.", paragraph: 0 },
      { text: "Third paragraph here.", paragraph: 1 },
    ]);
    expect(readingSpeechChunks("First one.\n\nSecond.")).toEqual(["First one.", "Second."]);
  });

  it("lists the last seven study days, oldest first", () => {
    expect(readingWeekDays("2026-11-02")).toEqual([
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("estimates the size of the reading by level", () => {
    const text = Array.from({ length: 200 }, () => "word").join(" ");
    expect(readingEstimate(text, "b1", 5)).toEqual({ words: 200, minutes: 5 });
    expect(readingEstimate(text, "a1", 3).minutes).toBe(4);
    expect(readingEstimate("Hi.", "c2", 0).minutes).toBe(1);
  });

  it("labels Today's pick by its subject", () => {
    expect(readingKindLabel({ theme: "motivational", day: "2026-10-30" })).toBe("Motivation");
    expect(readingKindLabel({ theme: "story", day: "2026-10-31" })).toBe("Daily life · Story");
    expect(
      readingKindLabel({
        theme: "story",
        day: "2026-10-31",
        choice: { category: "travel", style: "article" },
      }),
    ).toBe("Travel · Article");
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

describe("reading choice", () => {
  it("keys the choice, with Today's pick as the default", () => {
    expect(readingChoiceKey(null)).toBe("today");
    expect(readingChoiceKey({ category: "travel", style: "dialogue" })).toBe("travel:dialogue");
  });

  it("briefs the AI on the chosen subject and style instead of the theme", () => {
    const [system, user] = dailyReadingMessages("b1", "motivational", "2026-10-22", {
      category: "work",
      style: "article",
    });
    expect(system!.content).toContain("Subject: work and career");
    expect(system!.content).toContain("magazine-style article");
    expect(system!.content).not.toContain("Theme:");
    expect(user!.content).toContain("article about work");
  });

  it("keeps the daily theme without a choice", () => {
    const [system] = dailyReadingMessages("b1", "motivational", "2026-10-22");
    expect(system!.content).toContain("Theme:");
    expect(system!.content).not.toContain("Subject:");
  });

  it("names the category and style in the source line", () => {
    const reference = readingReference(
      {
        level: "b1",
        theme: "story",
        day: "2026-10-22",
        choice: { category: "travel", style: "story" },
      },
      (label) => label,
    );
    expect(reference).toContain("Travel · Story");
  });
});
