import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { findCurriculumLesson } from "./curriculum";
import { findBusinessLesson, isBusinessKey } from "./businessCourse";
import { hasLessonPodcast, type ReviewPodcast } from "./reviewPodcast";

/**
 * Shared dialogue for one curriculum lesson, written by the AI the first
 * time a student opens it. Review I and Review II keep their existing review
 * outlines; core lessons use their own title and objective. Null for the review
 * Test; an error lets the student retry if generation fails.
 */
export const loadLessonPodcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ lessonId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ReviewPodcast | null> => {
    const { data: lesson } = await context.supabase
      .from("lessons")
      .select("curriculum_key, level")
      .eq("id", data.lessonId)
      .maybeSingle();
    const key = (lesson as { curriculum_key?: string | null } | null)?.curriculum_key;
    const plan = key
      ? isBusinessKey(key)
        ? findBusinessLesson(key, (lesson as { level?: string | null } | null)?.level ?? "b1")
        : findCurriculumLesson(key)
      : null;
    if (!plan || !hasLessonPodcast(plan)) return null;

    const { ensureLessonPodcast } = await import("./lessonPodcast.server");
    return (await ensureLessonPodcast(plan, context.userId)).podcast;
  });
