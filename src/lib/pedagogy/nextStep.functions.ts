// Server side of the adaptive next step. Reads only the caller's own data,
// through the existing tables/views. The client sends nothing: no skill, no
// level, no score, no plan.

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import {
  buildNextStep,
  lessonSkillToProfileSkill,
  type NextStep,
  type SkillSnapshot,
} from "./nextStep";

const RECENT_DAYS = 7;

export const loadNextStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NextStep> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const since = new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString();

    const [profile, skills, learning, recent, completed] = await Promise.all([
      supabaseAdmin.from("profiles").select("level").eq("id", userId).maybeSingle(),
      supabaseAdmin
        .from("current_skill_profile")
        .select("skill, score, cefr_level, confidence_score")
        .eq("user_id", userId),
      supabaseAdmin
        .from("learning_profile")
        .select("common_errors")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("activities")
        .select("activity_type, created_at")
        .eq("user_id", userId)
        .gte("created_at", since),
      supabaseAdmin
        .from("user_lessons")
        .select("lesson_id, completed_at")
        .eq("user_id", userId)
        .not("completed_at", "is", null),
    ]);

    const snapshots: SkillSnapshot[] = (skills.data ?? [])
      .filter((row) => row.skill)
      .map((row) => ({
        skill: row.skill as string,
        score: row.score === null ? null : Number(row.score),
        confidence: row.confidence_score === null ? null : Number(row.confidence_score),
        cefrLevel: row.cefr_level ?? "insufficient_evidence",
      }));

    // Existing lessons that match a skill at the student's own level and are
    // not completed yet. No new content, no ranking.
    const doneLessons = new Set((completed.data ?? []).map((row) => row.lesson_id));
    const level = profile.data?.level ?? null;
    let query = supabaseAdmin.from("lessons").select("id, title, skill, level, sort_order");
    if (level) query = query.eq("level", level);
    const { data: lessons } = await query.order("sort_order", { ascending: true });

    const lessonBySkill: Record<string, { id: string; title: string } | undefined> = {};
    for (const lesson of lessons ?? []) {
      if (!lesson.skill || doneLessons.has(lesson.id)) continue;
      const skill = lessonSkillToProfileSkill(lesson.skill);
      if (!lessonBySkill[skill]) lessonBySkill[skill] = { id: lesson.id, title: lesson.title };
    }

    return buildNextStep({
      skills: snapshots,
      recurringErrors: (learning.data?.common_errors ?? []).slice(-5),
      recentlyPractised: [
        ...new Set((recent.data ?? []).map((row) => row.activity_type).filter(Boolean)),
      ] as string[],
      lessonBySkill,
    });
  });
