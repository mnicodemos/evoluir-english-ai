import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { isCorrectAnswer, nextMistakeReview } from "./mistakeReview";

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
