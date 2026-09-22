// Coach mode for the existing AI Teacher (Phase 23B, extended in Phase 25).
// Pure, deterministic helpers: the session stage comes from the conversation
// shape, the focus reuses the existing next-step priority logic and the session
// difficulty tier is derived from the student's own production in this session.
// No new AI architecture, no new evidence model, no new score/CEFR authority.
// The tier is NOT a score, NOT confidence and NOT CEFR: it only steers the
// session and is never shown to the student as a grade.

import { buildNextStep, type NextStepReason } from "./nextStep";
import { levelRegister, type LevelRegister } from "./teacherMode";
import type { TeacherContextForPrompt } from "./teacherPrompt";

export const COACH_STAGES = [
  "START",
  "CHALLENGE",
  "FEEDBACK",
  "RETRY",
  "ADAPT",
  "SUMMARY",
] as const;
export type CoachStage = (typeof COACH_STAGES)[number];

/** Session length window: meaningful student turns, never an endless chat. */
export const COACH_MIN_TURNS = 5;
export const COACH_MAX_TURNS = 10;

/** Internal conduction tier. Not a score, not confidence, not CEFR. */
export const COACH_TIERS = ["EASY", "STANDARD", "CHALLENGE"] as const;
export type CoachTier = (typeof COACH_TIERS)[number];

