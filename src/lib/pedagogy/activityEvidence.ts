// Phase 26 — multimodal evidence. Pure, deterministic mapping from results the
// server ALREADY computes (Listening Lab answers, the speaking report already
// produced for the conversation, pronunciation similarity) into the EXISTING
// evidence contract. No new AI call, no new score, no new weight concept, no new
// CEFR rule: opening an activity never becomes evidence, only a real result does.

import type { MeasuredCefrLevel } from "./cefr";
import type { AssessmentEvidence } from "./contracts";

export const LISTENING_RUBRIC_VERSION = "listening-answer-v1";
export const SPEAKING_RUBRIC_VERSION = "speaking-conversation-v1";
export const PRONUNCIATION_RUBRIC_VERSION = "pronunciation-similarity-v1";
export const SPEAKING_MODEL_VERSION = "gemini-conversation-report-v1";

const score = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

function polarity(value: number): "positive" | "negative" {
  return value >= 70 ? "positive" : "negative";
}

/**
 * One piece of evidence per answered item, exactly like a quiz answer: the
 * student listened and reproduced the sentence, which is a measurable result.
 */
export function listeningEvidence(input: {
  itemScores: readonly number[];
  round: number;
  itemCefr?: MeasuredCefrLevel | null;
}): AssessmentEvidence[] {
  const usable = input.itemScores.filter((value) => Number.isFinite(value));
  if (usable.length === 0) return [];
  return usable.map((value, index) => ({
    skill: "listening" as const,
    subskill: "listening_comprehension",
    sourceType: "listening" as const,
    evidenceType: "answer" as const,
    polarity: polarity(value),
    itemCefr: input.itemCefr ?? null,
    rawScore: score(value),
    // Same weights as an observed quiz answer: deterministic, item-level signal.
    sourceReliability: 1,
    evidenceQuality: 0.8,
    sampleWeight: 1,
    evaluatedBy: "deterministic" as const,
    rubricVersion: LISTENING_RUBRIC_VERSION,
    metadata: { round: Math.trunc(input.round), item: index + 1 },
  }));
}

export type SpeakingReport = {
  fluency: number;
  grammar: number;
  vocabulary: number;
};

/**
 * Speaking evidence only when the student really spoke: the conversation must
 * carry enough of the student's own production. Reuses the report the session
 * already generated — never a second AI call.
 */
export function speakingEvidenceDecision(input: {
  studentMessages: readonly string[];
}): { assess: true } | { assess: false; reason: string } {
  const real = input.studentMessages.filter(
    (message) => message.trim().split(/\s+/).filter(Boolean).length >= 4,
  );
  if (real.length < 3) return { assess: false, reason: "insufficient_production" };
  return { assess: true };
}

/** Task type of a speaking session, from the student's own turns in it. */
export type SpeakingTaskType = "production" | "spontaneous_use";

/**
 * A speaking session is spontaneous use when the student sustained the
 * conversation with their own longer turns, not just answered the minimum. It is
 * never inferred from the score.
 */
export function speakingTaskType(studentMessages: readonly string[]): SpeakingTaskType {
  const sustained = studentMessages.filter(
    (message) => message.trim().split(/\s+/).filter(Boolean).length >= 8,
  );
  return sustained.length >= 5 ? "spontaneous_use" : "production";
}

export function speakingEvidence(
  report: SpeakingReport,
  itemCefr?: MeasuredCefrLevel | null,
  taskType: SpeakingTaskType = "production",
): AssessmentEvidence[] {
  const subscores: { skill: "speaking" | "grammar" | "vocabulary"; subskill: string; raw: number }[] =
    [
      { skill: "speaking", subskill: "fluency", raw: report.fluency },
      { skill: "grammar", subskill: "speaking_grammar", raw: report.grammar },
      { skill: "vocabulary", subskill: "speaking_vocabulary", raw: report.vocabulary },
    ];
  return subscores
    .filter((item) => Number.isFinite(item.raw))
    .map((item) => ({
      skill: item.skill,
      subskill: item.subskill,
      sourceType: "speaking" as const,
      evidenceType: "subscore" as const,
      polarity: "neutral" as const,
      itemCefr: itemCefr ?? null,
      rawScore: score(item.raw),
      // Same weights as the writing subscores: one AI-graded production.
      sourceReliability: 0.8,
      evidenceQuality: 0.85,
      sampleWeight: 1,
      evaluatedBy: "gemini" as const,
      modelVersion: SPEAKING_MODEL_VERSION,
      rubricVersion: SPEAKING_RUBRIC_VERSION,
      metadata: { criterion: item.subskill, taskType },
    }));
}


/**
 * Pronunciation evidence requires a real attempt: seeing or hearing a word is
 * never evidence, only the student's own recorded attempt is.
 */
export function pronunciationEvidence(input: {
  wordId: string;
  transcript: string;
  score: number;
  itemCefr?: MeasuredCefrLevel | null;
}): AssessmentEvidence[] {
  if (input.transcript.trim().split(/\s+/).filter(Boolean).length === 0) return [];
  return [
    {
      skill: "pronunciation" as const,
      subskill: "word_pronunciation",
      sourceType: "pronunciation" as const,
      sourceItemId: input.wordId,
      evidenceType: "answer" as const,
      polarity: polarity(input.score),
      itemCefr: input.itemCefr ?? null,
      rawScore: score(input.score),
      // A single word is a narrow sample, so it weighs less than a full item set.
      sourceReliability: 1,
      evidenceQuality: 0.6,
      sampleWeight: 0.5,
      evaluatedBy: "deterministic" as const,
      rubricVersion: PRONUNCIATION_RUBRIC_VERSION,
      metadata: { criterion: "word_pronunciation" },
    },
  ];
}
