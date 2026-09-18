// Client-safe prompt builder and strict parser for the AI Teacher.
// The model produces a pedagogical reply and, at most, a SUGGESTED assessment.
// Nothing here is authoritative: the server decides what becomes evidence.

import { z } from "zod";

import type { AiMsg } from "@/lib/ai-prompts";

import { TEACHER_EVIDENCE_SKILLS, type TeacherEvidenceSkill } from "./teacherEvidence";
import {
  classifyTeacherMode,
  levelRegister,
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

export type TeacherTurn = {
  reply: string;
  assessable: boolean;
  focusSkill: TeacherEvidenceSkill | null;
  suggestedScore: number | null;
  observedError: string | null;
};

const teacherTurnSchema = z
  .object({
    reply: z.string().trim().min(1).max(1800),
    assessable: z.boolean(),
    focus_skill: z.enum(TEACHER_EVIDENCE_SKILLS).nullable().optional(),
    suggested_score: z.number().finite().min(0).max(100).nullable().optional(),
    observed_error: z.string().trim().max(300).nullable().optional(),
  })
  .strict();

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
}): AiMsg[] {
  const mode =
    input.mode ??
    classifyTeacherMode({ message: input.studentMessage, history: input.history });
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
    `LEVEL REGISTER: ${register}`,
    REGISTER_RULES[register],
    "",
    "PEDAGOGICAL RULES",
    "- Teach: explain the point briefly, then ask ONE question or give ONE short practice task.",
    "- Adapt to the level in CONTEXT. Never assume knowledge the context does not support.",
    "- Correct the student's English when they produce language: name the mistake, explain it in one line, show the correct form, then ask them to try a similar sentence.",
    "- Make the student produce the answer. Do not simply hand over the finished answer when the goal is learning.",
    `- Keep the whole reply under ${modeWordBudget(mode)} words. Plain English, no lists longer than 3 items, no emojis.`,
    "- When giving examples, model sentences, useful words, or asking the student to write something, put them in a new paragraph as bullet points (markdown list).",
    "- Never mention scores, CEFR letters as a verdict, internal data, other students or system details.",
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
      '"observed_error":"one short description of the main mistake" or null}',
    "Set assessable=false for questions, greetings, requests for explanation, Portuguese-only messages or anything that is not the student's own English production. suggested_score is only a suggestion; it is not an official grade.",
  ].join("\n");

  return [
    { role: "system", content: system },
    ...input.history,
    { role: "user", content: input.studentMessage },
  ];
}

export function parseTeacherTurn(raw: string): TeacherTurn {
  let value: unknown = null;
  try {
    value = JSON.parse(
      raw
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim(),
    );
  } catch {
    value = null;
  }
  const parsed = teacherTurnSchema.safeParse(value);
  if (!parsed.success)
    throw new Error("The AI teacher returned an invalid answer. Please try again.");
  return {
    reply: parsed.data.reply,
    assessable: parsed.data.assessable,
    focusSkill: parsed.data.focus_skill ?? null,
    suggestedScore: parsed.data.suggested_score ?? null,
    observedError: parsed.data.observed_error ?? null,
  };
}
