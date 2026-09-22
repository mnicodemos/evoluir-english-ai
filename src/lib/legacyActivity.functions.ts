import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { conversationReportMessages, parseConversationReport } from "@/lib/ai-prompts";
import {
  listeningLegacyInputSchema,
  pronunciationLegacyInputSchema,
  quizLegacyInputSchema,
  talkingLegacyInputSchema,
  telemetryInputSchema,
} from "@/lib/legacyActivity.schemas";
import { listeningAnswerScore, pronunciationSimilarity } from "@/lib/legacyScores";
import {
  activityItemLevel,
  persistActivityEvidence,
} from "@/lib/pedagogy/dualWrite.functions";
import {
  LISTENING_RUBRIC_VERSION,
  PRONUNCIATION_RUBRIC_VERSION,
  SPEAKING_RUBRIC_VERSION,
  listeningEvidence,
  pronunciationEvidence,
  speakingEvidence,
  speakingEvidenceDecision,
} from "@/lib/pedagogy/activityEvidence";
import { toleratePedagogicalFailure as tolerateEvidence } from "@/lib/pedagogy/dualWrite";


async function deterministicUuid(value: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes.slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const writingLegacyInputSchema = z
  .object({
    operationKey: z.string().uuid(),
    minutes: z.number().int().min(0).max(1440),
  })
  .strict();

const STATIC_LISTENING = new Set([
  "I get up early every morning.",
  "Let's grab a coffee after work.",
  "She lives near the train station.",
  "I forgot my keys at home.",
  "We are having dinner outside tonight.",
  "It looks like rain this afternoon.",
  "Could you send me the report?",
  "We must call the client today.",
  "The deadline moved to next month.",
  "Let's schedule a quick call tomorrow.",
  "I need support with this presentation.",
  "The team delivered the first version.",
  "Where is the gate for Lisbon?",
  "I have a reservation for tonight.",
  "How do I reach the station?",
  "Is breakfast included in the price?",
  "A table for two, please.",
  "My luggage did not arrive today.",
]);

async function adminClient() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function persist(params: {
  userId: string;
  sourceType: "quiz" | "writing" | "listening" | "pronunciation" | "talking" | "telemetry";
  operationKey: string;
  sourceId?: string | null;
  activityType: string;
  title: string;
  minutes: number;
  score?: number | null;
  scores?: Record<string, number>;
  result?: Record<string, unknown>;
}) {
  const admin = await adminClient();
  const { data, error } = await admin.rpc("persist_authoritative_legacy_activity", {
    p_user_id: params.userId,
    p_source_type: params.sourceType,
    p_operation_key: params.operationKey,
    p_source_id: (params.sourceId ?? null) as unknown as string,
    p_activity_type: params.activityType,
    p_title: params.title,
    p_duration_minutes: params.minutes,
    p_score: (params.score ?? null) as unknown as number,
    p_scores: (params.scores ?? {}) as Json,
    p_result: (params.result ?? {}) as Json,
  });
  if (error)
    throw new Error(
      error.code === "P0001" ? "IDEMPOTENCY_CONFLICT" : "Progress could not be saved",
    );
  return data;
}

export const logPracticeTelemetry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => telemetryInputSchema.parse(input))
  .handler(async ({ data, context }) =>
    persist({
      userId: context.userId,
      sourceType: "telemetry",
      operationKey: data.operationKey,
      activityType: data.activityType,
      title: data.activityType.replaceAll("_", " "),
      minutes: data.minutes,
    }),
  );

export const persistQuizLegacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => quizLegacyInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    const { data: result, error } = await admin
      .from("quiz_results")
      .select("id, user_id, lesson_id, score, correct_count, total_questions")
      .eq("id", data.attemptKey)
      .maybeSingle();
    if (error || !result || result.user_id !== context.userId)
      throw new Error("Authoritative quiz result not found");
    const { data: lesson } = await admin
      .from("lessons")
      .select("title")
      .eq("id", result.lesson_id ?? "")
      .maybeSingle();
    return persist({
      userId: context.userId,
      sourceType: "quiz",
      operationKey: data.attemptKey,
      sourceId: result.id,
      activityType: data.activityType,
      title:
        data.activityType === "final_test"
          ? `Final Test: ${lesson?.title ?? ""}`
          : `Lesson: ${lesson?.title ?? ""}`,
      minutes: data.minutes,
      score: result.score,
      result: { correct: result.correct_count, total: result.total_questions },
    });
  });

