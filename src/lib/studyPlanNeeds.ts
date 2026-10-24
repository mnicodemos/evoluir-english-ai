// The week's plan order is frozen from Monday (user request, 2026-10-24: audit
// of the weekly plan). Its skill needs used to come from the live skill profile
// and the last 7 days of activity, so practising Monday's skill reordered the
// week: the day just done could move away or leave the plan, and the plan
// showed nothing done. Here the needs are rebuilt from what existed before
// Monday 00:00 (São Paulo) only, so the order holds from Monday to Sunday.

import { aggregateSkillEvidence, countsForSkill } from "@/lib/pedagogy/aggregateSkill";
import {
  pedagogicalSkillSchema,
  type AssessmentEvidence,
  type PedagogicalSkill,
} from "@/lib/pedagogy/contracts";

import type { PlanSkillNeed } from "./studyPlan";

/**
 * Skill needs as they stood at `weekStartMs`: the same aggregation as the skill
 * profile, over evidence created before Monday, and "recently practised" from
 * the 7 days before Monday. Reading counts only once a daily reading measured
 * it before Monday, as the skill profile readers do (readingSource.server.ts).
 */
export function weekStartNeeds(
  evidence: readonly AssessmentEvidence[],
  practisedBeforeWeek: ReadonlySet<string>,
  weekStartMs: number,
): PlanSkillNeed[] {
  const before = evidence.filter(
    (item) =>
      countsForSkill(item) && (item.createdAt ? Date.parse(item.createdAt) < weekStartMs : false),
  );
  const readingMeasured = before.some(
    (item) => item.skill === "reading" && item.sourceType === "reading",
  );
  const bySkill = new Map<PedagogicalSkill, AssessmentEvidence[]>();
  for (const item of before) {
    const skill = pedagogicalSkillSchema.safeParse(item.skill);
    if (!skill.success) continue;
    if (skill.data === "reading" && !readingMeasured) continue;
    bySkill.set(skill.data, [...(bySkill.get(skill.data) ?? []), item]);
  }
  return [...bySkill.entries()].map(([skill, items]) => {
    const result = aggregateSkillEvidence(skill, items, undefined, weekStartMs);
    return {
      skill,
      score: result.score,
      confidence: result.confidence,
      recentlyPractised: practisedBeforeWeek.has(skill),
    };
  });
}
