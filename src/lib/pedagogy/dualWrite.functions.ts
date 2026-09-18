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
  PEDAGOGY_MODEL_VERSION,
  quizEvidence,
  QUIZ_RUBRIC_VERSION,
  writingEvidence,
  WRITING_RUBRIC_VERSION,
} from "./dualWrite";

const quizInputSchema = z.object({ quizResultId: z.string().uuid() }).strict();
const writingInputSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
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

type AuthenticatedClient = SupabaseClient<Database>;

async function deterministicUuid(value: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes.slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function errorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code.slice(0, 80);
  }
  return "dual_write_failed";
}

async function recordFailure(
  supabase: AuthenticatedClient,
  userId: string,
  sourceType: "quiz" | "writing",
  sourceId: string | null,
  idempotencyKey: string,
  stage: "source" | "session" | "evidence" | "aggregation" | "completion",
  error: unknown,
) {
  const { data: existing } = await supabase
    .from("pedagogical_dual_write_failures")
    .select("id, attempt_count")
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing) {
    await supabase
      .from("pedagogical_dual_write_failures")
      .update({
        stage,
        error_code: errorCode(error),
        status: "pending",
        attempt_count: existing.attempt_count + 1,
        last_failed_at: new Date().toISOString(),
        resolved_at: null,
      })
      .eq("id", existing.id)
      .eq("user_id", userId);
    return;
  }
  await supabase.from("pedagogical_dual_write_failures").insert({
    user_id: userId,
    source_type: sourceType,
    source_id: sourceId,
    idempotency_key: idempotencyKey,
    stage,
    error_code: errorCode(error),
  });
}

async function resolveFailure(
  supabase: AuthenticatedClient,
  userId: string,
  idempotencyKey: string,
) {
  await supabase
    .from("pedagogical_dual_write_failures")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .eq("status", "pending");
}

async function persistEvidenceAndResults(params: {
  supabase: AuthenticatedClient;
  userId: string;
  sourceType: "quiz" | "writing";
  sourceId: string;
  idempotencyKey: string;
  rubricVersion: string;
  evidence: AssessmentEvidence[];
}) {
  const { supabase, userId, sourceType, sourceId, idempotencyKey, rubricVersion } = params;
  const sessionId = await deterministicUuid(`pedagogy-session:${userId}:${idempotencyKey}`);
  const { data: existingSession } = await supabase
    .from("assessment_sessions")
    .select("id, status")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingSession?.status === "completed") {
    await resolveFailure(supabase, userId, idempotencyKey);
    return { duplicate: true, evidenceCount: 0 };
  }
  if (!existingSession) {
    const { error } = await supabase.from("assessment_sessions").insert({
      id: sessionId,
      user_id: userId,
      assessment_type: "progress_check",
      status: "started",
      ruleset_version: "cefr-score-v1",
      rubric_version: rubricVersion,
      source_type: sourceType,
      source_id: sourceId,
      idempotency_key: idempotencyKey,
    });
    if (error && error.code !== "23505") throw error;
  }

  for (const item of params.evidence) {
    const evidenceId = await deterministicUuid(
      `pedagogy-evidence:${userId}:${sourceType}:${sourceId}:${item.sourceItemId ?? "source"}:${item.skill}:${item.subskill ?? ""}:${item.evidenceType ?? ""}`,
    );
    const { error } = await supabase.from("assessment_evidence").insert({
      id: evidenceId,
      assessment_session_id: sessionId,
      user_id: userId,
      skill: item.skill,
      subskill: item.subskill ?? null,
      source_type: sourceType,
      source_id: sourceId,
      source_item_id: item.sourceItemId ?? null,
      evidence_type: item.evidenceType ?? null,
      polarity: item.polarity ?? null,
      item_cefr: item.itemCefr ?? null,
      raw_score: item.rawScore,
      source_reliability: item.sourceReliability,
      evidence_quality: item.evidenceQuality,
      sample_weight: item.sampleWeight,
      evaluated_by: item.evaluatedBy,
      model_version: item.modelVersion ?? null,
      rubric_version: item.rubricVersion,
      metadata: (item.metadata ?? {}) as Json,
    });
    if (error && error.code !== "23505") throw error;
  }

  const skills = [...new Set(params.evidence.map((item) => item.skill))];
  for (const skill of skills) {
    const { data, error } = await supabase
      .from("assessment_evidence")
      .select(
        "id, skill, subskill, source_type, source_id, source_item_id, evidence_type, polarity, item_cefr, raw_score, source_reliability, evidence_quality, sample_weight, evaluated_by, model_version, rubric_version, metadata",
      )
      .eq("user_id", userId)
      .eq("skill", skill)
      .order("created_at", { ascending: true });
    if (error) throw error;
    const history: AssessmentEvidence[] = (data ?? []).map((row) => ({
      id: row.id,
      skill: pedagogicalSkillSchema.parse(row.skill),
      subskill: row.subskill,
      sourceType: evidenceSourceTypeSchema.parse(row.source_type),
      sourceId: row.source_id,
      itemCefr: row.item_cefr,
      rawScore: row.raw_score,
      sourceReliability: row.source_reliability,
      evidenceQuality: row.evidence_quality,
      sampleWeight: row.sample_weight,
      evaluatedBy: evaluatorSchema.parse(row.evaluated_by),
      modelVersion: row.model_version,
      rubricVersion: row.rubric_version,
    }));
    const result = aggregateSkillEvidence(skill as PedagogicalSkill, history);
    const resultId = await deterministicUuid(`pedagogy-result:${sessionId}:${skill}`);
    const { error: resultError } = await supabase.from("assessment_skill_results").insert({
      id: resultId,
      assessment_session_id: sessionId,
      user_id: userId,
      skill,
      score: result.score,
      cefr_level: result.cefr,
      confidence_score: result.confidence,
      evidence_count: result.evidenceCount,
      rule_version: result.ruleVersion,
    });
    if (resultError && resultError.code !== "23505") throw resultError;
  }

  const { error: completionError } = await supabase
    .from("assessment_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("status", "started");
  if (completionError) throw completionError;
  await resolveFailure(supabase, userId, idempotencyKey);
  return { duplicate: false, evidenceCount: params.evidence.length };
}

