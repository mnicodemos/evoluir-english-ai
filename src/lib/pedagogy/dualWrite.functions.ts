import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import { parseWritingFeedback, writingCorrectionMessages } from "@/lib/ai-prompts";
import { expectedLengthLabel, writingLevelConfig } from "@/lib/writingLevels";
import { callGateway } from "@/lib/ai-gateway.server";

import { aggregateSkillEvidence } from "./aggregateSkill";
import { itemLevelFromStoredLevel, measuredCefr } from "./cefr";
import {
  type AssessmentEvidence,
  evidenceSourceTypeSchema,
  evaluatorSchema,
  pedagogicalSkillSchema,
  type PedagogicalSkill,
} from "./contracts";
import {
  classifyQuizEvidence,
  parseQuizDetails,
  QUIZ_RUBRIC_VERSION,
  writingEvidence,
  writingSubmissionRecord,
  WRITING_RUBRIC_VERSION,
} from "./dualWrite";
import {
  authoritativeQuizInputSchema,
  authoritativeWritingInputSchema,
  gradeQuizAnswers,
  writingFeedbackFromRow,
} from "./authoritativeSources";

const retryInputSchema = z.object({ limit: z.number().int().min(1).max(5).default(3) }).strict();

type AdminClient = SupabaseClient<Database>;
type SourceType = "quiz" | "writing" | "teacher";
type FailureStage =
  | "source"
  | "authorization"
  | "validation"
  | "session"
  | "evidence"
  | "aggregation"
  | "skill_result"
  | "cefr_calculation"
  | "finalization"
  | "idempotency";
type FailureCode =
  | "MISSING_PEDAGOGICAL_MAPPING"
  | "SESSION_CREATION_FAILED"
  | "EVIDENCE_PERSIST_FAILED"
  | "AGGREGATION_FAILED"
  | "SKILL_RESULT_FAILED"
  | "CEFR_CALCULATION_FAILED"
  | "FINALIZATION_FAILED"
  | "AUTHORIZATION_FAILED"
  | "VALIDATION_FAILED"
  | "IDEMPOTENCY_CONFLICT";

class PedagogicalWriteError extends Error {
  constructor(
    readonly stage: FailureStage,
    readonly code: FailureCode,
    message: string,
  ) {
    super(message);
    this.name = "PedagogicalWriteError";
  }
}

export async function deterministicUuid(value: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes.slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sanitizedMessage(error: unknown) {
  if (error instanceof PedagogicalWriteError) return error.message.slice(0, 240);
  return "Pedagogical processing failed";
}

function classifyFailure(error: unknown): { stage: FailureStage; code: FailureCode } {
  if (error instanceof PedagogicalWriteError) return { stage: error.stage, code: error.code };
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "23505" || error.code === "P0001") {
      return { stage: "idempotency", code: "IDEMPOTENCY_CONFLICT" };
    }
    if (error.code === "23514" || error.code === "23503" || error.code === "22023") {
      return { stage: "validation", code: "VALIDATION_FAILED" };
    }
  }
  return { stage: "evidence", code: "EVIDENCE_PERSIST_FAILED" };
}

async function recordFailure(
  admin: AdminClient,
  userId: string,
  sourceType: SourceType,
  sourceId: string,
  idempotencyKey: string,
  error: unknown,
) {
  const failure = classifyFailure(error);
  const { error: recordError } = await admin.rpc("record_pedagogical_failure", {
    p_user_id: userId,
    p_source_type: sourceType,
    p_source_id: sourceId,
    p_idempotency_key: idempotencyKey,
    p_stage: failure.stage,
    p_error_code: failure.code,
    p_error_message: sanitizedMessage(error),
    p_already_claimed: false,
  });
  if (recordError) console.error("Pedagogical failure record could not be persisted");
}

async function resolveFailure(admin: AdminClient, userId: string, idempotencyKey: string) {
  const now = new Date().toISOString();
  await admin
    .from("pedagogical_dual_write_failures")
    .update({
      status: "completed",
      resolved_at: now,
      completed_at: now,
      processing_started_at: null,
      next_retry_at: null,
    })
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey);
}

