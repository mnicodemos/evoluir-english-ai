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
// Asks, not ordinary words: "I took the train", "see you again" or "the
// correct answer was" are conversation, not a practice/review/correction ask.
const PRACTICE_RE =
  /\b(let'?s practi[cs]e|i want to practi[cs]e|can we practi[cs]e|practi[cs]e (with me|more|this|that)|give me (an? )?(exercise|exercises|task|drill)|quiz me|test me|train me)\b|\b(praticar|pr[áa]tica|exerc[íi]cio|me teste|treinar)\b/i;
const CORRECT_RE =
  /\b(correct (this|my|me|it)|is (this|it|that) (right|correct)|check my|did i write (it )?(right|correctly)|fix my|any mistakes)\b|\b(corrig[ei]|corre[çc][ãa]o|est[áa] certo|est[áa] correto|verifica)\b/i;
const REVIEW_RE =
  /\b(let'?s review|review (what|this|that|the)|revise (what|this|that)|remind me|what did (we|i) (study|learn)|summari[sz]e|recap|explain (it )?again|say (it )?again)\b|\b(revis(ar|[ãa]o)|relembrar|o que (eu|n[óo]s) estudei|resumo|de novo)\b/i;

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
    "Fuller explanation, contextualised examples, small differences in usage, light metalanguage. " +
    "Conversation questions ask for reasons, experiences and comparisons (not yes/no or one-word answers); " +
    "model sentences and Idea lines use B1-B2 language (linkers such as although, unless, as long as; present perfect, conditionals, phrasal verbs). " +
    "Practice tasks target B1-B2 points (tenses in contrast, conditionals, reported speech, collocations).",
  advanced:
    "Nuance, exceptions, register and naturalness, precise wording; assume the basics are known. " +
    "Talk to the student as to a fluent adult (user decision: C1-C2 conversations must feel C1-C2): " +
    "conversation questions are open and demanding (opinions to defend, hypotheses, trade-offs, abstract or professional topics), never simple routine questions such as what time, where or how often; " +
    "model sentences and Idea lines are C1-level (complex sentences, hedging, idiomatic and less common vocabulary, inversion, cleft sentences, mixed conditionals), never A1-A2 one-clause sentences; " +
    "practice tasks target C1-C2 points (rewrite for formality or emphasis, choose the most precise word, transform a structure), never basic prepositions, articles or present simple unless the student just got that point wrong; " +
    "after correcting a basic slip (spelling, a missing word), fix it in one line and return at once to C1-level content; " +
    "push for longer, richer answers: ask the student to justify, contrast or nuance what they said.",
};

/**
 * What each CEFR level practises (user request: every level, not only the
 * three registers, gets conversations, models and tasks of its own level).
 */
export const LEVEL_TARGETS: Record<string, string> = {
  A1: "A1: present simple, to be, can, there is/are, basic questions; everyday words (family, food, routine, places); questions about the student's own life, answerable in one or two simple sentences.",
  A2: "A2: past simple, going to, comparatives and superlatives, frequency adverbs, countable/uncountable; short stories about past events and plans; questions that ask for a short description or a simple reason (because).",
  B1: "B1: present perfect vs past simple, first and second conditionals, modal verbs of advice and obligation, linkers (although, however, so that); questions about experiences, opinions with one reason, and plans.",
  B2: "B2: passive voice, third conditional, reported speech, relative clauses, phrasal verbs and collocations; questions that ask to compare, argue both sides and justify an opinion.",
  C1: "C1: mixed conditionals, inversion, cleft sentences, hedging, nuanced vocabulary and register; open questions on abstract or professional topics that ask to defend, nuance or concede a view.",
  C2: "C2: idiomatic and precise language, subtle register shifts, rhetorical structure; discussion as between fluent peers, with demanding follow-ups and precise word choice.",
};

/** The target line for the student's level, or null when the level is unknown. */
export function levelTarget(cefrLevel: string | null | undefined): string | null {
  const code = (cefrLevel ?? "").trim().toUpperCase().slice(0, 2);
  return LEVEL_TARGETS[code] ?? null;
}

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
  COACH:
    "Lead a guided study session: set the focus, give one challenge, give objective feedback on what the student produced, then the next step. Follow the COACH SESSION block.",
};

/** Short modes stay short; complex asks may go deeper. */
export function modeWordBudget(mode: TeacherMode): number {
  if (mode === "EXPLAIN" || mode === "REVIEW") return 140;
  if (mode === "CONVERSATION") return 90;
  if (mode === "COACH") return 130;
  return 110;
}
