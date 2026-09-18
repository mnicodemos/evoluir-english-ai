import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";

import { aggregateSkillEvidence } from "./aggregateSkill";
import {
  type AssessmentEvidence,
  evidenceSourceTypeSchema,
  evaluatorSchema,
  pedagogicalSkillSchema,
  type PedagogicalSkill,
} from "./contracts";
import {
  parseQuizDetails,
  quizEvidence,
  QUIZ_RUBRIC_VERSION,
  writingEvidence,
  writingSubmissionRecord,
  WRITING_RUBRIC_VERSION,
} from "./dualWrite";

const quizInputSchema = z.object({ quizResultId: z.string().uuid() }).strict();
const writingInputSchema = z
  .object({
    operationKey: z.string().uuid(),
    prompt: z.string().max(2000),
    originalText: z.string().trim().min(1).max(12000),
    feedback: z
      .object({
        corrected: z.string().min(1).max(12000),
        natural: z.string().min(1).max(12000),
        explanations: z.array(z.string().min(1).max(500)).max(20),
        suggestions: z.array(z.string().min(1).max(500)).max(10),
        grammar: z.number().finite().min(0).max(100),
        vocabulary: z.number().finite().min(0).max(100),
        clarity: z.number().finite().min(0).max(100),
      })
      .strict(),
  })
  .strict();
const retryInputSchema = z.object({ limit: z.number().int().min(1).max(5).default(3) }).strict();

type AdminClient = SupabaseClient<Database>;
type SourceType = "quiz" | "writing";
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

function retryable(code: FailureCode) {
  return !["AUTHORIZATION_FAILED", "VALIDATION_FAILED", "IDEMPOTENCY_CONFLICT"].includes(code);
}

async function recordFailure(
  admin: AdminClient,
  userId: string,
  sourceType: SourceType,
  sourceId: string | null,
  idempotencyKey: string,
  error: unknown,
) {
  const failure = classifyFailure(error);
  const { data: existing } = await admin
    .from("pedagogical_dual_write_failures")
    .select("id, attempt_count")
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  const attemptCount = (existing?.attempt_count ?? 0) + 1;
  const delaySeconds = Math.min(3600, 15 * 2 ** Math.min(attemptCount - 1, 8));
  const values = {
    user_id: userId,
    source_type: sourceType,
    source_id: sourceId,
    idempotency_key: idempotencyKey,
    stage: failure.stage,
    error_code: failure.code,
    last_error_message: sanitizedMessage(error),
    status: retryable(failure.code) && attemptCount < 5 ? "pending" : "failed",
    attempt_count: attemptCount,
    last_failed_at: new Date().toISOString(),
    next_retry_at:
      retryable(failure.code) && attemptCount < 5
        ? new Date(Date.now() + delaySeconds * 1000).toISOString()
        : null,
    processing_started_at: null,
    completed_at: null,
    resolved_at: null,
  } as const;
  if (existing) {
    await admin
      .from("pedagogical_dual_write_failures")
      .update(values)
      .eq("id", existing.id)
      .eq("user_id", userId);
  } else {
    await admin.from("pedagogical_dual_write_failures").insert(values);
  }
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

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AdminClient;
}

