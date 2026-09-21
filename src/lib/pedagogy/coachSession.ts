// Coach mode for the existing AI Teacher (Phase 23B).
// Pure, deterministic helpers: the session stage comes from the conversation
// shape and the focus reuses the existing next-step priority logic. No new AI
// architecture, no new evidence model, no new score or CEFR authority.

import { buildNextStep, type NextStepReason } from "./nextStep";
import type { TeacherContextForPrompt } from "./teacherPrompt";

export const COACH_STAGES = ["START", "CHALLENGE", "FEEDBACK", "RETRY", "SUMMARY"] as const;
export type CoachStage = (typeof COACH_STAGES)[number];

/** Max student turns in one guided session before it is wrapped up. */
export const COACH_MAX_TURNS = 4;

/**
 * Stage from the student's own turns in this session. Turn 1 sets the focus and
 * proposes the first challenge, turns 2-3 are answer -> feedback -> retry, the
 * last turn closes the session with a summary.
 */
export function coachStage(studentTurns: number): CoachStage {
  if (studentTurns <= 1) return "START";
  if (studentTurns === 2) return "FEEDBACK";
  if (studentTurns === 3) return "RETRY";
  return "SUMMARY";
}

export function coachStudentTurns(history: { role: "user" | "assistant" }[]): number {
  return history.filter((message) => message.role === "user").length + 1;
}

export const COACH_STAGE_RULES: Record<CoachStage, string> = {
  START:
    "Open the session in 2 short lines: name the focus skill and why it is today's focus, then give ONE concrete challenge at the student's level and stop. Do not answer it for them.",
  CHALLENGE: "Give ONE new concrete challenge on the same focus and wait for the student's answer.",
  FEEDBACK:
    "Give objective feedback on what the student produced: what worked, what needs improvement, one corrected example, then ask for a second attempt on the same focus.",
  RETRY:
    "Acknowledge the progress briefly, correct what is still wrong with one example, and give one final short attempt or extension of the same challenge.",
  SUMMARY:
    "Close the session: skill practised, what was observed in this session, the single main point to improve, and one recommended next practice. No new challenge.",
};

/** Deterministic, factual focus reasons. Nothing is invented. */
export const COACH_FOCUS_REASON: Record<NextStepReason, string> = {
  recent_errors: "recent mistakes in this area",
  low_confidence: "there is still little evidence about this skill",
  lowest_score: "this is the lowest skill score right now",
  not_practised_recently: "it has not been practised recently",
  not_measured_yet: "this skill has not been measured yet",
  no_data: "no measured data yet, so general practice is appropriate",
};

export type CoachFocus = {
  skill: string | null;
  reason: NextStepReason;
  reasonText: string;
  cefrLevel: string | null;
};

/**
 * Reuses the existing next-step ranking (recurring errors -> not measured ->
 * low confidence -> not practised -> lowest score). No activity is proposed
 * here: the coach only needs the skill and the factual reason.
 */
export function coachFocus(context: TeacherContextForPrompt): CoachFocus {
  const activitySkill = context.currentActivity?.skill ?? null;
  const step = buildNextStep({
    skills: context.skills.map((item) => ({
      skill: item.skill,
      score: item.score,
      confidence: item.confidence,
      cefrLevel: item.cefrLevel,
    })),
    currentLevel: context.cefrLevel,
    recurringErrors: context.recurringErrors,
    recentlyPractised: [],
    lessonBySkill: {},
  });
  const skill = activitySkill ?? step.prioritySkill;
  const reason: NextStepReason = activitySkill && activitySkill !== step.prioritySkill
    ? "not_practised_recently"
    : step.reason;
  return {
    skill,
    reason,
    reasonText: COACH_FOCUS_REASON[reason],
    cefrLevel: context.currentActivity?.cefrLevel ?? context.cefrLevel,
  };
}

/** Prompt block appended for coach mode only. Factual, server-owned data. */
export function coachBlock(focus: CoachFocus, stage: CoachStage, turns: number): string {
  return [
    `COACH SESSION (stage ${stage}, student turn ${turns} of ${COACH_MAX_TURNS})`,
    focus.skill
      ? `Focus skill: ${focus.skill} (reason: ${focus.reasonText}).`
      : "Focus: general practice (no measured skill data available yet).",
    focus.cefrLevel
      ? `Design the challenge for CEFR level ${focus.cefrLevel}. Never state or change this level.`
      : "The level is unknown: keep the challenge simple and diagnostic.",
    COACH_STAGE_RULES[stage],
    "You are coaching, not chatting: always lead the session and end each reply with the student's next action, except in the SUMMARY stage.",
  ].join("\n");
}
