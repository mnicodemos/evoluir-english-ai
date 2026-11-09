import { z } from "zod";

const operationKey = z.string().uuid();
const minutes = z.number().int().min(0).max(1440);

export const telemetryInputSchema = z
  .object({
    operationKey,
    activityType: z.enum([
      "listening_practice",
      "vocabulary_reading",
      "conversation_practice",
      "writing_practice",
      "lesson_practice",
      "final_test_practice",
      // Finished-by-leaving activities: the flashcard review, the AI Teacher
      // chat and the My mistakes reviews have no "finish" button, so their
      // time is saved when the student leaves the screen.
      "flashcards",
      "teacher",
      "mistakes_review",
      "video_call",
      // Life+ AI meditations in English (meditations.ts): minutes only.
      "meditation",
      // Daily reading (dailyReading.ts): minutes only, until it records evidence.
      "reading",
      // English Adventures: elapsed learning time, recorded in minute chunks.
      "english_adventures",
    ]),
    minutes: z.number().int().min(1).max(1440),
  })
  .strict();

export const quizLegacyInputSchema = z
  .object({
    attemptKey: operationKey,
    activityType: z.enum(["lesson", "final_test"]),
    minutes,
  })
  .strict();

export const listeningLegacyInputSchema = z
  .object({
    operationKey,
    trackId: z.enum(["everyday", "professional", "travel"]),
    round: z.number().int().min(0).max(100000),
    minutes,
    evidence: z
      .array(
        z
          .object({
            expected: z.string().trim().min(1).max(300),
            transcripts: z.array(z.string().trim().max(1000)).min(1).max(3),
          })
          .strict(),
      )
      .min(1)
      .max(3),
  })
  .strict();

export const listeningCheckpointInputSchema = z
  .object({
    operationKey, trackId: z.enum(["everyday", "professional", "travel"]),
    round: z.number().int().min(0).max(100000), minutes,
    sessionSentences: z.array(z.string().trim().min(1).max(300)).length(9),
    currentIndex: z.number().int().min(0).max(8),
    scores: z.array(z.number().int().min(0).max(100).nullable()).length(9),
    transcripts: z.array(z.array(z.string().trim().max(1000)).max(3)).length(9),
    evidence: z.array(z.object({ expected: z.string().trim().min(1).max(300), transcripts: z.array(z.string().trim().max(1000)).min(1).max(3) }).strict()).min(1).max(3),
  }).strict();
export const pronunciationLegacyInputSchema = z
  .object({
    operationKey,
    wordId: z.string().uuid(),
    transcript: z.string().trim().max(1000),
    minutes,
  })
  .strict();

export const talkingLegacyInputSchema = z
  .object({
    operationKey,
    scenario: z.enum(["everyday", "professional", "travel"]),
    messages: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: z.string().trim().min(1).max(8000),
          })
          .strict(),
      )
      .min(6)
      .max(60),
    minutes,
  })
  .strict();
