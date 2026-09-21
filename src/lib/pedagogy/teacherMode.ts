// Deterministic pedagogical mode + level register for the AI Teacher (Phase 9).
// Pure functions, no model call, no new authority: the CEFR level always comes
// from the server context and the mode is derived from the student's own turn.

export const TEACHER_MODES = [
  "EXPLAIN",
  "PRACTICE",
  "CORRECT",
  "EXAMPLE",
  "REVIEW",
  "CONVERSATION",
  // Guided study session (Phase 23B). Never inferred from the message: it is
  // only used when the student explicitly starts a coach session.
  "COACH",
] as const;
export type TeacherMode = (typeof TEACHER_MODES)[number];

const EXPLAIN_RE =
  /\b(why|what is|what's|what are|how do|how does|explain|difference between|when do i|meaning of|grammar rule)\b|\b(por que|porque|o que (é|significa)|explica|explicar|qual a diferença|quando usar)\b/i;
const EXAMPLE_RE =
  /\b(example|examples|for instance|show me|give me a sentence)\b|\b(exemplo|exemplos|me d[êe] (um|uma))\b/i;
const PRACTICE_RE =
  /\b(practi[cs]e|exercise|exercises|quiz me|test me|drill|let'?s practi[cs]e|train)\b|\b(praticar|pr[áa]tica|exerc[íi]cio|me teste|treinar)\b/i;
const CORRECT_RE =
  /\b(correct|correction|is this right|is it right|check my|did i write|fix my)\b|\b(corrig[ei]|corre[çc][ãa]o|est[áa] certo|est[áa] correto|verifica)\b/i;
const REVIEW_RE =
  /\b(review|revise|remind me|what did (we|i) (study|learn)|summari[sz]e|recap|again)\b|\b(revis(ar|[ãa]o)|relembrar|o que (eu|n[óo]s) estudei|resumo|de novo)\b/i;

/** Sentence-ish English production: enough words and no question mark. */
function looksLikeProduction(message: string): boolean {
  const words = message.trim().split(/\s+/).filter(Boolean);
  return words.length >= 4 && !message.includes("?");
}

/**
 * Deterministic classification of what the student is trying to do. Order
 * matters: explicit asks win over inference from the message shape.
 */
export function classifyTeacherMode(input: {
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
}): TeacherMode {
  const message = input.message ?? "";
  if (CORRECT_RE.test(message)) return "CORRECT";
  if (EXAMPLE_RE.test(message)) return "EXAMPLE";
  if (PRACTICE_RE.test(message)) return "PRACTICE";
  if (REVIEW_RE.test(message)) return "REVIEW";
  if (EXPLAIN_RE.test(message)) return "EXPLAIN";
  if (looksLikeProduction(message)) {
    // The student produced English right after a practice prompt: treat it as
    // work to be corrected, otherwise keep the conversation going.
    const lastTeacher = [...(input.history ?? [])].reverse().find((m) => m.role === "assistant");
    if (lastTeacher && /\b(try|write|complete|your turn|fill|say)\b/i.test(lastTeacher.content)) {
      return "CORRECT";
    }
    return "CONVERSATION";
  }
  return "CONVERSATION";
}

export type LevelRegister = "beginner" | "intermediate" | "advanced";

/** Maps the server-owned CEFR level to a language register. Never inferred from the chat. */
export function levelRegister(cefrLevel: string | null | undefined): LevelRegister {
  const code = (cefrLevel ?? "").trim().toUpperCase().slice(0, 2);
  if (code === "C1" || code === "C2") return "advanced";
  if (code === "B1" || code === "B2") return "intermediate";
  return "beginner";
}

export const REGISTER_RULES: Record<LevelRegister, string> = {
  beginner:
    "Short sentences, simple everyday vocabulary, one idea at a time, concrete examples. Avoid metalanguage.",
  intermediate:
    "Fuller explanation, contextualised examples, small differences in usage, light metalanguage.",
  advanced:
    "Nuance, exceptions, register and naturalness, precise wording; assume the basics are known.",
};

export const MODE_RULES: Record<TeacherMode, string> = {
  EXPLAIN:
    "Explain the point in a few short lines, give one clear example, then ask one checking question.",
  PRACTICE:
    "Give ONE short practice task (2-4 items maximum) and wait for the student's answer. Do not solve it for them.",
  CORRECT:
    "Name the mistake, explain it in one short line, show the correct form, give one example, then ask the student to try a similar sentence.",
  EXAMPLE: "Give 2-3 short model examples and ask the student to produce one of their own.",
  REVIEW:
    "Recap only what the context supports, in a few lines, then offer one quick check. Never invent past activity or progress.",
  CONVERSATION:
    "Keep a natural conversation going with one follow-up question; correct only mistakes that matter.",
};

/** Short modes stay short; complex asks may go deeper. */
export function modeWordBudget(mode: TeacherMode): number {
  if (mode === "EXPLAIN" || mode === "REVIEW") return 140;
  if (mode === "CONVERSATION") return 90;
  return 110;
}