export const persistWritingLegacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => writingLegacyInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const sourceId = await deterministicUuid(
      `writing-submission:${context.userId}:writing:${data.operationKey}`,
    );
    const admin = await adminClient();
    const { data: row, error } = await admin
      .from("writing_submissions")
      .select("id, user_id, grammar_score, vocabulary_score, clarity_score")
      .eq("id", sourceId)
      .maybeSingle();
    if (error || !row || row.user_id !== context.userId)
      throw new Error("Authoritative writing result not found");
    const score = Math.round(
      (Number(row.grammar_score) + Number(row.vocabulary_score) + Number(row.clarity_score)) / 3,
    );
    return persist({
      userId: context.userId,
      sourceType: "writing",
      operationKey: data.operationKey,
      sourceId: row.id,
      activityType: "writing",
      title: "Writing correction",
      minutes: data.minutes,
      score,
      scores: { writing: score },
    });
  });

export const persistListeningLegacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listeningLegacyInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    const { data: lessons } = await admin.from("lessons").select("summary, transcript");
    const corpus = (lessons ?? [])
      .map((lesson) => `${lesson.summary} ${lesson.transcript}`)
      .join(" ")
      .toLowerCase();
    for (const item of data.evidence) {
      if (
        !STATIC_LISTENING.has(item.expected) &&
        !corpus.includes(item.expected.replace(/[.!?]$/, "").toLowerCase())
      ) {
        throw new Error("Listening evidence is not part of the course");
      }
    }
    const itemScores = data.evidence.map((item) =>
      Math.max(...item.transcripts.map((text) => listeningAnswerScore(item.expected, text))),
    );
    const score = Math.round(itemScores.reduce((sum, value) => sum + value, 0) / itemScores.length);
    const saved = await persist({
      userId: context.userId,
      sourceType: "listening",
      operationKey: data.operationKey,
      activityType: "listening",
      title: `Listening Lab: ${data.trackId}`,
      minutes: data.minutes,
      score,
      scores: { listening: score },
      result: { round: data.round, itemScores },
    });
    // Phase 26: the same measured answers also feed the existing evidence
    // pipeline. A pedagogical failure never breaks the finished activity.
    await tolerateEvidence(async () =>
      persistActivityEvidence({
        userId: context.userId,
        sourceType: "listening",
        operationKey: data.operationKey,
        rubricVersion: LISTENING_RUBRIC_VERSION,
        evidence: listeningEvidence({
          itemScores,
          round: data.round,
          itemCefr: await activityItemLevel(context.userId),
        }),
      }),
    );
    return saved;
  });


export const persistPronunciationLegacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => pronunciationLegacyInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    const { data: word, error } = await admin
      .from("vocabulary")
      .select("id, word")
      .eq("id", data.wordId)
      .maybeSingle();
    if (error || !word) throw new Error("Vocabulary word not found");
    const score = Math.round(pronunciationSimilarity(word.word, data.transcript) * 100);
    const saved = await persist({
      userId: context.userId,
      sourceType: "pronunciation",
      operationKey: data.operationKey,
      sourceId: word.id,
      activityType: "vocabulary",
      title: `Vocabulary practice — ${word.word}`,
      minutes: data.minutes,
      score,
      scores: { reading: score },
      result: { transcript: data.transcript },
    });
    return { score, saved };
  });

export const finishTalkingLegacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => talkingLegacyInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    const { data: existing } = await admin
      .from("activities")
      .select("result, score")
      .eq("user_id", context.userId)
      .eq("source_type", "talking")
      .eq("operation_key", data.operationKey)
      .maybeSingle();
    if (existing?.result) return parseConversationReport(JSON.stringify(existing.result));
    const { callGateway } = await import("@/lib/ai-gateway.server");
    // The speaking rubric level comes from the stored profile, never from the browser.
    const { data: profile } = await admin
      .from("profiles")
      .select("level")
      .eq("id", context.userId)
      .maybeSingle();
    const raw = await callGateway(
      conversationReportMessages(data.messages, profile?.level ?? null),
      true,
      { userId: context.userId, operation: "talking" },
    );
    const report = parseConversationReport(raw);
    const score = Math.round((report.fluency + report.grammar + report.vocabulary) / 3);
    await persist({
      userId: context.userId,
      sourceType: "talking",
      operationKey: data.operationKey,
      activityType: "conversation",
      title: `${data.scenario} speaking session`,
      minutes: data.minutes,
      score,
      scores: { speaking: report.fluency },
      result: report,
    });
    if (report.common_errors.length) {
      const { data: current } = await admin
        .from("learning_profile")
        .select("common_errors")
        .eq("user_id", context.userId)
        .maybeSingle();
      const commonErrors = Array.from(
        new Set([...(current?.common_errors ?? []), ...report.common_errors]),
      ).slice(-12);
      await admin
        .from("learning_profile")
        .upsert(
          { user_id: context.userId, common_errors: commonErrors },
          { onConflict: "user_id" },
        );
    }
    return report;
  });
