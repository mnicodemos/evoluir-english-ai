import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { finalTestLessonsRequired, getCoreCurriculum } from "./curriculum";
import { checkPromotion } from "./levelPromotion";

/**
 * Moves the student up one CEFR level after a passed Final Test. The browser
 * can no longer write level/max_level upward (migration 0036); this server
 * check against the stored quiz result is the only way up.
 */
export const promoteAfterFinalTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ attemptKey: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const [{ data: profile }, { data: result }] = await Promise.all([
      admin.from("profiles").select("level").eq("id", context.userId).maybeSingle(),
      admin
        .from("quiz_results")
        .select("user_id, score, lesson_id")
        .eq("id", data.attemptKey)
        .maybeSingle(),
    ]);
    if (!profile) throw new Error("Profile not found");
    const { data: lesson } = result?.lesson_id
      ? await admin
          .from("lessons")
          .select("curriculum_key")
          .eq("id", result.lesson_id)
          .maybeSingle()
      : { data: null };

    // The same 70% of core lessons that opens the Final Test is checked
    // again here, so a result alone can never move the student up.
    const core = getCoreCurriculum(profile.level);
    const { data: coreRows } = await admin
      .from("lessons")
      .select("id")
      .eq("created_by", context.userId)
      .in(
        "curriculum_key",
        core.map((lesson) => lesson.key),
      );
    const coreIds = (coreRows ?? []).map((row) => row.id as string);
    const { data: coreDone } = coreIds.length
      ? await admin
          .from("user_lessons")
          .select("lesson_id")
          .eq("user_id", context.userId)
          .in("lesson_id", coreIds)
          .not("completed_at", "is", null)
      : { data: [] };

    const check = checkPromotion({
      coreLessons: {
        done: (coreDone ?? []).length,
        required: finalTestLessonsRequired(core.length),
      },
      userId: context.userId,
      profileLevel: profile.level,
      result: result ? { user_id: result.user_id, score: result.score } : null,
      lessonKey: lesson?.curriculum_key ?? null,
    });
    if (!check.ok) return { promoted: false as const, reason: check.reason };

    const { error } = await admin
      .from("profiles")
      .update({ level: check.next, max_level: check.next })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { promoted: true as const, level: check.next };
  });
