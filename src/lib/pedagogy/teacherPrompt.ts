// Client-safe prompt builder and strict parser for the AI Teacher.
// The model produces a pedagogical reply and, at most, a SUGGESTED assessment.
// Nothing here is authoritative: the server decides what becomes evidence.

import type { AiMsg } from "@/lib/ai-prompts";

import { TEACHER_EVIDENCE_SKILLS, type TeacherEvidenceSkill } from "./teacherEvidence";
import {
  classifyTeacherMode,
  levelRegister,
  levelTarget,
  modeWordBudget,
  MODE_RULES,
  REGISTER_RULES,
  type TeacherMode,
} from "./teacherMode";

export type TeacherContextForPrompt = {
  cefrLevel: string | null;
  skills: { skill: string; score: number | null; confidence: number | null; cefrLevel: string }[];
  currentActivity?: {
    lessonTitle: string | null;
    skill: string | null;
    cefrLevel: string | null;
  };
  /** Existing platform content that matches the student's weakest skill. */
  recommendedLesson?: { title: string; skill: string | null } | null;
  recurringErrors: string[];
};

/** The main mistake of the student's message, saved for "My mistakes". */
export type TeacherMistake = {
  original: string;
  corrected: string;
  explanation: string;
  category: string;
};

export type TeacherTurn = {
  reply: string;
  assessable: boolean;
  focusSkill: TeacherEvidenceSkill | null;
  suggestedScore: number | null;
  observedError: string | null;
  mistake: TeacherMistake | null;
};

function contextBlock(context: TeacherContextForPrompt): string {
  const lines = [`Student CEFR level: ${context.cefrLevel ?? "unknown"}.`];
  if (context.skills.length) {
    lines.push(
      "Measured skills (server data, never contradict it):",
      ...context.skills.map(
        (item) =>
          `- ${item.skill}: level ${item.cefrLevel}` +
          (item.score === null ? " (not measured yet)" : `, score ${Math.round(item.score)}`) +
          (item.confidence === null ? "" : `, confidence ${item.confidence.toFixed(2)}`),
      ),
    );
  } else {
    lines.push("No measured skills yet: start from simple diagnostic practice.");
  }
  if (context.currentActivity) {
    lines.push(
      `Current activity: ${context.currentActivity.lessonTitle ?? "free practice"}` +
        (context.currentActivity.skill ? `, focus ${context.currentActivity.skill}` : "") +
        (context.currentActivity.cefrLevel ? `, level ${context.currentActivity.cefrLevel}` : ""),
    );
  }
  if (context.recommendedLesson) {
    lines.push(
      `Existing lesson in this app that matches the student's weakest area: "${context.recommendedLesson.title}"` +
        (context.recommendedLesson.skill ? ` (${context.recommendedLesson.skill})` : "") +
        ". You may suggest reviewing it, but never invent other lessons or claim it was completed.",
    );
  }
  if (context.recurringErrors.length) {
    lines.push(`Recurring mistakes to watch: ${context.recurringErrors.join("; ")}.`);
  }
  return lines.join("\n");
}