const CONNECTIVES =
  /\b(because|although|however|so that|while|whereas|in order to|even if|therefore|unless|which|that's why)\b/i;

/**
 * Deterministic signal (0-1) of how much English the student actually produced
 * in one turn: length, sentence structure and linking language. It measures
 * production, not correctness, and never becomes a grade.
 */
export function productionSignal(message: string): number {
  const text = (message ?? "").trim();
  if (!text) return 0;
  const words = text.split(/\s+/).filter(Boolean).length;
  const sentences = text.split(/[.!?]+/).filter((part) => part.trim().length > 0).length;
  const lengthScore = Math.min(words / 28, 1);
  const structureScore = Math.min(Math.max(sentences - 1, 0) / 2, 1);
  const linkScore = CONNECTIVES.test(text) ? 1 : 0;
  const askedOnly = /\?\s*$/.test(text) && words < 8 ? 0.5 : 1;
  return Math.min(1, (lengthScore * 0.55 + structureScore * 0.25 + linkScore * 0.2) * askedOnly);
}

/**
 * Tier from the student's own production in this session plus the measured score
 * of the focus skill (server data). Strong, sustained production unlocks a more
 * complex situation; weak production lowers the load and adds support.
 */
export function coachTier(input: {
  productions: string[];
  focusScore?: number | null;
}): CoachTier {
  const real = input.productions.filter((message) => message.trim().length > 0);
  if (real.length === 0) return "STANDARD";
  const signals = real.map(productionSignal);
  const average = signals.reduce((total, value) => total + value, 0) / signals.length;
  const score = input.focusScore ?? null;
  if (average >= 0.62 && (score === null || score >= 65)) return "CHALLENGE";
  if (average <= 0.33 || (score !== null && score < 45)) return "EASY";
  return "STANDARD";
}

/** Planned number of student turns for this tier, inside the 5-10 window. */
export function coachPlannedTurns(tier: CoachTier): number {
  if (tier === "EASY") return 6;
  if (tier === "CHALLENGE") return COACH_MAX_TURNS;
  return 8;
}

/**
 * Stage from the student's own turns. Turn 1 sets the focus and the situation,
 * then the session cycles feedback -> retry -> adapted challenge, and the last
 * planned turn closes with a pedagogical summary.
 */
export function coachStage(studentTurns: number, plannedTurns = COACH_MAX_TURNS): CoachStage {
  const total = Math.min(Math.max(plannedTurns, COACH_MIN_TURNS), COACH_MAX_TURNS);
  if (studentTurns <= 1) return "START";
  if (studentTurns >= total) return "SUMMARY";
  const position = (studentTurns - 2) % 3;
  if (position === 0) return "FEEDBACK";
  if (position === 1) return "RETRY";
  return "ADAPT";
}

export function coachStudentTurns(history: { role: "user" | "assistant" }[]): number {
  return history.filter((message) => message.role === "user").length + 1;
}

export const COACH_STAGE_RULES: Record<CoachStage, string> = {
  START:
    "Open the session in 2 short lines: name the focus skill and say the student will practise a real situation, then put them INSIDE the situation with ONE concrete task that requires their own English. Do not answer it for them and do not teach a grammar lesson first.",
  CHALLENGE:
    "Give ONE new concrete task inside the situation, on the same focus, and wait for the student's own answer.",
  FEEDBACK:
    "React to what the student produced in one short line, then correct only the most relevant point with one corrected example, then immediately ask them to use that corrected structure in a NEW sentence about the situation.",
  RETRY:
    "Acknowledge the second attempt briefly. If it is correct, ask ONE spontaneous follow-up (why, what next, another option, an example). If it is still wrong, give a short hint or model and ask for one more attempt.",
  ADAPT:
    "Move the situation forward with an adapted task: same focus, a different angle or a new detail of the scenario, so the student applies it again in a slightly different context.",
  SUMMARY:
    "Close the session with a short summary: what was practised (the focus), what the student did well (based only on this session), what to keep practising, and ONE concrete next step. No new challenge, no numbers, no metrics.",
};

export const COACH_TIER_RULES: Record<CoachTier, string> = {
  EASY: "The student needs support: one idea per turn, shorter expected answers, simpler vocabulary, and always offer a hint, a short model or a reformulation before asking for the next attempt.",
  STANDARD:
    "The student is coping: keep the expected answer at 2-3 sentences, ask for opinion or justification, and correct only what matters.",
  CHALLENGE:
    "The student is coping well: raise the demand gradually - more autonomy, richer vocabulary, longer answers, an unexpected detail in the situation and spontaneous follow-ups.",
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
  score: number | null;
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
  const reason: NextStepReason =
    activitySkill && activitySkill !== step.prioritySkill ? "not_practised_recently" : step.reason;
  return {
    skill,
    reason,
    reasonText: COACH_FOCUS_REASON[reason],
    cefrLevel: context.currentActivity?.cefrLevel ?? context.cefrLevel,
    score: context.skills.find((item) => item.skill === skill)?.score ?? null,
  };
}

/**
 * Real-life situations per level register. Rotated by round so the same
 * structure is applied in a different context (not the full Transfer Engine).
 */
const SCENARIOS: Record<LevelRegister, string[]> = {
  beginner: [
    "an everyday conversation with a colleague",
    "ordering and asking for help while travelling",
    "a short phone call to confirm an appointment",
    "describing your routine at work",
  ],
  intermediate: [
    "a work meeting where you give your opinion",
    "a job interview question about your experience",
    "a networking conversation at an event",
    "a trip where a plan goes wrong and you decide what to do",
    "explaining a decision to your manager",
  ],
  advanced: [
    "presenting a proposal to stakeholders who push back",
    "negotiating a deadline with a demanding client",
    "leading a decision-making meeting with trade-offs",
    "a senior interview question about a failure you handled",
  ],
};

export function coachScenario(cefrLevel: string | null, round: number): string {
  const pool = SCENARIOS[levelRegister(cefrLevel)];
  const list = pool.length ? pool : SCENARIOS.intermediate;
  const index = Math.abs(Math.trunc(round)) % list.length;
  return list[index] ?? list[0]!;
}

export type CoachPlan = {
  focus: CoachFocus;
  stage: CoachStage;
  tier: CoachTier;
  turns: number;
  plannedTurns: number;
  scenario: string;
  finished: boolean;
};

/**
 * Whole session state, derived on the server from the conversation and the
 * existing pedagogical context. The client sends conversation content only.
 */
export function coachPlan(
  context: TeacherContextForPrompt,
  history: { role: "user" | "assistant"; content: string }[],
  studentMessage: string,
): CoachPlan {
  const focus = coachFocus(context);
  const turns = coachStudentTurns(history);
  const productions = [
    ...history.filter((message) => message.role === "user").map((message) => message.content),
    studentMessage,
  ].slice(1); // the first turn is the "start a session" request, not production
  const tier = coachTier({ productions, focusScore: focus.score });
  const plannedTurns = coachPlannedTurns(tier);
  const stage = coachStage(turns, plannedTurns);
  const round = Math.max(0, Math.ceil((turns - 1) / 3));
  return {
    focus,
    stage,
    tier,
    turns,
    plannedTurns: Math.min(Math.max(plannedTurns, COACH_MIN_TURNS), COACH_MAX_TURNS),
    scenario: coachScenario(focus.cefrLevel, round),
    finished: stage === "SUMMARY",
  };
}

/** Rubric of the coach session evidence. Reuses the teacher evidence model. */
export const COACH_RUBRIC_VERSION = "coach-session-v1";

/** Minimum real production for a coach turn to sustain evidence. */
export const COACH_EVIDENCE_MIN_PRODUCTION = 0.34;
export const COACH_EVIDENCE_MIN_WORDS = 8;

/**
 * Round of the coach session (1-based). Evidence is keyed by round, never by
 * message, so a retry inside the same round refines the session instead of
 * adding a second, duplicated piece of evidence.
 */
export function coachEvidenceRound(studentTurns: number): number {
  return Math.max(1, Math.ceil(Math.max(Math.trunc(studentTurns) - 1, 1) / 3));
}

/**
 * Deterministic gate for coach evidence: only a turn where the student really
 * produced English inside the session can be evidence. Opening the session,
 * asking for a session and short reactions never count as demonstrated skill.
 */
export function coachEvidenceDecision(input: {
  stage: CoachStage;
  studentMessage: string;
}): { assess: true } | { assess: false; reason: string } {
  if (input.stage === "START") return { assess: false, reason: "session_start" };
  const text = (input.studentMessage ?? "").trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < COACH_EVIDENCE_MIN_WORDS) return { assess: false, reason: "too_short" };
  if (productionSignal(text) < COACH_EVIDENCE_MIN_PRODUCTION) {
    return { assess: false, reason: "insufficient_production" };
  }
  return { assess: true };
}