export const dualWriteQuizEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => quizInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const key = `quiz:${data.quizResultId}`;
    try {
      const { data: result, error } = await context.supabase
        .from("quiz_results")
        .select("id, details")
        .eq("id", data.quizResultId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (error) throw error;
      if (!result) throw new Error("quiz_source_not_found");
      const details = parseQuizDetails(result.details);
      const ids = details.flatMap((detail) => (detail.question_id ? [detail.question_id] : []));
      if (ids.length === 0) return { ok: true, duplicate: false, evidenceCount: 0 };
      const { data: questions, error: questionError } = await context.supabase
        .from("quizzes")
        .select("id, pedagogical_skill")
        .in("id", ids);
      if (questionError) throw questionError;
      const skills = new Map(
        (questions ?? [])
          .filter(
            (question) =>
              question.pedagogical_skill === "grammar" ||
              question.pedagogical_skill === "vocabulary",
          )
          .map((question) => [question.id, question.pedagogical_skill as "grammar" | "vocabulary"]),
      );
      const evidence = details.flatMap((detail) => {
        if (!detail.question_id) return [];
        const skill = skills.get(detail.question_id);
        return skill
          ? [quizEvidence({ ...detail, question_id: detail.question_id, pedagogical_skill: skill })]
          : [];
      });
      if (evidence.length === 0) return { ok: true, duplicate: false, evidenceCount: 0 };
      const persisted = await persistEvidenceAndResults({
        supabase: context.supabase as unknown as AuthenticatedClient,
        userId: context.userId,
        sourceType: "quiz",
        sourceId: result.id,
        idempotencyKey: key,
        rubricVersion: QUIZ_RUBRIC_VERSION,
        evidence,
      });
      return { ok: true, ...persisted };
    } catch (error) {
      await recordFailure(
        context.supabase as unknown as AuthenticatedClient,
        context.userId,
        "quiz",
        data.quizResultId,
        key,
        "evidence",
        error,
      );
      console.error("Quiz pedagogical dual write failed", errorCode(error));
      return { ok: false, duplicate: false, evidenceCount: 0 };
    }
  });

export const dualWriteWritingEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => writingInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const key = `writing:${data.idempotencyKey}`;
    const submissionId = await deterministicUuid(`writing-submission:${context.userId}:${key}`);
    try {
      const { error } = await context.supabase.from("writing_submissions").insert({
        id: submissionId,
        user_id: context.userId,
        idempotency_key: key,
        prompt: data.prompt,
        original_text: data.originalText,
        corrected_text: data.feedback.corrected,
        natural_text: data.feedback.natural,
        explanations: data.feedback.explanations,
        suggestions: data.feedback.suggestions,
        grammar_score: data.feedback.grammar,
        vocabulary_score: data.feedback.vocabulary,
        clarity_score: data.feedback.clarity,
        model_version: PEDAGOGY_MODEL_VERSION,
        rubric_version: WRITING_RUBRIC_VERSION,
      });
      if (error && error.code !== "23505") throw error;
      const persisted = await persistEvidenceAndResults({
        supabase: context.supabase as unknown as AuthenticatedClient,
        userId: context.userId,
        sourceType: "writing",
        sourceId: submissionId,
        idempotencyKey: key,
        rubricVersion: WRITING_RUBRIC_VERSION,
        evidence: writingEvidence(data.feedback),
      });
      return { ok: true, sourceId: submissionId, ...persisted };
    } catch (error) {
      await recordFailure(
        context.supabase as unknown as AuthenticatedClient,
        context.userId,
        "writing",
        submissionId,
        key,
        "evidence",
        error,
      );
      console.error("Writing pedagogical dual write failed", errorCode(error));
      return { ok: false, sourceId: submissionId, duplicate: false, evidenceCount: 0 };
    }
  });
