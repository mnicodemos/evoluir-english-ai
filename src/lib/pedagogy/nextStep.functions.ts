// Server side of the adaptive next step. Reads only the caller's own data,
// through the existing tables/views. The client sends nothing: no skill, no
// level, no score, no plan.

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { aggregateSkillEvidence } from "./aggregateSkill";
import { measuredCefr } from "./cefr";
import {
  pedagogicalSkillSchema,
  type AssessmentEvidence,
  type PedagogicalSkill,
} from "./contracts";
import { deriveInvisibleGaps } from "./invisibleGaps";
import { transferredSkills } from "./learningLoop";
import {
  buildNextStep,
  lessonSkillToProfileSkill,
  type NextStep,
  type SkillSnapshot,
} from "./nextStep";
import { deriveSkillQuests } from "./skillQuest";
import { buildSmartReviewList } from "./smartReviewUx";

const RECENT_DAYS = 7;
/** Existing evidence rows considered for the Skill Quest. Read-only. */
const EVIDENCE_LIMIT = 400;
/** Evidence rows read to rebuild each level's measurement for My Progress. */
const LEVEL_HISTORY_LIMIT = 3000;

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
        .select("skill, score, cefr_level, confidence_score, evidence_count")
        .eq("user_id", userId),
      // Per-level history for My Progress: every evidence row keeps the level
      // of the content it came from (item_cefr), so each level's measurement
      // is rebuilt from what was practised at that level.
      supabaseAdmin
        .from("assessment_evidence")
        .select(
          "skill, source_type, item_cefr, raw_score, source_reliability, evidence_quality, sample_weight, evaluated_by, rubric_version",
        )
        .eq("user_id", userId)
        .not("item_cefr", "is", null)
        .order("created_at", { ascending: false })
        .limit(LEVEL_HISTORY_LIMIT),
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

    const level = profile.data?.level ?? null;

    // Learning is continuous (user decision): every skill keeps its latest
    // measurement across levels, on the Dashboard and in EVO's priority.
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
    // Business English lessons are a bonus track, not the level's next step.
    let query = supabaseAdmin
      .from("lessons")
      .select("id, title, skill, level, sort_order")
      .neq("category", "business");
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

    // "Take the challenge" works a DIFFERENT skill than "Practice now" and opens
    // a different screen, so the Dashboard's three buttons never lead to the
    // same place.
    const quest =
      deriveSkillQuests({
        gaps: deriveInvisibleGaps({ evidence }),
        lessonBySkill,
        transferredSkills: transferred,
      }).find(
        (candidate) =>
          candidate.skill !== step.prioritySkill &&
          candidate.resource.to !== step.activity.to &&
          candidate.resource.to !== step.quickWin?.activity.to,
      ) ?? null;

    // Phase 33: the review recommendations, decided here on the server from the
    // very same rows already read above (no extra query, no per-skill lookup).
    // The skill already shown by "Your next step" and by the challenge is left
    // out so the dashboard never repeats the same card twice.
    const reviews = buildSmartReviewList(
      {
        evidence,
        skills: snapshots,
        // The whole journey: a skill's latest measurement counts at any level.
        currentLevel: null,
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

    // Dashboard skills card: the same latest snapshots, plus how much evidence
    // each one rests on.
    const skillMeter = (skills.data ?? [])
      .filter((row) => row.skill)
      .map((row) => ({
        skill: row.skill as string,
        score: row.score === null ? null : Number(row.score),
        cefrLevel: row.cefr_level ?? "insufficient_evidence",
        evidenceCount: row.evidence_count === null ? null : Number(row.evidence_count),
      }));

    // My Progress: the measurement of each level the student studied, from the
    // evidence of that level's content only (same aggregation as the results).
    const byLevel = new Map<string, Map<string, AssessmentEvidence[]>>();
    for (const row of history.data ?? []) {
      const cefr = measuredCefr(row.item_cefr);
      const skill = pedagogicalSkillSchema.safeParse(row.skill);
      if (!cefr || !skill.success) continue;
      const skillsAtLevel = byLevel.get(cefr) ?? new Map<string, AssessmentEvidence[]>();
      const items = skillsAtLevel.get(skill.data) ?? [];
      items.push({
        skill: skill.data,
        sourceType: row.source_type as AssessmentEvidence["sourceType"],
        itemCefr: cefr,
        rawScore: Number(row.raw_score),
        sourceReliability: Number(row.source_reliability),
        evidenceQuality: Number(row.evidence_quality),
        sampleWeight: Number(row.sample_weight),
        evaluatedBy: row.evaluated_by as AssessmentEvidence["evaluatedBy"],
        rubricVersion: row.rubric_version,
      });
      skillsAtLevel.set(skill.data, items);
      byLevel.set(cefr, skillsAtLevel);
    }
    const skillsByLevel = [...byLevel.entries()].map(([cefr, rows]) => ({
      level: cefr,
      skills: [...rows.entries()].map(([skill, items]) => {
        const result = aggregateSkillEvidence(skill as PedagogicalSkill, items);
        return {
          skill,
          score: result.score,
          cefrLevel: result.score === null ? "insufficient_evidence" : cefr,
          evidenceCount: result.evidenceCount,
        };
      }),
    }));

    return { ...step, quest, reviews, skills: skillMeter, skillsByLevel };
  });
