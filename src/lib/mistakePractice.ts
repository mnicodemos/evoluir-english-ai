import { z } from "zod";

/**
 * "Practise the rule" for My mistakes: one new multiple-choice question that
 * tests the same rule as a saved mistake, in a different sentence. Practice
 * only — the spaced review of the mistake itself is unchanged.
 */
export type MistakePractice = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

const practiceSchema = z.object({
  question: z.string().trim().min(5).max(300),
  options: z.array(z.string().trim().min(1).max(160)).min(3).max(4),
  answer_index: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(5).max(400),
});

/**
 * Reads the model's JSON, tolerating a fenced code block, and accepts it only
 * when the options are distinct and the answer points at one of them.
 */
export function parseMistakePractice(raw: string): MistakePractice | null {
  let value: unknown;
  try {
    value = JSON.parse(
      raw
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```$/, ""),
    );
  } catch {
    return null;
  }
  const parsed = practiceSchema.safeParse(value);
  if (!parsed.success) return null;
  const { question, options, answer_index, explanation } = parsed.data;
  const distinct = new Set(options.map((option) => option.toLowerCase()));
  if (distinct.size !== options.length || answer_index >= options.length) return null;
  return { question, options, answerIndex: answer_index, explanation };
}

export function mistakePracticePrompt(input: {
  original: string;
  corrected: string;
  explanation: string;
  category: string;
  level: string;
}) {
  return [
    {
      role: "system" as const,
      content:
        "You are a CELTA English teacher. A Brazilian student made a mistake. Write ONE new multiple-choice question that practises the SAME grammar or vocabulary rule in a DIFFERENT, natural sentence (never reuse the student's sentence). " +
        "Use a gap (___) in the question sentence. Give 3 or 4 short options: exactly one correct, the others plausible mistakes a learner would make (including the student's kind of mistake). " +
        `Keep it at the student's level (${input.level.toUpperCase()}). ` +
        'Reply with strict JSON: {"question":"sentence with ___","options":["",""],"answer_index":0,"explanation":"one or two short sentences in Brazilian Portuguese explaining the rule"}',
    },
    {
      role: "user" as const,
      content: [
        `Student wrote: ${input.original}`,
        `Correct version: ${input.corrected}`,
        input.explanation ? `Rule explained to the student: ${input.explanation}` : "",
        input.category ? `Mistake type: ${input.category}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
}
