// Server side of My Study Plan (server-only module). Reads only the caller's own data through the
// existing tables (profiles, lessons, user_lessons, activities). No new content,
// no AI call, no change to the recommendation engine.

import type { AssessmentEvidence } from "@/lib/pedagogy/contracts";
import { LEARNING_ACTIVITY_TYPES } from "@/lib/studyDay";
import { STUDY_TIME_ZONE, studyToday } from "@/lib/today";

import { weekStartNeeds } from "./studyPlanNeeds";
import {
  buildStudyPlan,
  type PlanLesson,
  type PlanPractice,
  type PlanSkillNeed,
  type StudyFocus,
  type StudyPlan,
} from "./studyPlan";

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

/**
 * The student's plan for this week, read with the service role (only that
 * student's own rows). Shared by the Study Plan page and the daily push.
 */
export async function loadStudyPlanFor(userId: string): Promise<StudyPlanResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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

  // Shared lessons and the student's own path lessons only (never another
  // student's generated lessons, which this admin read could otherwise see).
  let lessonQuery = supabaseAdmin
    .from("lessons")
    .select("id, title, skill, level, sort_order")
    .or(`created_by.is.null,created_by.eq.${userId}`)
    // Business English lessons are a bonus track, never planned as level days.
    .neq("category", "business");
  if (level) lessonQuery = lessonQuery.eq("level", level);
  // The order of the week's skills is decided from what existed before Monday
  // (studyPlanNeeds.ts), so practising during the week never reorders it.
  const recentSince = new Date(Date.parse(since) - 7 * 86_400_000).toISOString();
  const [
    { data: lessonRows },
    { data: doneRows },
    { data: activityRows },
    { data: skillRows },
    { data: recentRows },
  ] = await Promise.all([
    lessonQuery.order("sort_order", { ascending: true }),
    supabaseAdmin
      .from("user_lessons")
      .select("lesson_id, completed_at")
      .eq("user_id", userId)
      .not("completed_at", "is", null),
    supabaseAdmin
      .from("activities")
      .select("duration_minutes, activity_type, created_at")
      .eq("user_id", userId)
      .gte("created_at", since),
    supabaseAdmin
      .from("assessment_evidence")
      .select(
        "skill, source_type, raw_score, source_reliability, evidence_quality, sample_weight, evaluated_by, rubric_version, item_cefr, created_at",
      )
      .eq("user_id", userId)
      .lt("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabaseAdmin
      .from("activities")
      .select("activity_type")
      .eq("user_id", userId)
      .gte("created_at", recentSince)
      .lt("created_at", since),
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

  const minutesThisWeek = (activityRows ?? [])
    .filter((row) =>
      (LEARNING_ACTIVITY_TYPES as readonly string[]).includes(row.activity_type ?? ""),
    )
    .reduce((total, row) => total + (row.duration_minutes ?? 0), 0);

  // Existing activity types mapped onto the skill names already used by the
  // skill profile. Read-only: nothing is written and no score is recomputed.
  const ACTIVITY_TO_SKILL: Record<string, string> = {
    listening: "listening",
    listening_practice: "listening",
    writing: "writing",
    writing_practice: "writing",
    conversation: "speaking",
    conversation_practice: "speaking",
    video_call: "speaking",
    vocabulary: "vocabulary",
    flashcards: "vocabulary",
    teacher: "grammar",
    // Reading is the daily reading only (user decision, 2026-10-17): lessons
    // count through their own skill below, never as Reading.
    reading: "reading",
    daily_reading: "reading",
  };
  const practised = new Set(
    (recentRows ?? [])
      .map((row) => ACTIVITY_TO_SKILL[row.activity_type ?? ""])
      .filter((skill): skill is string => !!skill),
  );

  // What was practised this week, by São Paulo date: activities mapped to a
  // skill, and lessons completed this week (they keep their own title).
  const byLessonId = new Map((lessonRows ?? []).map((row) => [row.id, row]));
  const practice: PlanPractice[] = [
    ...(activityRows ?? []).flatMap((row) => {
      const skill = ACTIVITY_TO_SKILL[row.activity_type ?? ""];
      return skill && row.created_at ? [{ skill, date: studyToday(new Date(row.created_at)) }] : [];
    }),
    ...(doneRows ?? []).flatMap((row) => {
      const lesson = byLessonId.get(row.lesson_id);
      if (!lesson?.skill || !row.completed_at || row.completed_at < since) return [];
      // A reading lesson's answers count for Grammar and Vocabulary, so it
      // does not complete a Reading day; the daily reading does.
      if (lesson.skill === "reading") return [];
      return [
        {
          skill: lesson.skill === "talking" ? "speaking" : lesson.skill,
          date: studyToday(new Date(row.completed_at)),
          lessonId: lesson.id,
          title: lesson.title,
        },
      ];
    }),
  ];

  const evidence: AssessmentEvidence[] = (skillRows ?? []).map((row) => ({
    skill: row.skill as AssessmentEvidence["skill"],
    sourceType: row.source_type as AssessmentEvidence["sourceType"],
    itemCefr: (row.item_cefr ?? null) as NonNullable<AssessmentEvidence["itemCefr"]> | null,
    rawScore: Number(row.raw_score),
    sourceReliability: Number(row.source_reliability),
    evidenceQuality: Number(row.evidence_quality),
    sampleWeight: Number(row.sample_weight),
    evaluatedBy: row.evaluated_by as AssessmentEvidence["evaluatedBy"],
    rubricVersion: row.rubric_version,
    createdAt: row.created_at,
  }));
  const needs: PlanSkillNeed[] = weekStartNeeds(evidence, practised, Date.parse(since));

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
      needs,
      today: studyToday(),
      practice,
    }),
  };
}