async function persistEvidenceAndResults(params: {
  admin: AdminClient;
  userId: string;
  sourceType: SourceType;
  sourceId: string;
  idempotencyKey: string;
  rubricVersion: string;
  evidence: AssessmentEvidence[];
}) {
  const { admin, userId, sourceType, sourceId, idempotencyKey, rubricVersion } = params;
  const sessionId = await deterministicUuid(`pedagogy-session:${userId}:${idempotencyKey}`);
  const skills = [...new Set(params.evidence.map((item) => item.skill))];
  const results = [];
  for (const skill of skills) {
    const { data, error } = await admin
      .from("assessment_evidence")
      .select(
        "id, skill, subskill, source_type, source_id, raw_score, source_reliability, evidence_quality, sample_weight, evaluated_by, model_version, rubric_version",
      )
      .eq("user_id", userId)
      .eq("skill", skill)
      .order("created_at", { ascending: true });
    if (error) {
      throw new PedagogicalWriteError("aggregation", "AGGREGATION_FAILED", "Could not load evidence history");
    }
    const history: AssessmentEvidence[] = (data ?? []).map((row) => ({
      id: row.id,
      skill: pedagogicalSkillSchema.parse(row.skill),
      subskill: row.subskill,
      sourceType: evidenceSourceTypeSchema.parse(row.source_type),
      sourceId: row.source_id,
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
      throw new PedagogicalWriteError("cefr_calculation", "CEFR_CALCULATION_FAILED", "Could not calculate the pedagogical result");
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
    throw new PedagogicalWriteError(classified.stage, classified.code, "Atomic pedagogical persistence failed");
  }
  await resolveFailure(admin, userId, idempotencyKey);
  const payload = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  return {
    duplicate: payload["duplicate"] === true,
    evidenceCount: typeof payload["evidence_count"] === "number" ? payload["evidence_count"] : 0,
  };
}

async function processQuiz(admin: AdminClient, userId: string, quizResultId: string) {
  const key = `quiz:${quizResultId}`;
  const { data: result, error } = await admin
    .from("quiz_results")
    .select("id, user_id, details")
    .eq("id", quizResultId)
    .maybeSingle();
  if (error || !result || result.user_id !== userId) {
    throw new PedagogicalWriteError("authorization", "AUTHORIZATION_FAILED", "Quiz source is unavailable");
  }
  const details = parseQuizDetails(result.details);
  const ids = details.flatMap((detail) => (detail.question_id ? [detail.question_id] : []));
  if (ids.length === 0) return { duplicate: false, evidenceCount: 0 };
  const { data: questions, error: questionError } = await admin
    .from("quizzes")
    .select("id, pedagogical_skill")
    .in("id", ids);
  if (questionError) throw new PedagogicalWriteError("source", "VALIDATION_FAILED", "Quiz questions are unavailable");
  const skills = new Map(
    (questions ?? [])
      .filter((question) => question.pedagogical_skill === "grammar" || question.pedagogical_skill === "vocabulary")
      .map((question) => [question.id, question.pedagogical_skill as "grammar" | "vocabulary"]),
  );
  const evidence = details.flatMap((detail) => {
    if (!detail.question_id) return [];
    const skill = skills.get(detail.question_id);
    return skill ? [quizEvidence({ ...detail, question_id: detail.question_id, pedagogical_skill: skill })] : [];
  });
  if (evidence.length === 0) return { duplicate: false, evidenceCount: 0 };
  return persistEvidenceAndResults({
    admin,
    userId,
    sourceType: "quiz",
    sourceId: result.id,
    idempotencyKey: key,
    rubricVersion: QUIZ_RUBRIC_VERSION,
    evidence,
  });
}

async function processWriting(admin: AdminClient, userId: string, submissionId: string, key: string) {
  const { data: row, error } = await admin
    .from("writing_submissions")
    .select("id, user_id, grammar_score, vocabulary_score, clarity_score")
    .eq("id", submissionId)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error || !row || row.user_id !== userId) {
    throw new PedagogicalWriteError("authorization", "AUTHORIZATION_FAILED", "Writing source is unavailable");
  }
  return persistEvidenceAndResults({
    admin,
    userId,
    sourceType: "writing",
    sourceId: row.id,
    idempotencyKey: key,
    rubricVersion: WRITING_RUBRIC_VERSION,
    evidence: writingEvidence({
      grammar: row.grammar_score,
      vocabulary: row.vocabulary_score,
      clarity: row.clarity_score,
    }),
  });
}

export const dualWriteQuizEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => quizInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await loadAdmin();
    const key = `quiz:${data.quizResultId}`;
    try {
      return { ok: true, ...(await processQuiz(admin, context.userId, data.quizResultId)) };
    } catch (error) {
      await recordFailure(admin, context.userId, "quiz", data.quizResultId, key, error);
      console.error("Quiz pedagogical dual write failed", classifyFailure(error).code);
      return { ok: false, duplicate: false, evidenceCount: 0 };
    }
  });

export const dualWriteWritingEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => writingInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await loadAdmin();
    const key = `writing:${data.operationKey}`;
    const submissionId = await deterministicUuid(`writing-submission:${context.userId}:${key}`);
    try {
      const record = writingSubmissionRecord({
        id: submissionId,
        userId: context.userId,
        idempotencyKey: key,
        prompt: data.prompt,
        originalText: data.originalText,
        feedback: data.feedback,
      });
      const { data: existing } = await admin
        .from("writing_submissions")
        .select("original_text, prompt")
        .eq("id", submissionId)
        .maybeSingle();
      if (existing && (existing.original_text !== record.original_text || existing.prompt !== record.prompt)) {
        throw new PedagogicalWriteError("idempotency", "IDEMPOTENCY_CONFLICT", "Writing operation identity was reused");
      }
      const { error } = await admin.from("writing_submissions").insert(record);
      if (error && error.code !== "23505") {
        throw new PedagogicalWriteError("source", "VALIDATION_FAILED", "Writing source could not be persisted");
      }
      return {
        ok: true,
        sourceId: submissionId,
        ...(await processWriting(admin, context.userId, submissionId, key)),
      };
    } catch (error) {
      await recordFailure(admin, context.userId, "writing", submissionId, key, error);
      console.error("Writing pedagogical dual write failed", classifyFailure(error).code);
      return { ok: false, sourceId: submissionId, duplicate: false, evidenceCount: 0 };
    }
  });

export const retryPendingPedagogicalWrites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => retryInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await loadAdmin();
    const now = new Date().toISOString();
    const { data: failures } = await admin
      .from("pedagogical_dual_write_failures")
      .select("id, source_type, source_id, idempotency_key")
      .eq("user_id", context.userId)
      .in("status", ["pending", "failed"])
      .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
      .order("last_failed_at", { ascending: true })
      .limit(data.limit);
    let completed = 0;
    for (const failure of failures ?? []) {
      if (!failure.source_id || (failure.source_type !== "quiz" && failure.source_type !== "writing")) continue;
      await admin
        .from("pedagogical_dual_write_failures")
        .update({ status: "retrying", processing_started_at: now })
        .eq("id", failure.id)
        .eq("user_id", context.userId);
      try {
        if (failure.source_type === "quiz") {
          await processQuiz(admin, context.userId, failure.source_id);
        } else {
          await processWriting(admin, context.userId, failure.source_id, failure.idempotency_key);
        }
        completed += 1;
      } catch (error) {
        await recordFailure(
          admin,
          context.userId,
          failure.source_type,
          failure.source_id,
          failure.idempotency_key,
          error,
        );
      }
    }
    return { processed: failures?.length ?? 0, completed };
  });
