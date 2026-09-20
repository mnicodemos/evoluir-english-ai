// Server side of My Study Plan. Reads only the caller's own data through the
// existing tables (profiles, lessons, user_lessons, activities). No new content,
// no AI call, no change to the recommendation engine.

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LEARNING_ACTIVITY_TYPES } from "@/lib/studyDay";
import { STUDY_TIME_ZONE } from "@/lib/today";

import { buildStudyPlan, type PlanLesson, type StudyFocus, type StudyPlan } from "./studyPlan";

/** Monday 00:00 of the current week, in Brazil time, as an ISO timestamp. */
function weekStartIso(now = new Date()): string {
  const local = new Date(now.toLocaleString("en-US", { timeZone: STUDY_TIME_ZONE }));
  const weekday = (local.getDay() + 6) % 7; // Monday = 0
  local.setDate(local.getDate() - weekday);
  local.setHours(0, 0, 0, 0);
  return new Date(local.getTime() + 3 * 3_600_000).toISOString();
}

export type StudyPlanResult = {
  configured: boolean;
  preferences: {
    goal: string;
    dailyMinutes: number;
    daysPerWeek: number;
    focus: StudyFocus;
    level: string | null;
  };
  plan: StudyPlan;
};

export const loadStudyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StudyPlanResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const since = weekStartIso();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("level, goal, daily_minutes, study_focus, study_days_per_week")
      .eq("id", userId)
      .maybeSingle();

    const level = profile?.level ?? null;
    const goal = profile?.goal ?? "conversation";
    const dailyMinutes = profile?.daily_minutes ?? 30;
    const daysPerWeek = profile?.study_days_per_week ?? 3;
    const focus = (profile?.study_focus ?? "balanced") as StudyFocus;

    let lessonQuery = supabaseAdmin.from("lessons").select("id, title, skill, level, sort_order");
    if (level) lessonQuery = lessonQuery.eq("level", level);
    const [{ data: lessonRows }, { data: doneRows }, { data: activityRows }] = await Promise.all([
      lessonQuery.order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("user_lessons")
        .select("lesson_id, completed_at")
        .eq("user_id", userId)
        .not("completed_at", "is", null),
      supabaseAdmin
        .from("activities")
        .select("duration_minutes, activity_type")
        .eq("user_id", userId)
        .in("activity_type", [...LEARNING_ACTIVITY_TYPES])
        .gte("created_at", since),
    ]);

    const done = new Set((doneRows ?? []).map((row) => row.lesson_id));
    const lessons: PlanLesson[] = (lessonRows ?? [])
      .filter((row) => row.skill)
      .map((row) => ({
        id: row.id,
        title: row.title,
        skill: row.skill as string,
        level: row.level,
        completed: done.has(row.id),
      }));

    const minutesThisWeek = (activityRows ?? []).reduce(
      (total, row) => total + (row.duration_minutes ?? 0),
      0,
    );

    return {
      configured: profile?.study_focus != null && profile?.study_days_per_week != null,
      preferences: { goal, dailyMinutes, daysPerWeek, focus, level },
      plan: buildStudyPlan({
        goal,
        dailyMinutes,
        daysPerWeek,
        focus,
        level,
        lessons,
        minutesThisWeek,
      }),
    };
  });
