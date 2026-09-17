// Shared, client-safe prompt builders and parsers for every AI feature.
// Used by the hybrid layer (local browser AI first, cloud Gemini as fallback)
// and by the server functions that wrap the cloud gateway.

import { findLevel } from "@/lib/level";

export type AiMsg = { role: "system" | "user" | "assistant"; content: string };

export function parseJson<T>(raw: string, fallback: T): T {
  try {
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
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
    "Vary the sub-topic every time. Reply with the opening message only, no quotes or labels." + avoidList,
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

export function conversationReportMessages(messages: { role: "user" | "assistant"; content: string }[]): AiMsg[] {
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
  return parseJson<ConversationReport>(raw, {
    fluency: 0,
    grammar: 0,
    vocabulary: 0,
    summary: "We could not generate the report this time. Try another conversation.",
    suggestions: [],
    common_errors: [],
    new_words: [],
  });
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
  return parseJson<WritingFeedback>(raw, {
    corrected: originalText,
    natural: originalText,
    explanations: ["We could not analyse this text. Please try again."],
    suggestions: [],
    grammar: 0,
    vocabulary: 0,
    clarity: 0,
  });
}
