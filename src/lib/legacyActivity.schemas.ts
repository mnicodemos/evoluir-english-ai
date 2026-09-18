import { z } from "zod";

const operationKey = z.string().uuid();
const minutes = z.number().int().min(0).max(1440);

export const telemetryInputSchema = z.object({
  operationKey,
  activityType: z.enum([
    "listening_practice",
    "vocabulary_reading",
    "conversation_practice",
    "writing_practice",
    "lesson_practice",
    "final_test_practice",
  ]),
  minutes: z.number().int().min(1).max(1440),
}).strict();

export const quizLegacyInputSchema = z.object({
  attemptKey: operationKey,
  activityType: z.enum(["lesson", "final_test"]),
  minutes,
}).strict();

export const listeningLegacyInputSchema = z.object({
  operationKey,
  trackId: z.enum(["everyday", "professional", "travel"]),
  round: z.number().int().min(0).max(100000),
  minutes,
  evidence: z.array(z.object({
    expected: z.string().trim().min(1).max(300),
    transcripts: z.array(z.string().trim().max(1000)).min(1).max(3),
  }).strict()).min(1).max(3),
}).strict();

export const pronunciationLegacyInputSchema = z.object({
  operationKey,
  wordId: z.string().uuid(),
  transcript: z.string().trim().max(1000),
  minutes,
}).strict();

export const talkingLegacyInputSchema = z.object({
  operationKey,
  scenario: z.enum(["everyday", "professional", "travel"]),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(8000),
  }).strict()).min(6).max(60),
  minutes,
}).strict();