async function recordClaimedFailure(
  admin: AdminClient,
  userId: string,
  sourceType: SourceType,
  sourceId: string,
  idempotencyKey: string,
  claimedAt: string,
  error: unknown,
) {
  const failure = classifyFailure(error);
  const { error: recordError } = await admin.rpc("record_claimed_pedagogical_failure", {
    p_user_id: userId,
    p_source_type: sourceType,
    p_source_id: sourceId,
    p_idempotency_key: idempotencyKey,
    p_stage: failure.stage,
    p_error_code: failure.code,
    p_error_message: sanitizedMessage(error),
    p_claimed_at: claimedAt,
  });
  if (recordError) console.error("Claimed pedagogical failure could not be persisted");
}

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AdminClient;
}

async function lessonItemLevel(admin: AdminClient, lessonId: string | null) {
  if (!lessonId) return null;
  const { data } = await admin.from("lessons").select("level").eq("id", lessonId).maybeSingle();
  return data?.level ? itemLevelFromStoredLevel(data.level) : null;
}

async function profileItemLevel(admin: AdminClient, userId: string) {
  const { data } = await admin.from("profiles").select("level").eq("id", userId).maybeSingle();
  return data?.level ? itemLevelFromStoredLevel(data.level) : null;
}

async function persistEvidenceAndResults(params: {
  admin: AdminClient;
  userId: string;
  sourceType: SourceType;
  sourceId: string;
  idempotencyKey: string;
  rubricVersion: string;
  evidence: AssessmentEvidence[];
  claimedAt?: string;
}) {
  const { admin, userId, sourceType, sourceId, idempotencyKey, rubricVersion } = params;
  const sessionId = await deterministicUuid(`pedagogy-session:${userId}:${idempotencyKey}`);
  const skills = [...new Set(params.evidence.map((item) => item.skill))];
  const results = [];
  for (const skill of skills) {
    const { data, error } = await admin
      .from("assessment_evidence")
      .select(
        "id, skill, subskill, source_type, source_id, item_cefr, raw_score, source_reliability, evidence_quality, sample_weight, evaluated_by, model_version, rubric_version",
      )
      .eq("user_id", userId)
      .eq("skill", skill)
      .order("created_at", { ascending: true });
    if (error) {
      throw new PedagogicalWriteError(
        "aggregation",
        "AGGREGATION_FAILED",
        "Could not load evidence history",
      );
    }
    const history: AssessmentEvidence[] = (data ?? []).map((row) => ({
      id: row.id,
      skill: pedagogicalSkillSchema.parse(row.skill),
      subskill: row.subskill,
      sourceType: evidenceSourceTypeSchema.parse(row.source_type),
      sourceId: row.source_id,
      itemCefr: measuredCefr(row.item_cefr),
      rawScore: row.raw_score,
      sourceReliability: row.source_reliability,
      evidenceQuality: row.evidence_quality,
      sampleWeight: row.sample_weight,
      evaluatedBy: evaluatorSchema.parse(row.evaluated_by),
      modelVersion: row.model_version,
      rubricVersion: row.rubric_version,
    }));
    let result;
    try {
      result = aggregateSkillEvidence(skill as PedagogicalSkill, [
        ...history,
        ...params.evidence.filter((item) => item.skill === skill),
      ]);
    } catch {
      throw new PedagogicalWriteError(
        "cefr_calculation",
        "CEFR_CALCULATION_FAILED",
        "Could not calculate the pedagogical result",
      );
    }
    results.push({
      id: await deterministicUuid(`pedagogy-result:${sessionId}:${skill}`),
      skill,
      score: result.score,
      cefr_level: result.cefr,
      confidence_score: result.confidence,
      evidence_count: result.evidenceCount,
      rule_version: result.ruleVersion,
    });
  }
  const evidence = await Promise.all(
    params.evidence.map(async (item) => ({
      id: await deterministicUuid(
        `pedagogy-evidence:${userId}:${sourceType}:${sourceId}:${item.sourceItemId ?? "source"}:${item.skill}:${item.subskill ?? ""}:${item.evidenceType ?? ""}`,
      ),
      skill: item.skill,
      subskill: item.subskill ?? "",
      source_item_id: item.sourceItemId ?? "",
      evidence_type: item.evidenceType ?? "",
      polarity: item.polarity ?? "",
      item_cefr: item.itemCefr ?? "",
      raw_score: item.rawScore,
      source_reliability: item.sourceReliability,
      evidence_quality: item.evidenceQuality,
      sample_weight: item.sampleWeight,
      evaluated_by: item.evaluatedBy,
      model_version: item.modelVersion ?? "",
      rubric_version: item.rubricVersion,
      metadata: item.metadata ?? {},
    })),
  );
  const { data, error } = await admin.rpc("persist_pedagogical_bundle", {
    p_user_id: userId,
    p_session_id: sessionId,
    p_source_type: sourceType,
    p_source_id: sourceId,
    p_idempotency_key: idempotencyKey,
    p_rubric_version: rubricVersion,
    p_evidence: evidence as unknown as Json,
    p_results: results as unknown as Json,
  });
  if (error) {
    const classified = classifyFailure(error);
    throw new PedagogicalWriteError(
      classified.stage,
      classified.code,
      "Atomic pedagogical persistence failed",
    );
  }
  if (params.claimedAt) {
    await admin.rpc("resolve_claimed_pedagogical_failure", {
      p_user_id: userId,
      p_idempotency_key: idempotencyKey,
      p_claimed_at: params.claimedAt,
    });
  } else {
    await resolveFailure(admin, userId, idempotencyKey);
  }
  const payload = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  return {
    duplicate: payload["duplicate"] === true,
    evidenceCount: typeof payload["evidence_count"] === "number" ? payload["evidence_count"] : 0,
  };
}

