// Phase 33 — Smart Review UX. A PURE presentation layer over the Phase 32
// engine: it does not select, score, order or re-derive anything. It only
// - keeps the engine order untouched,
// - drops candidates with no real surface,
// - avoids duplicating the skill already shown by "Your next step",
// - caps the list at three items,
// - maps the internal label onto student-facing copy.
//
// No AI, no I/O, no new table, no new score, no new metric.

import type { PedagogicalSkill } from "./contracts";
import type { SkillQuestResource } from "./skillQuest";
import {
  deriveSmartReview,
  INITIAL_SMART_REVIEW_CONFIG,
  SMART_REVIEW_RULE_VERSION,
  type SmartReviewCategory,
  type SmartReviewConfig,
  type SmartReviewInput,
} from "./smartReview";

/** Most recommendations a dashboard should ever show at once. */
export const SMART_REVIEW_MAX_ITEMS = 3;

/**
 * One presentable recommendation. Deliberately free of internal data: no score,
 * no confidence, no learning-state rank, no evidence detail.
 */
export type SmartReviewItem = {
  skill: PedagogicalSkill;
  /** Internal label, kept only to pick the copy. Never displayed as-is. */
  category: SmartReviewCategory;
  /** Existing surface that will host the review. */
  resource: SkillQuestResource;
  /** Phase 31 signal: practising in another context is the useful variation. */
  varyContext: boolean;
  ruleVersion: string;
};

export type SmartReviewListOptions = {
  /** Skills already presented elsewhere on the page (e.g. the next step). */
  excludeSkills?: readonly string[];
  /** Defaults to SMART_REVIEW_MAX_ITEMS. */
  limit?: number;
};

/**
 * The recommendations to present, in the engine's own order.
 * Returns an empty list when there is nothing worth recovering — the UI then
 * shows no section at all.
 */
export function buildSmartReviewList(
  input: SmartReviewInput,
  options: SmartReviewListOptions = {},
  config: SmartReviewConfig = INITIAL_SMART_REVIEW_CONFIG,
): SmartReviewItem[] {
  const excluded = new Set(options.excludeSkills ?? []);
  const limit = Math.max(0, options.limit ?? SMART_REVIEW_MAX_ITEMS);

  const items: SmartReviewItem[] = [];
  for (const candidate of deriveSmartReview(input, config)) {
    if (items.length >= limit) break;
    if (!candidate.resource) continue;
    if (excluded.has(candidate.skill)) continue;
    items.push({
      skill: candidate.skill,
      category: candidate.category,
      resource: candidate.resource,
      varyContext: candidate.varyContext,
      ruleVersion: SMART_REVIEW_RULE_VERSION,
    });
  }
  return items;
}

/**
 * Student-facing reason. Pedagogical and factual: it never claims the student
 * forgot anything, never mentions categories, scores or algorithms.
 */
export const SMART_REVIEW_REASON_TEXT: Record<SmartReviewCategory, string> = {
  ERROR_REVIEW: "Let's reinforce a point that was tricky recently.",
  LOW_CONFIDENCE_REVIEW: "Reviewing this is worth it to feel more confident.",
  UNCONSOLIDATED_REVIEW: "Let's reinforce this skill before moving ahead.",
  DECAY_REVIEW: "It has been a while since your last practice. A quick review can help.",
  CONTEXT_REVIEW: "You have practised this skill. Now let's use it in another context.",
};
