import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { isCorrectAnswer, nextMistakeReview } from "./mistakeReview";
import {
  mistakePracticePrompt,
  parseMistakePractice,
  type MistakePractice,
} from "./mistakePractice";

/**
 * Grades one "My mistakes" review. The student only reads learning_errors;
 * the step and next due date are decided here, against the stored correction.
 */
export const reviewMistake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), answer: z.string().max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await admin
      .from("learning_errors")
      .select("id, user_id, corrected_text, explanation, review_step")
      .eq("id", data.id)
      .maybeSingle();
    if (!row || row.user_id !== context.userId) throw new Error("Mistake not found");

    const correct = isCorrectAnswer(data.answer, row.corrected_text);
    const next = nextMistakeReview(row.review_step, correct);
    const { error } = await admin
      .from("learning_errors")
      .update({
        review_step: next.step,
        next_review_at: next.nextReviewAt,
        last_reviewed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) throw new Error("Review could not be saved");
    return {
      correct,
      corrected: row.corrected_text,
      explanation: row.explanation,
      step: next.step,
    };
  });

/**
 * "Practise the rule": one new multiple-choice question on the same rule as a
 * saved mistake, written by the AI in a different sentence. Practice only; the
 * spaced review of the mistake is not touched.
 */
export const practiceMistake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<MistakePractice> => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const [{ data: row }, { data: profile }] = await Promise.all([
      admin
        .from("learning_errors")
        .select("id, user_id, original_text, corrected_text, explanation, category")
        .eq("id", data.id)
        .maybeSingle(),
      admin.from("profiles").select("level").eq("id", context.userId).maybeSingle(),
    ]);
    if (!row || row.user_id !== context.userId) throw new Error("Mistake not found");

    const { callGateway } = await import("@/lib/ai-gateway.server");
    const messages = mistakePracticePrompt({
      original: row.original_text,
      corrected: row.corrected_text,
      explanation: row.explanation ?? "",
      category: row.category ?? "",
      level: profile?.level ?? "b1",
    });
    // One retry when the model's answer does not pass the checks: its own cache
    // key (so a cached bad answer is not reused) and a pause the usage limiter
    // accepts.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 6_000));
      const raw = await callGateway(messages, true, {
        userId: context.userId,
        operation: "quiz_generation",
        cacheKey: `mistake-practice:${row.id}:${attempt}`,
      });
      const practice = parseMistakePractice(raw);
      if (practice) return practice;
    }
    throw new Error("Could not prepare a practice question. Please try again.");
  });