async function processQuiz(
  admin: AdminClient,
  userId: string,
  quizResultId: string,
  claimedAt?: string,
) {
  const key = `quiz:${quizResultId}`;
  const { data: result, error } = await admin
    .from("quiz_results")
    .select("id, user_id, lesson_id, details")
    .eq("id", quizResultId)
    .maybeSingle();
  if (error || !result || result.user_id !== userId) {
    throw new PedagogicalWriteError(
      "authorization",
      "AUTHORIZATION_FAILED",
      "Quiz source is unavailable",
    );
  }
  const details = parseQuizDetails(result.details);
  const ids = details.flatMap((detail) => (detail.question_id ? [detail.question_id] : []));
  if (ids.length === 0) {
    if (claimedAt) {
      await admin.rpc("resolve_claimed_pedagogical_failure", {
        p_user_id: userId,
        p_idempotency_key: key,
        p_claimed_at: claimedAt,
      });
    }
    return { duplicate: false, evidenceCount: 0 };
  }
  const { data: questions, error: questionError } = await admin
    .from("quizzes")
    .select("id, pedagogical_skill")
    .in("id", ids);
  if (questionError)
    throw new PedagogicalWriteError(
      "source",
      "VALIDATION_FAILED",
      "Quiz questions are unavailable",
    );
  const skills = new Map(
    (questions ?? [])
      .filter(
        (question) =>
          question.pedagogical_skill === "grammar" || question.pedagogical_skill === "vocabulary",
      )
      .map((question) => [question.id, question.pedagogical_skill as "grammar" | "vocabulary"]),
  );
  // The item level comes from the lesson the quiz belongs to, server-side only.
  const classified = classifyQuizEvidence(
    details,
    skills,
    await lessonItemLevel(admin, result.lesson_id),
  );
  const persisted = classified.evidence.length
    ? await persistEvidenceAndResults({
        admin,
        userId,
        sourceType: "quiz",
        sourceId: result.id,
        idempotencyKey: key,
        rubricVersion: QUIZ_RUBRIC_VERSION,
        evidence: classified.evidence,
        ...(claimedAt ? { claimedAt } : {}),
      })
    : { duplicate: false, evidenceCount: 0 };
  if (classified.missingQuestionIds.length > 0) {
    throw new PedagogicalWriteError(
      "source",
      "MISSING_PEDAGOGICAL_MAPPING",
      `${classified.missingQuestionIds.length} Quiz question(s) lack a valid pedagogical mapping`,
    );
  }
  return persisted;
}

