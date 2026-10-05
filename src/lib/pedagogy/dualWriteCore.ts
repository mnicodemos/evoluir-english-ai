/**
 * Pedagogical dual write: failure bookkeeping, evidence persistence and the
 * quiz/writing/teacher/activity processors shared by the server functions in
 * dualWrite.functions.ts and by other server modules.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/integrations/supabase/types";

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
  WRITING_RUBRIC_VERSION,
} from "./dualWrite";

type AdminClient = SupabaseClient<Database>;
type SourceType = "quiz" | "writing" | "teacher" | "listening" | "speaking" | "pronunciation";
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

export class PedagogicalWriteError extends Error {
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

export async function recordClaimedFailure(
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

export async function loadAdmin() {
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

export async function processQuiz(
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

export async function processWriting(
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

export async function processQuizResultSafely(
  admin: AdminClient,
  userId: string,
  quizResultId: string,
) {
  const key = `quiz:${quizResultId}`;
  try {
    return { ok: true, ...(await processQuiz(admin, userId, quizResultId)) };
  } catch (error) {
    await recordFailure(admin, userId, "quiz", quizResultId, key, error);
    console.error("Quiz pedagogical dual write failed", classifyFailure(error).code);
    return { ok: false, duplicate: false, evidenceCount: 0 };
  }
}

export async function processWritingSafely(
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
