// Shared, client-safe prompt builders and strict parsers for server-side AI features.

import { findLevel } from "@/lib/level";
import { z } from "zod";

export type AiMsg = { role: "system" | "user" | "assistant"; content: string };

function parseJson(raw: string): unknown {
  try {
    const cleaned = raw
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    return JSON.parse(cleaned) as unknown;
  } catch {
    return null;
  }
}

export const scenarioPrompts: Record<string, string> = {
  everyday: "Everyday English: family, friends, hobbies and daily routine.",
  professional: "Professional English: meetings, presentations, networking and job interviews.",
  travel: "Travel English: airport, hotel check-in, restaurants and asking for directions.",
};

export function coachReplyMessages(
  scenario: string,
  level: string,
  goal: string,
  studyContext: string | undefined,
  messages: { role: "user" | "assistant"; content: string }[],
): AiMsg[] {
  const cefr = findLevel(level);
  const system = [
    "You are a CELTA-certified English teacher.",
    `Student level: ${cefr.label}. ${cefr.descriptor} Goal: "${goal}".`,
    `Scenario — ${scenarioPrompts[scenario] ?? scenarioPrompts["everyday"]}`,
    studyContext ? `Student history (personalise with it):\n${studyContext.slice(0, 900)}` : "",
    "Rules:",
    `- Speak English only, strictly at ${cefr.cefr}: grammar, vocabulary and speed the student can follow.`,
    "- Be very short: maximum 2 sentences and about 30 words in total.",
    "- Ask exactly ONE short, direct question at the end. Never ask two questions.",
    "- Correct only mistakes that break meaning, with one short line starting with 'Tip:'.",
    "- No long explanations, no lists, no repeating what the student said.",
  ]
    .filter(Boolean)
    .join("\n");
  return [{ role: "system", content: system }, ...messages];
}

export function coachOpenerMessages(
  scenario: string,
  level: string,
  goal: string,
  studyContext: string | undefined,
  avoid: string[],
): AiMsg[] {
  const avoidList = avoid.length
    ? `\nOpenings already used with this student (do NOT repeat or paraphrase them — pick a different sub-topic and question):\n${avoid.map((line) => `- ${line}`).join("\n")}`
    : "";
  const cefr = findLevel(level);
  const system = [
    "You are a CELTA-certified English teacher.",
    `Student level: ${cefr.label}. ${cefr.descriptor} Goal: "${goal}".`,
    `Practice scenario — ${scenarioPrompts[scenario] ?? scenarioPrompts["everyday"]}`,
    studyContext ? `Student history:\n${studyContext.slice(0, 700)}` : "",
    `Write ONE opening message at ${cefr.cefr}: maximum 2 short sentences, about 25 words.`,
    "Greet in a few words and end with exactly ONE short, direct question the student can answer by speaking.",
    "Vary the sub-topic every time. Reply with the opening message only, no quotes or labels." +
      avoidList,
  ]
    .filter(Boolean)
    .join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: "Start our conversation now." },
  ];
}

export type ConversationReport = {
  fluency: number;
  grammar: number;
  vocabulary: number;
  summary: string;
  suggestions: string[];
  common_errors: string[];
  new_words: string[];
};

const score = z.number().finite().min(0).max(100);
const conversationReportSchema = z
  .object({
    fluency: score,
    grammar: score,
    vocabulary: score,
    summary: z.string().trim().min(1).max(1000),
    suggestions: z.array(z.string().trim().min(1).max(300)).max(6),
    common_errors: z.array(z.string().trim().min(1).max(300)).max(6),
    new_words: z.array(z.string().trim().min(1).max(120)).max(8),
  })
  .strict();

export function conversationReportMessages(
  messages: { role: "user" | "assistant"; content: string }[],
): AiMsg[] {
  const transcript = messages
    .map((m) => `${m.role === "user" ? "Student" : "Teacher"}: ${m.content}`)
    .join("\n");
  return [
    {
      role: "system",
      content:
        "You are a CELTA English examiner. Evaluate ONLY the student's English in the transcript. " +
        'Reply with strict JSON: {"fluency":0-100,"grammar":0-100,"vocabulary":0-100,"summary":"2 sentences",' +
        '"suggestions":["3 short improvement tips"],"common_errors":["up to 3 recurring mistakes"],"new_words":["up to 4 useful words or expressions the student should learn"]}',
    },
    { role: "user", content: transcript },
  ];
}

export function parseConversationReport(raw: string): ConversationReport {
  const result = conversationReportSchema.safeParse(parseJson(raw));
  if (!result.success)
    throw new Error("The AI returned an invalid conversation report. Please try again.");
  return result.data;
}

export type WritingFeedback = {
  corrected: string;
  natural: string;
  explanations: string[];
  suggestions: string[];
  grammar: number;
  vocabulary: number;
  clarity: number;
};

const writingFeedbackSchema = z
  .object({
    corrected: z.string().trim().min(1).max(12000),
    natural: z.string().trim().min(1).max(12000),
    explanations: z.array(z.string().trim().min(1).max(500)).max(20),
    suggestions: z.array(z.string().trim().min(1).max(500)).max(10),
    grammar: score,
    vocabulary: score,
    clarity: score,
  })
  .strict();

export function writingCorrectionMessages(prompt: string, text: string, level: string): AiMsg[] {
  return [
    {
      role: "system",
      content:
        "You are a CELTA English writing teacher for Brazilian learners. " +
        'Reply with strict JSON: {"corrected":"grammatically corrected version","natural":"how a native speaker would write it",' +
        '"explanations":["short explanation of each important mistake, in simple English"],"suggestions":["2-4 tips to improve"],' +
        '"grammar":0-100,"vocabulary":0-100,"clarity":0-100}',
    },
    {
      role: "user",
      content: `Task: ${prompt || "Free writing"}\nStudent level: ${level}\n\nStudent text:\n${text}`,
    },
  ];
}

export function parseWritingFeedback(raw: string, originalText: string): WritingFeedback {
  const result = writingFeedbackSchema.safeParse(parseJson(raw));
  if (!result.success || (!result.data.corrected && originalText)) {
    throw new Error(
      "The AI returned invalid writing feedback. Your text was preserved; please try again.",
    );
  }
  return result.data;
}