async function processWriting(
  admin: AdminClient,
  userId: string,
  submissionId: string,
  key: string,
  claimedAt?: string,
) {
  const { data: row, error } = await admin
    .from("writing_submissions")
    .select("id, user_id, grammar_score, vocabulary_score, clarity_score")
    .eq("id", submissionId)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error || !row || row.user_id !== userId) {
    throw new PedagogicalWriteError(
      "authorization",
      "AUTHORIZATION_FAILED",
      "Writing source is unavailable",
    );
  }
  return persistEvidenceAndResults({
    admin,
    userId,
    sourceType: "writing",
    sourceId: row.id,
    idempotencyKey: key,
    rubricVersion: WRITING_RUBRIC_VERSION,
    evidence: writingEvidence(
      {
        grammar: row.grammar_score,
        vocabulary: row.vocabulary_score,
        clarity: row.clarity_score,
      },
      // The task and the correction rubric belong to the stored profile level.
      await profileItemLevel(admin, userId),
    ),
    ...(claimedAt ? { claimedAt } : {}),
  });
}

async function processQuizResultSafely(admin: AdminClient, userId: string, quizResultId: string) {
  const key = `quiz:${quizResultId}`;
  try {
    return { ok: true, ...(await processQuiz(admin, userId, quizResultId)) };
  } catch (error) {
    await recordFailure(admin, userId, "quiz", quizResultId, key, error);
    console.error("Quiz pedagogical dual write failed", classifyFailure(error).code);
    return { ok: false, duplicate: false, evidenceCount: 0 };
  }
}

async function processWritingSafely(
  admin: AdminClient,
  userId: string,
  submissionId: string,
  key: string,
) {
  try {
    return { ok: true, ...(await processWriting(admin, userId, submissionId, key)) };
  } catch (error) {
    await recordFailure(admin, userId, "writing", submissionId, key, error);
    console.error("Writing pedagogical dual write failed", classifyFailure(error).code);
    return { ok: false, duplicate: false, evidenceCount: 0 };
  }
}

/**
 * Persists AI Teacher evidence through the SAME pedagogical pipeline used by Quiz
 * and Writing (session -> evidence -> skill result -> aggregation). A failure here
 * never invalidates the answer the student already received: it is recorded as an
 * observable, non-retryable pedagogical failure (a conversational turn cannot be
 * replayed from persisted state).
 */
export async function persistTeacherEvidence(params: {
  userId: string;
  turnId: string;
  rubricVersion: string;
  evidence: AssessmentEvidence[];
}) {
  const admin = await loadAdmin();
  const key = `teacher:${params.turnId}`;
  try {
    const result = await persistEvidenceAndResults({
      admin,
      userId: params.userId,
      sourceType: "teacher",
      sourceId: params.turnId,
      idempotencyKey: key,
      rubricVersion: params.rubricVersion,
      evidence: params.evidence,
    });
    return { ok: true, ...result };
  } catch (error) {
    await recordFailure(admin, params.userId, "teacher", params.turnId, key, error);
    console.error("Teacher pedagogical write failed", classifyFailure(error).code);
    return { ok: false, duplicate: false, evidenceCount: 0 };
  }
}

/**
 * Phase 26: the SAME pipeline for the other activities that already produce a
 * server-derived result (Listening Lab, Speaking session, Pronunciation). A
 * failure is recorded and never breaks the activity the student just finished.
 */
export async function persistActivityEvidence(params: {
  userId: string;
  sourceType: "listening" | "speaking" | "pronunciation";
  operationKey: string;
  evidence: AssessmentEvidence[];
  rubricVersion: string;
}) {
  if (params.evidence.length === 0) return { ok: true, duplicate: false, evidenceCount: 0 };
  const admin = await loadAdmin();
  const key = `${params.sourceType}:${params.operationKey}`;
  const sourceId = await deterministicUuid(`activity-source:${params.userId}:${key}`);
  try {
    const result = await persistEvidenceAndResults({
      admin,
      userId: params.userId,
      sourceType: params.sourceType,
      sourceId,
      idempotencyKey: key,
      rubricVersion: params.rubricVersion,
      evidence: params.evidence,
    });
    return { ok: true, ...result };
  } catch (error) {
    await recordFailure(admin, params.userId, params.sourceType, sourceId, key, error);
    console.error("Activity pedagogical write failed", classifyFailure(error).code);
    return { ok: false, duplicate: false, evidenceCount: 0 };
  }
}