/** Prompt block appended for coach mode only. Factual, server-owned data. */

export function coachBlock(plan: CoachPlan): string {
  const { focus, stage, tier, turns, plannedTurns, scenario } = plan;
  return [
    `COACH SESSION (stage ${stage}, student turn ${turns} of ${plannedTurns}, internal difficulty ${tier})`,
    focus.skill
      ? `Focus skill: ${focus.skill} (reason: ${focus.reasonText}).`
      : "Focus: general practice (no measured skill data available yet).",
    focus.cefrLevel
      ? `Design the situation and the language demand for CEFR level ${focus.cefrLevel}. Never state or change this level.`
      : "The level is unknown: keep the situation simple and diagnostic.",
    `Situation for this part of the session: ${scenario}. Keep the student inside it.`,
    COACH_STAGE_RULES[stage],
    `DIFFICULTY: ${COACH_TIER_RULES[tier]}`,
    "PRODUCTION FIRST: the student must produce more English than you. Never explain for more than 2 lines before asking. No multiple choice, no one-word answers, no ready-made answers.",
    "FEEDBACK PRIORITY: 1) mistakes that break meaning, 2) mistakes related to the focus, 3) known recurring mistakes, 4) structures central to the focus, 5) naturalness. Do not correct everything: pick at most two points.",
    "AFTER A CORRECTION: always ask the student to use the corrected structure again in a new sentence.",
    "VARIETY: do not repeat the same question pattern every turn - alternate tasks, follow-ups, short reactions, reformulations and new details of the situation.",
    "Never reveal or mention the internal difficulty, stages, turn numbers, scores, confidence or any metric.",
    "You are coaching, not chatting: always lead the session and end each reply with the student's next action, except in the SUMMARY stage.",
  ].join("\n");
}
