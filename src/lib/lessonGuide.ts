/**
 * Turns the lesson content the app already stores (objective, summary and
 * flashcards) into a short Learning Guide the student can consult before the
 * quiz. It is fully deterministic: no extra AI call, no new data.
 *
 * The guide never includes the transcript and never uses quiz data, so it can
 * not leak the quiz answers.
 */

export type GuideCard = {
  word: string;
  definition?: string | null;
  answer?: string | null;
  example?: string | null;
  difficulty?: string | null;
};

export type GuideSourceLesson = {
  title: string;
  objective: string;
  summary: string;
  skill?: string | undefined;
  level?: string | undefined;
};

export type GuideSection = {
  id: "objectives" | "essentials" | "usage" | "attention" | "quick" | "before-quiz";
  emoji: string;
  title: string;
  items: string[];
};

const SKILL_ATTENTION: Record<string, string> = {
  grammar: "Check the form before the meaning: word order and verb ending are where mistakes hide.",
  vocabulary: "A word you recognise is not yet a word you can use — say it in your own sentence.",
  listening: "Do not translate while you listen: catch the key words first, details after.",
  reading: "Read the whole sentence before deciding the meaning of a new word.",
  talking: "Short and correct beats long and confusing — finish your sentence.",
  writing: "Re-read what you wrote once, looking only for verb forms and punctuation.",
};

function sentences(text: string): string[] {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 15);
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (!item || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const RULE_HINTS = [
  "use",
  "used",
  "form",
  "when",
  "means",
  "remember",
  "rule",
  "always",
  "never",
  "because",
];

/** The six-part Learning Guide of one lesson. Empty sections are dropped. */
export function buildLessonGuide(
  lesson: GuideSourceLesson,
  cards: GuideCard[] = [],
): GuideSection[] {
  const summarySentences = sentences(lesson.summary);
  const cardList = cards.filter((card) => card.word);

  const objectives = unique([
    lesson.objective?.trim() ?? "",
    ...summarySentences.slice(0, 2),
  ]).slice(0, 4);

  const essentials = unique(
    summarySentences.filter((sentence) =>
      RULE_HINTS.some((hint) => sentence.toLowerCase().includes(hint)),
    ),
  ).slice(0, 4);

  const usage = unique(
    cardList
      .map((card) => card.example?.trim() ?? "")
      .filter((example) => example.length > 8),
  ).slice(0, 4);

  const attention = unique([
    ...cardList
      .filter((card) => String(card.difficulty) === "hard")
      .map((card) =>
        `${card.word}: ${String(card.answer || card.definition || "").trim()}`.trim(),
      )
      .filter((item) => item.length > 4),
    SKILL_ATTENTION[String(lesson.skill ?? "")] ?? SKILL_ATTENTION["grammar"]!,
  ]).slice(0, 3);

  const quick = unique(
    cardList
      .map((card) => {
        const meaning = String(card.definition || card.answer || "").trim();
        return meaning ? `${card.word} — ${meaning}` : card.word;
      })
      .filter(Boolean),
  ).slice(0, 8);

  const beforeQuiz = unique([
    lesson.objective?.trim() ?? "",
    ...essentials.slice(0, 2),
    ...summarySentences.slice(-1),
  ]).slice(0, 3);

  const sections: GuideSection[] = [
    { id: "objectives", emoji: "🎯", title: "What you will learn", items: objectives },
    { id: "essentials", emoji: "📌", title: "What you need to know", items: essentials },
    { id: "usage", emoji: "💬", title: "How to use it", items: usage },
    { id: "attention", emoji: "⚠️", title: "Watch out", items: attention },
    { id: "quick", emoji: "🧠", title: "Quick guide", items: quick },
    { id: "before-quiz", emoji: "✅", title: "Before the quiz", items: beforeQuiz },
  ];

  return sections.filter((section) => section.items.length > 0);
}