/** Server-owned CEFR level of the student, reused for activities without one. */
export async function activityItemLevel(userId: string) {
  return profileItemLevel(await loadAdmin(), userId);
}

export const submitAuthoritativeQuiz = createServerFn({ method: "POST" })

  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => authoritativeQuizInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await loadAdmin();
    const { data: existing, error: existingError } = await admin
      .from("quiz_results")
      .select("id, user_id, lesson_id, score, total_questions, correct_count, details")
      .eq("id", data.attemptKey)
      .maybeSingle();
    if (existingError) throw new Error("Quiz attempt could not be checked");
    if (existing) {
      if (existing.user_id !== context.userId || existing.lesson_id !== data.lessonId) {
        throw new PedagogicalWriteError(
          "idempotency",
          "IDEMPOTENCY_CONFLICT",
          "Quiz attempt identity was reused",
        );
      }
      const details = parseQuizDetails(existing.details);
      const submitted = new Map(data.answers.map((answer) => [answer.questionId, answer.answer]));
      if (
        details.length !== data.answers.length ||
        details.some(
          (detail) => !detail.question_id || submitted.get(detail.question_id) !== detail.answer,
        )
      ) {
        throw new PedagogicalWriteError(
          "idempotency",
          "IDEMPOTENCY_CONFLICT",
          "Quiz attempt identity was reused with different answers",
        );
      }
      await processQuizResultSafely(admin, context.userId, existing.id);
      return {
        resultId: existing.id,
        score: existing.score,
        total: existing.total_questions,
        correct: existing.correct_count,
        details,
      };
    }

    const { data: questions, error: questionError } = await admin
      .from("quizzes")
      .select("id, question, correct_answer, sort_order")
      .eq("lesson_id", data.lessonId)
      .order("sort_order");
    if (questionError) throw new Error("Quiz questions are unavailable");
    let graded;
    try {
      graded = gradeQuizAnswers(questions ?? [], data.answers);
    } catch (error) {
      throw new PedagogicalWriteError(
        "validation",
        "VALIDATION_FAILED",
        error instanceof Error ? error.message : "Quiz answers are invalid",
      );
    }
    const { error: insertError } = await admin.from("quiz_results").insert({
      id: data.attemptKey,
      attempt_key: data.attemptKey,
      user_id: context.userId,
      lesson_id: data.lessonId,
      score: graded.score,
      total_questions: graded.total,
      correct_count: graded.correct,
      details: graded.details,
    });
    if (insertError && insertError.code !== "23505")
      throw new Error("Quiz result could not be saved");
    if (insertError?.code === "23505") {
      const { data: concurrent } = await admin
        .from("quiz_results")
        .select("id, user_id, lesson_id, score, total_questions, correct_count, details")
        .eq("id", data.attemptKey)
        .maybeSingle();
      const concurrentDetails = parseQuizDetails(concurrent?.details);
      if (
        !concurrent ||
        concurrent.user_id !== context.userId ||
        concurrent.lesson_id !== data.lessonId ||
        concurrentDetails.length !== graded.details.length ||
        concurrentDetails.some(
          (detail, index) =>
            detail.question_id !== graded.details[index]?.question_id ||
            detail.answer !== graded.details[index]?.answer,
        )
      ) {
        throw new PedagogicalWriteError(
          "idempotency",
          "IDEMPOTENCY_CONFLICT",
          "Quiz attempt was submitted concurrently with different answers",
        );
      }
      await processQuizResultSafely(admin, context.userId, concurrent.id);
      return {
        resultId: concurrent.id,
        score: concurrent.score,
        total: concurrent.total_questions,
        correct: concurrent.correct_count,
        details: concurrentDetails,
      };
    }
    await processQuizResultSafely(admin, context.userId, data.attemptKey);
    return { resultId: data.attemptKey, ...graded };
  });