export function teacherTurnMessages(input: {
  context: TeacherContextForPrompt;
  objective: string;
  studentMessage: string;
  history: { role: "user" | "assistant"; content: string }[];
  /** Server-classified interaction mode; derived deterministically when absent. */
  mode?: TeacherMode;
  /** Server-built coach session block (coach mode only). */
  coachBlock?: string;
  /** Server-decided: this reply closes a stretch of free chat with a recap. */
  recap?: boolean;
}): AiMsg[] {
  const mode =
    input.mode ?? classifyTeacherMode({ message: input.studentMessage, history: input.history });
  const register = levelRegister(input.context.cefrLevel);
  const system = [
    "You are a CELTA-certified English teacher in a one-to-one tutoring session with a Brazilian learner.",
    "",
    "CONTEXT",
    contextBlock(input.context),
    "",
    "OBJECTIVE",
    input.objective,
    "",
    `MODE: ${mode}`,
    MODE_RULES[mode],
    "",
    ...(input.coachBlock ? [input.coachBlock, ""] : []),
    `LEVEL REGISTER: ${register}`,
    REGISTER_RULES[register],
    ...(levelTarget(input.context.cefrLevel)
      ? [
          `LEVEL TARGET (conversation topics, model sentences, Idea lines and practice tasks stay at this level): ${levelTarget(input.context.cefrLevel)}`,
        ]
      : []),
    ...(register === "beginner"
      ? [
          '- Portuguese support: when the student writes in Portuguese or repeats the same kind of mistake from the recent messages, add ONE short line in Brazilian Portuguese starting exactly with "Em português:" that explains the point. Everything else stays in English.',
        ]
      : []),
    "",
    "PEDAGOGICAL RULES",
    "- Teach: explain the point briefly, then ask ONE question or give ONE short practice task.",
    "- Adapt to the level in CONTEXT. Never assume knowledge the context does not support.",
    "- Correct the student's English when they produce language: name the mistake, explain it in one line, show the correct form, then ask them to try a similar sentence.",
    "- Make the student produce the answer. Do not simply hand over the finished answer when the goal is learning.",
    `- Keep the whole reply under ${modeWordBudget(mode) + (input.recap ? 30 : 0)} words. Plain English, no lists longer than 3 items, no emojis.`,
    "- When giving examples, model sentences, useful words, or asking the student to write something, put them in a new paragraph as bullet points (markdown list).",
    // The chat highlights these two exact line formats (see formatTeacherReply).
    '- When you correct the student, put the corrected sentence alone on its own line, starting exactly with "Correct form: ".',
    '- When you offer the student ideas or topics to write or talk about, put each on its own line as "Idea 1: ...", "Idea 2: ..." (at most 3).',
    "- Never mention scores, CEFR letters as a verdict, internal data, other students or system details.",
    "",
    "PRACTICE TASKS",
    '- Every task starts with ONE line saying exactly what to do (for example "Fill the gap with the correct article:" or "Rewrite the sentence in the past:"), then shows ONE solved example, then the item(s) for the student.',
    "- A gap is always shown as ___ and the student must know what kind of word goes there.",
    "- Pitch every task at the student's CEFR level in CONTEXT: never practise a point clearly below it unless the student just got that point wrong.",
    "- Connect the task to what the student just wrote or asked, not to a random topic.",
    ...(input.recap
      ? [
          "",
          "RECAP (this reply closes this part of the session)",
          '- After answering, end with two short lines: "Today you practised: ..." (the point or points of the recent messages) and "To review: ..." (the student\'s main mistake in these messages and its correct form, or one useful expression when there was no mistake).',
          "- Then invite the student to continue or to open My mistakes later.",
        ]
      : []),
    "",
    "CONTINUITY",
    "- Use the recent messages: do not repeat an explanation you already gave, and do not ask again something the student already answered.",
    "",
    "CONSTRAINTS",
    "- Known -> explain. Unknown -> ask the student. Not available in CONTEXT -> say you do not have that information.",
    "- Never state or change the student's level, score, confidence, progress, completed activities or plan; those come from the app, not from you.",
    "- Never invent lessons, exercises or history that are not in CONTEXT.",
    "",
    "OUTPUT",
    'Reply with strict JSON only: {"reply":"your teaching message to the student",' +
      '"assessable":true only when the student PRODUCED English that shows command (or lack of command) of a skill,' +
      `"focus_skill":one of ${TEACHER_EVIDENCE_SKILLS.join("|")} or null,` +
      '"suggested_score":0-100 quality of that production or null,' +
      '"observed_error":"one short description of the main mistake" or null,' +
      '"mistake":{"original":"the exact wrong words copied from the student\'s LAST message","corrected":"the same words, corrected","explanation":"one short line","category":"grammar|vocabulary|spelling|word order"} or null}',
    "Set assessable=false for questions, greetings, requests for explanation, Portuguese-only messages or anything that is not the student's own English production. suggested_score is only a suggestion; it is not an official grade.",
    "Set mistake only for a real mistake in the student's LAST message (never for style preferences); original must be copied exactly from that message, as short as possible (the wrong words plus 1-3 words around them).",
    "SCORING (suggested_score): 90-100 accurate AND varied, natural language at or above the student's level; 75-89 accurate but simple or with one small slip; 55-74 understandable with clear mistakes; below 55 hard to understand. A short, very simple correct sentence is 60-75, never 100.",
  ].join("\n");

  return [
    { role: "system", content: system },
    ...input.history,
    { role: "user", content: input.studentMessage },
  ];
}

/**
 * Reads the model's turn, keeping whatever is usable (user report, 2026-10-24:
 * with the thinking step off, a stray key, an unknown skill or an empty
 * mistake made the whole answer fail with "Something went wrong"). Only the
 * reply is required; every other field falls back to "nothing to assess", and
 * the evidence gate (teacherEvidenceDecision) still refuses an invalid skill or
 * score. A plain-text answer is shown as the reply, never assessed.
 */
export function parseTeacherTurn(raw: string): TeacherTurn {
  const text = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  let value: unknown = null;
  try {
    value = JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        value = JSON.parse(text.slice(start, end + 1));
      } catch {
        value = null;
      }
    }
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    // A plain answer (no JSON at all) is still the teacher's reply.
    if (text && !text.startsWith("{") && !text.startsWith("[")) {
      return {
        reply: text.slice(0, 1800),
        assessable: false,
        focusSkill: null,
        suggestedScore: null,
        observedError: null,
        mistake: null,
      };
    }
    throw new Error("The AI teacher returned an invalid answer. Please try again.");
  }

  const turn = value as Record<string, unknown>;
  const reply = typeof turn["reply"] === "string" ? turn["reply"].trim() : "";
  if (!reply) throw new Error("The AI teacher returned an invalid answer. Please try again.");

  const skill = TEACHER_EVIDENCE_SKILLS.find((item) => item === turn["focus_skill"]) ?? null;
  const rawScore = turn["suggested_score"];
  const score =
    typeof rawScore === "number"
      ? rawScore
      : typeof rawScore === "string" && rawScore.trim() !== ""
        ? Number(rawScore)
        : NaN;
  const observed = turn["observed_error"];
  return {
    reply: reply.slice(0, 1800),
    // An unknown skill is never assessed.
    assessable: turn["assessable"] === true && skill !== null,
    focusSkill: skill,
    suggestedScore: Number.isFinite(score) && score >= 0 && score <= 100 ? score : null,
    observedError:
      typeof observed === "string" && observed.trim() ? observed.trim().slice(0, 300) : null,
    mistake: readMistake(turn["mistake"]),
  };
}

function readMistake(value: unknown): TeacherTurn["mistake"] {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const text = (key: string, max: number) =>
    typeof item[key] === "string" ? (item[key] as string).trim().slice(0, max) : "";
  const original = text("original", 300);
  const corrected = text("corrected", 300);
  if (!original || !corrected) return null;
  return {
    original,
    corrected,
    explanation: text("explanation", 500),
    category: text("category", 40) || "grammar",
  };
}
