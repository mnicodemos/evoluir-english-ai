import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseWritingFeedback, writingCorrectionMessages } from "@/lib/ai-prompts";
import { expectedLengthLabel, writingLevelConfig } from "@/lib/writingLevels";
import { callGateway } from "@/lib/ai-gateway.server";

import { parseQuizDetails, writingSubmissionRecord } from "./dualWrite";
import {
  authoritativeQuizInputSchema,
  authoritativeWritingInputSchema,
  gradeQuizAnswers,
  writingFeedbackFromRow,
} from "./authoritativeSources";
import {
  deterministicUuid,
  loadAdmin,
  PedagogicalWriteError,
  processQuiz,
  processQuizResultSafely,
  processWriting,
  processWritingSafely,
  recordClaimedFailure,
} from "./dualWriteCore";

const retryInputSchema = z.object({ limit: z.number().int().min(1).max(5).default(3) }).strict();

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
    const { recordMistakes } = await import("@/lib/learningErrors.server");
    await recordMistakes(admin, context.userId, feedback.mistakes, {
      skill: "writing",
      source: "writing",
    });
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
