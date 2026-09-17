import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findLevel } from "@/lib/level";

import { callGateway, parseJson } from "./ai-gateway.server";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const scenarioPrompts: Record<string, string> = {
  everyday: "Everyday English: family, friends, hobbies and daily routine.",
  professional: "Professional English: meetings, presentations, networking and job interviews.",
  travel: "Travel English: airport, hotel check-in, restaurants and asking for directions.",
};

function coachSystemPrompt(scenario: string, level: string, goal: string, studyContext?: string) {
  const cefr = findLevel(level);
  return [
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
}

export const coachReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        scenario: z.string().default("everyday"),
        level: z.string().default("intermediate"),
        goal: z.string().default("conversation"),
        studyContext: z.string().max(2000).optional(),
        messages: z.array(messageSchema).min(1).max(60),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const text = await callGateway([
      {
        role: "system",
        content: coachSystemPrompt(data.scenario, data.level, data.goal, data.studyContext),
      },
      ...data.messages,
    ], false, { userId: context.userId, operation: "talking" });
    return { reply: text.trim() };
  });

export const coachOpener = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        scenario: z.string().default("everyday"),
        level: z.string().default("intermediate"),
        goal: z.string().default("conversation"),
        studyContext: z.string().max(2000).optional(),
        avoid: z.array(z.string().max(500)).max(30).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const avoidList = data.avoid.length
      ? `\nOpenings already used with this student (do NOT repeat or paraphrase them — pick a different sub-topic and question):\n${data.avoid.map((line) => `- ${line}`).join("\n")}`
      : "";
    const text = await callGateway([
      {
        role: "system",
        content: [
          "You are a CELTA-certified English teacher.",
          `Student level: ${findLevel(data.level).label}. ${findLevel(data.level).descriptor} Goal: "${data.goal}".`,
          `Practice scenario — ${scenarioPrompts[data.scenario] ?? scenarioPrompts["everyday"]}`,
          data.studyContext ? `Student history:\n${data.studyContext.slice(0, 700)}` : "",
          `Write ONE opening message at ${findLevel(data.level).cefr}: maximum 2 short sentences, about 25 words.`,
          "Greet in a few words and end with exactly ONE short, direct question the student can answer by speaking.",
          "Vary the sub-topic every time. Reply with the opening message only, no quotes or labels." + avoidList,
        ]
          .filter(Boolean)
          .join("\n"),
      },
      { role: "user", content: "Start our conversation now." },
    ], false, { userId: context.userId, operation: "talking" });
    return { opener: text.trim() };
  });

export type ConversationReport = {
  fluency: number;
  grammar: number;
  vocabulary: number;
  summary: string;
  suggestions: string[];
  common_errors: string[];
  new_words: string[];
};

export const conversationReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ messages: z.array(messageSchema).min(1).max(60) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ConversationReport> => {
    const transcript = data.messages
      .map((m) => `${m.role === "user" ? "Student" : "Teacher"}: ${m.content}`)
      .join("\n");

    const raw = await callGateway(
      [
        {
          role: "system",
          content:
            "You are a CELTA English examiner. Evaluate ONLY the student's English in the transcript. " +
            'Reply with strict JSON: {"fluency":0-100,"grammar":0-100,"vocabulary":0-100,"summary":"2 sentences",' +
            '"suggestions":["3 short improvement tips"],"common_errors":["up to 3 recurring mistakes"],"new_words":["up to 4 useful words or expressions the student should learn"]}',
        },
        { role: "user", content: transcript },
      ],
      true,
      { userId: context.userId, operation: "talking" },
    );

    return parseJson<ConversationReport>(raw, {
      fluency: 0,
      grammar: 0,
      vocabulary: 0,
      summary: "We could not generate the report this time. Try another conversation.",
      suggestions: [],
      common_errors: [],
      new_words: [],
    });
  });

export type WritingFeedback = {
  corrected: string;
  natural: string;
  explanations: string[];
  suggestions: string[];
  grammar: number;
  vocabulary: number;
  clarity: number;
};

export const correctWriting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        prompt: z.string().max(300).default(""),
        text: z.string().min(10).max(4000),
        level: z.string().default("intermediate"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<WritingFeedback> => {
    const raw = await callGateway(
      [
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
          content: `Task: ${data.prompt || "Free writing"}\nStudent level: ${data.level}\n\nStudent text:\n${data.text}`,
        },
      ],
      true,
      { userId: context.userId, operation: "writing_correction" },
    );

    return parseJson<WritingFeedback>(raw, {
      corrected: data.text,
      natural: data.text,
      explanations: ["We could not analyse this text. Please try again."],
      suggestions: [],
      grammar: 0,
      vocabulary: 0,
      clarity: 0,
    });
  });
