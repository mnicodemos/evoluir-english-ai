// Server-side pedagogical context for the AI Teacher.
// Every value comes from data the server owns (current_skill_profile, profiles,
// lessons, learning_profile). The client cannot declare score, CEFR,
// confidence, skill results or evidence.

import { findLevel } from "@/lib/level";

import type { TeacherContextForPrompt } from "./teacherPrompt";

export type TeacherPedagogicalContext = TeacherContextForPrompt & { userId: string };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Minimal pedagogical context. A student with no measured data still gets a
 * valid context (empty skills, level from the profile). No email, no auth data,
 * no answer keys and no other user's data ever enter it.
 */
export async function loadTeacherContext(
  userId: string,
  options: { lessonId?: string | null } = {},
): Promise<TeacherPedagogicalContext> {
  const db = await admin();
  const [profile, skills, learning] = await Promise.all([
    db.from("profiles").select("level").eq("id", userId).maybeSingle(),
    db
      .from("current_skill_profile")
      .select("skill, score, cefr_level, confidence_score")
      .eq("user_id", userId),
    db.from("learning_profile").select("common_errors").eq("user_id", userId).maybeSingle(),
  ]);

  const lesson = options.lessonId
    ? await db
        .from("lessons")
        .select("id, title, skill, level")
        .eq("id", options.lessonId)
        .maybeSingle()
    : null;

  const measured = (skills.data ?? [])
    .filter((row) => row.skill)
    .map((row) => ({
      skill: row.skill as string,
      score: row.score === null ? null : Number(row.score),
      confidence: row.confidence_score === null ? null : Number(row.confidence_score),
      cefrLevel: row.cefr_level ?? "insufficient_evidence",
    }));

  const context: TeacherPedagogicalContext = {
    userId,
    cefrLevel: profile.data?.level ? findLevel(profile.data.level).cefr : null,
    skills: measured,
    recurringErrors: (learning.data?.common_errors ?? []).slice(-3),
  };

  if (lesson?.data) {
    context.currentActivity = {
      lessonTitle: lesson.data.title,
      skill: lesson.data.skill || null,
      cefrLevel: lesson.data.level ? findLevel(lesson.data.level).cefr : null,
    };
  } else {
    // Reuse existing platform content: one lesson matching the weakest measured
    // skill at the student's own level. No new recommendation system.
    const weakest = [...measured].sort((a, b) => (a.score ?? 100) - (b.score ?? 100))[0];
    if (weakest?.skill && profile.data?.level) {
      const { data: suggested } = await db
        .from("lessons")
        .select("title, skill")
        .eq("skill", weakest.skill)
        .eq("level", profile.data.level)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (suggested?.title) {
        context.recommendedLesson = { title: suggested.title, skill: suggested.skill ?? null };
      }
    }
  }
  return context;
}
