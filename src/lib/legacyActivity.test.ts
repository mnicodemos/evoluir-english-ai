import { describe, expect, it } from "vitest";

import {
  listeningLegacyInputSchema,
  pronunciationLegacyInputSchema,
  quizLegacyInputSchema,
  talkingLegacyInputSchema,
  telemetryInputSchema,
} from "./legacyActivity.schemas";
import { listeningAnswerScore, pronunciationSimilarity } from "./legacyScores";

const key = "11111111-1111-4111-8111-111111111111";

describe("legacy authoritative contracts", () => {
  it("rejects client-declared Quiz scores and correctness", () => {
    expect(() =>
      quizLegacyInputSchema.parse({
        attemptKey: key,
        activityType: "lesson",
        minutes: 2,
        score: 100,
        is_correct: true,
        grammar_score: 100,
      }),
    ).toThrow();
  });

  it("rejects scores from telemetry", () => {
    expect(() =>
      telemetryInputSchema.parse({
        operationKey: key,
        activityType: "lesson_practice",
        minutes: 2,
        score: 100,
      }),
    ).toThrow();
  });

  it("accepts only raw Listening evidence and preserves the bag-of-words rule", () => {
    expect(
      listeningAnswerScore("We must call the client today.", "Today we call the client must."),
    ).toBe(100);
    expect(() =>
      listeningLegacyInputSchema.parse({
        operationKey: key,
        trackId: "professional",
        round: 1,
        minutes: 3,
        evidence: [{ expected: "We must call the client today.", transcripts: ["We call client"] }],
        listening_score: 100,
      }),
    ).toThrow();
  });

  it("accepts only a word reference and raw transcript for Pronunciation", () => {
    expect(pronunciationSimilarity("schedule", "schedule")).toBe(1);
    expect(() =>
      pronunciationLegacyInputSchema.parse({
        operationKey: key,
        wordId: key,
        transcript: "schedule",
        minutes: 1,
        reading_score: 100,
      }),
    ).toThrow();
  });

  it("rejects a fabricated AI Talking report", () => {
    expect(() =>
      talkingLegacyInputSchema.parse({
        operationKey: key,
        scenario: "travel",
        minutes: 2,
        messages: Array.from({ length: 6 }, (_, index) => ({
          role: index % 2 ? "user" : "assistant",
          content: "A raw conversation message",
        })),
        fluency: 100,
        grammar: 100,
        vocabulary: 100,
      }),
    ).toThrow();
  });
});
