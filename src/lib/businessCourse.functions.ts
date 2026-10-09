import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BUSINESS_FREE_LESSONS,
  businessLevelAllowed,
  findBusinessLesson,
  getBusinessCourse,
} from "@/lib/businessCourse";

import { prepareLessonContent, writeLesson } from "./curriculumContent.server";
import { keepAlive } from "./keepAlive.server";

/** Premium as the database decides it (Stripe or launch campaign entitlements). */
async function hasPremium(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const features = ["ai_talking", "ai_teacher", "writing_correction", "advanced_reports"];
  const checks = await Promise.all(
    features.map((feature) =>
      supabaseAdmin.rpc("has_active_entitlement", { _user_id: userId, _feature: feature }),
    ),
  );
  return checks.some((check) => check.data === true);
}

/** Whether the student may open the Business track beyond its free preview. */
export const loadBusinessAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ premium: await hasPremium(context.userId) }));

/**
 * Opens a Business lesson (Premium bonus from B1; the first lesson is a free
 * preview), writing it at the student's level the first time. Lessons open
 * in order, and the next one is prepared in the background.
 */
export const openBusinessLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ key: z.string().min(3).max(40) }).parse(input))
  .handler(async ({ data, context }): Promise<{ lessonId: string }> => {
    const { supabase, userId } = context;
    const { data: owner } = await supabase
      .from("profiles")
      .select("level, max_level")
      .eq("id", userId)
      .maybeSingle();
    const level = owner?.max_level ?? owner?.level;
    if (!businessLevelAllowed(level)) {
      throw new Error("Business English opens at level B1.");
    }

    const course = getBusinessCourse(level);
    const plan = findBusinessLesson(data.key, level);
    if (!plan) throw new Error("This lesson is not part of Business English.");

    const { data: existing } = await supabase
      .from("lessons")
      .select("id")
      .eq("created_by", userId)
      .eq("curriculum_key", plan.key)
      .maybeSingle();
    const nextPlan = course[plan.index + 1];
    const prepareNext = () => {
      if (nextPlan) void keepAlive(prepareLessonContent(nextPlan, userId));
    };

    if (existing?.id) {
      // A lesson saved without its quiz (interrupted generation) is repaired once.
      const { count } = await supabase
        .from("quizzes")
        .select("id", { count: "exact", head: true })
        .eq("lesson_id", existing.id);
      if (!count) await writeLesson(supabase, userId, plan, existing.id as string);
      return { lessonId: existing.id as string };
    }

    if (plan.index >= BUSINESS_FREE_LESSONS && !(await hasPremium(userId))) {
      throw new Error("Business English is part of Premium.");
    }

    if (plan.index > 0) {
      const previous = course[plan.index - 1]!;
      const { data: prevLesson } = await supabase
        .from("lessons")
        .select("id")
        .eq("created_by", userId)
        .eq("curriculum_key", previous.key)
        .maybeSingle();
      const done = prevLesson?.id
        ? (
            await supabase
              .from("user_lessons")
              .select("completed_at")
              .eq("user_id", userId)
              .eq("lesson_id", prevLesson.id as string)
              .maybeSingle()
          ).data?.completed_at
        : null;
      if (!done) throw new Error("Finish the previous lesson first to unlock this one.");
    }

    const lessonId = await writeLesson(supabase, userId, plan);
    prepareNext();
    return { lessonId };
  });
