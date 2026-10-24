// "Take the challenge" now and then invites the student to talk with EVO
// (user request, 2026-10-24: Extra practice should sometimes bring the AI
// Teacher and the video call, which the skill rules almost never chose). On
// every other study day the challenge becomes one of them, alternating, and
// on the other days it stays the skill quest. Pure and deterministic.

import type { PedagogicalSkill } from "./contracts";
import { SKILL_QUEST_RULE_VERSION, type SkillQuest, type SkillQuestResource } from "./skillQuest";

const VIDEO_CALL: SkillQuestResource = {
  type: "coach",
  title: "Video call",
  to: "/call",
  ceiling: "SPONTANEOUS_USE",
};
const TEACHER: SkillQuestResource = {
  type: "teacher",
  title: "AI Teacher",
  to: "/teacher",
  ceiling: "SPONTANEOUS_USE",
};

/** Days since 1970-01-01 of a study day "YYYY-MM-DD" (São Paulo). */
export function studyDayNumber(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
}

/** Which conversation the day's challenge invites to, or null on a skill day. */
export function conversationChallengeKind(day: string): "teacher" | "call" | null {
  const n = ((studyDayNumber(day) % 4) + 4) % 4;
  if (n === 0) return "teacher";
  if (n === 2) return "call";
  return null;
}

/**
 * The day's challenge: the skill quest, or on conversation days the AI Teacher
 * or the video call, never the place "Practice now" or the Quick Win already
 * opens (then the other conversation, then the skill quest).
 */
export function withConversationChallenge(
  quest: SkillQuest | null,
  context: {
    day: string;
    prioritySkill: string | null;
    taken: readonly string[];
  },
): SkillQuest | null {
  const kind = conversationChallengeKind(context.day);
  if (!kind) return quest;
  const taken = new Set(context.taken.map((to) => to.split("?")[0]));
  // A speaking priority already opens a conversation, so the call would repeat it.
  const speakingPriority = context.prioritySkill === "speaking";
  const order = kind === "call" ? [VIDEO_CALL, TEACHER] : [TEACHER, VIDEO_CALL];
  const resource = order.find(
    (item) => !taken.has(item.to) && !(item === VIDEO_CALL && speakingPriority),
  );
  if (!resource) return quest;
  const skill: PedagogicalSkill =
    resource === VIDEO_CALL
      ? "speaking"
      : context.prioritySkill === "grammar"
        ? "writing"
        : "grammar";
  return {
    skill,
    gapType: quest?.gapType ?? "SPONTANEOUS_USE_GAP",
    reason: quest?.reason ?? "spontaneous_use_not_demonstrated",
    currentState: quest?.currentState ?? "PRODUCTION",
    targetState: "SPONTANEOUS_USE",
    action: "use_spontaneously",
    resource,
    varyContext: true,
    priority: quest?.priority ?? 0,
    ruleVersion: SKILL_QUEST_RULE_VERSION,
  };
}
