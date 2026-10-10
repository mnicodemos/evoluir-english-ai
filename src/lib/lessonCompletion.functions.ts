import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { lessonCompletionCheck } from "@/lib/lessonCompletion";

/**
 * Marks a lesson (or a unit / Final Test) completed from the quiz result the
 * server graded (security audit, 2026-10-09): the browser can no longer write
 * completed_at (migration 0059), so a lesson only counts once its quiz passed.
 */
export const completeLessonFromQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ attemptKey: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data: result } = await admin
      .from("quiz_results")
      .select("user_id, lesson_id, score")
      .eq("id", data.attemptKey)
      .maybeSingle();
    const { data: lesson } = result?.lesson_id
      ? await admin
          .from("lessons")
          .select("created_by, category")
          .eq("id", result.lesson_id)
          .maybeSingle()
      : { data: null };
    const check = lessonCompletionCheck({ userId: context.userId, result, lesson });
    if (!check.ok) {
      // Recorded in server_errors (Admin alerts), so a lesson that cannot be
      // completed is seen instead of failing quietly.
      console.error(`Lesson completion refused (${check.reason})`);
      return { completed: false as const, reason: check.reason };
    }

    const lessonId = result!.lesson_id as string;
    const { data: existing } = await admin
      .from("user_lessons")
      .select("completed_at")
      .eq("user_id", context.userId)
      .eq("lesson_id", lessonId)
      .maybeSingle();
    // The first completion date is kept, so a retake never moves the study day.
    const { error } = await admin.from("user_lessons").upsert(
      {
        user_id: context.userId,
        lesson_id: lessonId,
        progress: 100,
        completed_at: existing?.completed_at ?? new Date().toISOString(),
      },
      { onConflict: "user_id,lesson_id" },
    );
    if (error) {
      console.error(`Lesson completion not saved: ${error.message}`);
      throw new Error("The lesson could not be saved as completed.");
    }
    return { completed: true as const, wasAlreadyCompleted: !!existing?.completed_at };
  });