export const analyseAuthoritativeWriting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => authoritativeWritingInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await loadAdmin();
    const key = `writing:${data.operationKey}`;
    const submissionId = await deterministicUuid(`writing-submission:${context.userId}:${key}`);
    const { data: existing, error: existingError } = await admin
      .from("writing_submissions")
      .select(
        "id, user_id, prompt, original_text, corrected_text, natural_text, explanations, suggestions, grammar_score, vocabulary_score, clarity_score",
      )
      .eq("id", submissionId)
      .maybeSingle();
    if (existingError) throw new Error("Writing operation could not be checked");
    if (existing) {
      if (
        existing.user_id !== context.userId ||
        existing.prompt !== data.prompt ||
        existing.original_text !== data.originalText
      ) {
        throw new PedagogicalWriteError(
          "idempotency",
          "IDEMPOTENCY_CONFLICT",
          "Writing operation identity was reused",
        );
      }
      await processWritingSafely(admin, context.userId, submissionId, key);
      return { sourceId: submissionId, feedback: writingFeedbackFromRow(existing) };
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("level")
      .eq("id", context.userId)
      .maybeSingle();
    if (profileError) throw new Error("Writing level could not be loaded");
    // The CEFR context for the correction is resolved from the stored profile,
    // never from anything the browser sent.
    const writingConfig = writingLevelConfig(profile?.level ?? null);
    const raw = await callGateway(
      writingCorrectionMessages(data.prompt, data.originalText, profile?.level ?? "intermediate", {
        label: writingConfig.label,
        expectedLength: expectedLengthLabel(writingConfig),
        focus: writingConfig.focus,
        priorities: writingConfig.priorities,
      }),
      true,
      { userId: context.userId, operation: "writing_correction" },
    );
    const feedback = parseWritingFeedback(raw, data.originalText);
    const record = writingSubmissionRecord({
      id: submissionId,
      userId: context.userId,
      idempotencyKey: key,
      prompt: data.prompt,
      originalText: data.originalText,
      feedback,
    });
    const { error: insertError } = await admin.from("writing_submissions").insert(record);
    if (insertError && insertError.code !== "23505")
      throw new Error("Writing result could not be saved");
    if (insertError?.code === "23505") {
      const { data: concurrent } = await admin
        .from("writing_submissions")
        .select(
          "id, user_id, prompt, original_text, corrected_text, natural_text, explanations, suggestions, grammar_score, vocabulary_score, clarity_score",
        )
        .eq("id", submissionId)
        .maybeSingle();
      if (
        !concurrent ||
        concurrent.user_id !== context.userId ||
        concurrent.prompt !== data.prompt ||
        concurrent.original_text !== data.originalText
      ) {
        throw new PedagogicalWriteError(
          "idempotency",
          "IDEMPOTENCY_CONFLICT",
          "Writing operation was submitted concurrently with different content",
        );
      }
      await processWritingSafely(admin, context.userId, submissionId, key);
      return { sourceId: submissionId, feedback: writingFeedbackFromRow(concurrent) };
    }
    await processWritingSafely(admin, context.userId, submissionId, key);
    return { sourceId: submissionId, feedback };
  });

export const retryPendingPedagogicalWrites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => retryInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await loadAdmin();
    const { data: failures, error: claimError } = await admin.rpc("claim_pedagogical_retries", {
      p_user_id: context.userId,
      p_limit: data.limit,
      p_stale_seconds: 300,
    });
    if (claimError) throw new Error("Pedagogical retries could not be claimed");
    let completed = 0;
    for (const failure of failures ?? []) {
      if (
        !failure.source_id ||
        (failure.source_type !== "quiz" && failure.source_type !== "writing")
      )
        continue;
      const { data: claimed } = await admin
        .from("pedagogical_dual_write_failures")
        .update({ status: "retrying" })
        .eq("id", failure.id)
        .eq("user_id", context.userId)
        .eq("status", "processing")
        .eq("processing_started_at", failure.claimed_at)
        .select("id")
        .maybeSingle();
      if (!claimed) continue;
      try {
        if (failure.source_type === "quiz") {
          await processQuiz(admin, context.userId, failure.source_id, failure.claimed_at);
        } else {
          await processWriting(
            admin,
            context.userId,
            failure.source_id,
            failure.idempotency_key,
            failure.claimed_at,
          );
        }
        completed += 1;
      } catch (error) {
        await recordClaimedFailure(
          admin,
          context.userId,
          failure.source_type,
          failure.source_id,
          failure.idempotency_key,
          failure.claimed_at,
          error,
        );
      }
    }
    return { processed: failures?.length ?? 0, completed };
  });
