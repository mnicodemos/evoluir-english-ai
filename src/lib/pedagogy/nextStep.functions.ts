// Server side of the adaptive next step. Reads only the caller's own data,
// through the existing tables/views. The client sends nothing: no skill, no
// level, no score, no plan.

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { AssessmentEvidence, PedagogicalSkill } from "./contracts";
import { deriveInvisibleGaps } from "./invisibleGaps";
import { transferredSkills } from "./learningLoop";
import {
  buildNextStep,
  lessonSkillToProfileSkill,
  type NextStep,
  type SkillSnapshot,
} from "./nextStep";
import { selectPrioritySkillQuest } from "./skillQuest";
import { buildSmartReviewList } from "./smartReviewUx";

const RECENT_DAYS = 7;
/** Existing evidence rows considered for the Skill Quest. Read-only. */
const EVIDENCE_LIMIT = 400;

export const loadNextStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NextStep> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const since = new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString();

    const [profile, skills, history, learning, recent, completed] = await Promise.all([
      supabaseAdmin.from("profiles").select("level").eq("id", userId).maybeSingle(),
      supabaseAdmin
        .from("current_skill_profile")
        .select("skill, score, cefr_level, confidence_score")
        .eq("user_id", userId),
      // Full per-level history (completed sessions only). Nothing is ever
      // deleted: each CEFR level keeps its own evidence, so when the student
      // returns to a level that already has results, those results are shown
      // again instead of being borrowed from another level.
      supabaseAdmin
        .from("assessment_skill_results")
        .select(
          "skill, score, cefr_level, confidence_score, assessed_at, assessment_sessions!inner(status)",
        )
        .eq("user_id", userId)
        .eq("assessment_sessions.status", "completed")
        .order("assessed_at", { ascending: false }),
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

    // Latest completed result per skill AT THE CURRENT LEVEL. Rows are
    // ordered by assessed_at DESC, so the first match per skill wins.
    const level = profile.data?.level ?? null;
    const current = level?.toUpperCase() ?? null;
    type HistoryRow = NonNullable<typeof history.data>[number];
    const atLevelBySkill = new Map<string, HistoryRow>();
    for (const row of history.data ?? []) {
      if (!row.skill || !row.cefr_level) continue;
      if (current && row.cefr_level.toUpperCase() !== current) continue;
      if (!atLevelBySkill.has(row.skill)) atLevelBySkill.set(row.skill, row);
    }

    const snapshots: SkillSnapshot[] = (skills.data ?? [])
      .filter((row) => row.skill)
      .map((row) => {
        // Prefer the skill's own evidence at the current level; only when the
        // level has no evidence of its own do we fall back to the latest
        // snapshot, which buildNextStep flags as cross-level (not replicated).
        const own = atLevelBySkill.get(row.skill as string);
        const source = own ?? row;
        return {
          skill: row.skill as string,
          score: source.score === null ? null : Number(source.score),
          confidence: source.confidence_score === null ? null : Number(source.confidence_score),
          cefrLevel: source.cefr_level ?? "insufficient_evidence",
        };
      });

    // Existing lessons that match a skill at the student's own level and are
    // not completed yet. No new content, no ranking.
    const doneLessons = new Set((completed.data ?? []).map((row) => row.lesson_id));
    let query = supabaseAdmin.from("lessons").select("id, title, skill, level, sort_order");
    if (level) query = query.eq("level", level);
    const { data: lessons } = await query.order("sort_order", { ascending: true });

    const lessonBySkill: Record<string, { id: string; title: string } | undefined> = {};
    for (const lesson of lessons ?? []) {
      if (!lesson.skill || doneLessons.has(lesson.id)) continue;
      const skill = lessonSkillToProfileSkill(lesson.skill);
      if (!lessonBySkill[skill]) lessonBySkill[skill] = { id: lesson.id, title: lesson.title };
    }

    // Phase 29/30/31: existing evidence rows, read once and reused by the
    // Invisible Gaps, the Skill Quest and the Transfer Context reading.
    const { data: evidenceRows } = await supabaseAdmin
      .from("assessment_evidence")
      .select(
        "id, skill, subskill, source_type, source_id, source_item_id, raw_score, source_reliability, evidence_quality, sample_weight, evaluated_by, rubric_version, metadata, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(EVIDENCE_LIMIT);

    const evidence: AssessmentEvidence[] = (evidenceRows ?? []).map((row) => ({
      id: row.id,
      skill: row.skill as PedagogicalSkill,
      subskill: row.subskill,
      sourceType: row.source_type as AssessmentEvidence["sourceType"],
      sourceId: row.source_id,
      sourceItemId: row.source_item_id,
      rawScore: Number(row.raw_score),
      sourceReliability: Number(row.source_reliability),
      evidenceQuality: Number(row.evidence_quality),
      sampleWeight: Number(row.sample_weight),
      evaluatedBy: row.evaluated_by as AssessmentEvidence["evaluatedBy"],
      rubricVersion: row.rubric_version,
      metadata: (row.metadata ?? {}) as NonNullable<AssessmentEvidence["metadata"]>,
      createdAt: row.created_at,
    }));

    // Phase 31: the only signal the loop hands over — a plain list of skills
    // whose transfer the existing Phase 30 layer already demonstrated.
    const transferred = transferredSkills(evidence);

    const step = buildNextStep({
      skills: snapshots,
      currentLevel: level,
      recurringErrors: (learning.data?.common_errors ?? []).slice(-5),
      recentlyPractised: [
        ...new Set((recent.data ?? []).map((row) => row.activity_type).filter(Boolean)),
      ] as string[],
      lessonBySkill,
      transferredSkills: transferred,
    });

    const quest = selectPrioritySkillQuest({
      gaps: deriveInvisibleGaps({ evidence }),
      lessonBySkill,
      transferredSkills: transferred,
    });

    // Phase 33: the review recommendations, decided here on the server from the
    // very same rows already read above (no extra query, no per-skill lookup).
    // The skill already shown by "Your next step" and by the challenge is left
    // out so the dashboard never repeats the same card twice.
    const reviews = buildSmartReviewList(
      {
        evidence,
        skills: snapshots,
        currentLevel: level,
        recurringErrors: (learning.data?.common_errors ?? []).slice(-5),
        recentlyPractised: [
          ...new Set((recent.data ?? []).map((row) => row.activity_type).filter(Boolean)),
        ] as string[],
        lessonBySkill,
      },
      {
        excludeSkills: [step.prioritySkill, quest?.skill].filter(Boolean) as string[],
      },
    );

    return { ...step, quest, reviews };
  });
