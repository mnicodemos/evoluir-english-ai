/**
 * Help from EVO (the AI Teacher) while the student writes (user request,
 * 2026-10-22): hints to start, words for the task, a check of the last
 * sentence, or any question. EVO guides and never writes the answer for the
 * student, so the correction that follows still measures their own writing.
 */
export type WritingHelpKind = "start" | "words" | "check" | "ask";

export const WRITING_HELP_KINDS: readonly WritingHelpKind[] = ["start", "words", "check", "ask"];

/** The last sentence of the draft (what "Check my last sentence" looks at). */
export function lastSentence(draft: string): string {
  const parts = draft
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

const ASKS: Record<WritingHelpKind, string> = {
  start:
    "The student does not know how to start. Give 2 or 3 short ways to begin the first sentence (sentence starters with '...' at the end), not a full answer.",
  words:
    "Suggest 6 useful words or short phrases for this task, each with its meaning in the student's language, and one tip on which to use first.",
  check:
    "Check only the student's last sentence below. Say whether it is correct; if not, show the corrected sentence and explain the main mistake in one line.",
  ask: "Answer the student's question below.",
};

export function writingHelpMessages(input: {
  kind: WritingHelpKind;
  task: string;
  level: string;
  draft: string;
  question: string;
  lang: "pt" | "en";
}) {
  const language = input.lang === "pt" ? "Brazilian Portuguese" : "simple English";
  const system = [
    "You are EVO, a warm English teacher helping a student while they write a short text in English.",
    `Student level: ${input.level}. Match your English examples to this level.`,
    `Explain in ${language}; English examples stay in English.`,
    "Never write the student's whole answer or a full paragraph for them: give hints, starters, words or one corrected sentence, so the text stays their own.",
    "Be brief: at most 80 words, plain text, short lines, no headings.",
  ].join("\n");
  const user = [
    `Writing task: ${input.task}`,
    `What the student asked: ${ASKS[input.kind]}`,
    input.kind === "check" ? `Last sentence: ${lastSentence(input.draft) || "(empty)"}` : "",
    input.kind === "ask" ? `Question: ${input.question}` : "",
    input.draft.trim()
      ? `Draft so far:\n${input.draft.trim().slice(0, 1500)}`
      : "Draft so far: (empty)",
  ]
    .filter(Boolean)
    .join("\n");
  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}
