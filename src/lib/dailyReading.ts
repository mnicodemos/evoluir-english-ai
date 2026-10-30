/**
 * Daily reading (user request, 2026-10-17: Reading had no practice surface, so
 * a Reading priority had nowhere to send the student). One short original text
 * a day per CEFR level, shared by every student of that level (generated once,
 * like the lesson templates), alternating a motivational text one day and an
 * everyday story the next (user decision). The text follows the level: short,
 * easy sentences at A1-A2, growing longer and richer as the level goes up (user
 * decision). Pure rules here; the server is dailyReading.functions.ts.
 */
import { z } from "zod";

export const READING_LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"] as const;
export type ReadingLevel = (typeof READING_LEVELS)[number];

export type ReadingTheme = "motivational" | "story";

export type ReadingSpec = {
  minWords: number;
  maxWords: number;
  questions: number;
  /** How the text is written at this level (sent to the AI). */
  language: string;
  /** What the comprehension questions check at this level. */
  questionFocus: string;
};

/** Length, language and questions grow with the level (user decision). */
export const READING_SPECS: Record<ReadingLevel, ReadingSpec> = {
  a1: {
    minWords: 60,
    maxWords: 90,
    questions: 3,
    language:
      "Very short sentences (at most 8 words), present simple only, the most common everyday words, no idioms, no phrasal verbs.",
    questionFocus: "facts stated clearly in the text (who, what, where, when).",
  },
  a2: {
    minWords: 100,
    maxWords: 140,
    questions: 3,
    language:
      "Short sentences, present and past simple, 'can' and 'going to', simple connectors (and, but, because, then), common everyday words.",
    questionFocus: "facts stated in the text and the order of events.",
  },
  b1: {
    minWords: 160,
    maxWords: 220,
    questions: 4,
    language:
      "Clear sentences of varied length, present perfect, past continuous, future forms, common phrasal verbs, everyday connectors.",
    questionFocus: "main idea, details and one simple inference.",
  },
  b2: {
    minWords: 230,
    maxWords: 300,
    questions: 4,
    language:
      "Natural, varied sentences, passive voice, conditionals, natural collocations and a few common idioms.",
    questionFocus: "main idea, inference and the meaning of a word or phrase in context.",
  },
  c1: {
    minWords: 300,
    maxWords: 380,
    questions: 5,
    language:
      "Complex sentences, sophisticated linking, nuance, less frequent vocabulary and idiomatic expressions.",
    questionFocus: "implicit meaning, inference, tone and the writer's purpose.",
  },
  c2: {
    minWords: 350,
    maxWords: 450,
    questions: 5,
    language:
      "A refined, stylistic text with precise word choice, subtle nuance, rich idioms and varied rhythm.",
    questionFocus: "implicit meaning, tone, irony or attitude, and the effect of word choices.",
  },
};

/** Any profile level ("C1", "b2", legacy names) as a reading level; B1 when unknown. */
export function readingLevel(level: string | null | undefined): ReadingLevel {
  const value = String(level ?? "").toLowerCase();
  return (READING_LEVELS as readonly string[]).includes(value) ? (value as ReadingLevel) : "b1";
}

/**
 * Today's pick rotates through eight subjects, one a day (owner report,
 * 2026-10-30: alternating motivational and story every other day read as
 * "always motivation"). null is the motivational text, once every eight days;
 * the others are a category and style like the student's own choices. The
 * offset keeps 2026-10-30, whose texts were already written as motivational,
 * on the motivational slot.
 */
const TODAY_ROTATION: readonly (ReadingChoice | null)[] = [
  null,
  { category: "daily_life", style: "story" },
  { category: "travel", style: "dialogue" },
  { category: "technology", style: "article" },
  { category: "work", style: "story" },
  { category: "culture", style: "article" },
  { category: "wellbeing", style: "dialogue" },
  { category: "daily_life", style: "dialogue" },
];
const TODAY_ROTATION_OFFSET = 4;

/** The subject of Today's pick for a São Paulo calendar day. */
export function todaysPickForDay(day: string): ReadingChoice | null {
  const days = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  if (!Number.isFinite(days)) return null;
  const size = TODAY_ROTATION.length;
  return TODAY_ROTATION[(((days - TODAY_ROTATION_OFFSET) % size) + size) % size] ?? null;
}

/** The stored theme of Today's pick: motivational only on its own day. */
export function readingThemeForDay(day: string): ReadingTheme {
  return todaysPickForDay(day) ? "story" : "motivational";
}

const THEME_BRIEF: Record<ReadingTheme, string> = {
  motivational:
    "A short motivational text about personal growth: habits, small daily steps, patience, courage, learning from mistakes or gratitude. Warm and practical, like a thoughtful reflection. No medical, therapy, religious or political content, and no quotes from real people.",
  story:
    "A short everyday story or chronicle: a slice of ordinary life (work, family, a trip, a neighbour, a small surprise) with a clear beginning, middle and end. Invented characters only.",
};

/**
 * What the student may choose to read (user request, 2026-10-22): six
 * categories and three styles. With no choice the page shows "Today's pick"
 * (the theme of the day). Each level, day, category and style is written once
 * by the AI and shared, like the daily text.
 */
export const READING_CATEGORIES = [
  "daily_life",
  "work",
  "travel",
  "technology",
  "wellbeing",
  "culture",
] as const;
export type ReadingCategory = (typeof READING_CATEGORIES)[number];
export const READING_STYLES = ["story", "article", "dialogue"] as const;
export type ReadingStyle = (typeof READING_STYLES)[number];
export type ReadingChoice = { category: ReadingCategory; style: ReadingStyle };

/** English labels for the screen (translated through uiPt). */
export const READING_CATEGORY_LABELS: Record<ReadingCategory, string> = {
  daily_life: "Daily life",
  work: "Work and career",
  travel: "Travel",
  technology: "Technology",
  wellbeing: "Health and wellbeing",
  culture: "Culture and entertainment",
};
export const READING_STYLE_LABELS: Record<ReadingStyle, string> = {
  story: "Story",
  article: "Article",
  dialogue: "Dialogue",
};

const CATEGORY_BRIEF: Record<ReadingCategory, string> = {
  daily_life: "everyday life: home, family, friends, shopping, neighbours, routines",
  work: "work and career: the office, meetings, a new job, colleagues, small business, productivity",
  travel: "travel: trips, airports, hotels, getting around a city, meeting people abroad",
  technology: "technology: apps, phones, the internet, AI, gadgets and how people use them",
  wellbeing:
    "health and wellbeing: sleep, exercise, food, rest and balance, as everyday habits (no medical advice, diagnoses or therapy claims)",
  culture:
    "culture and entertainment: films, music, books, festivals, sport, food from other countries",
};
const STYLE_BRIEF: Record<ReadingStyle, string> = {
  story: "A short story with invented characters and a clear beginning, middle and end.",
  article:
    "A short magazine-style article that explains or discusses the subject, with a clear opening and closing; no invented statistics, studies or real people's quotes.",
  dialogue:
    "A natural conversation between two or three invented people, one line per turn written as 'Name: line', with short narration only where needed.",
};

export function readingChoiceKey(choice: ReadingChoice | null): string {
  return choice ? `${choice.category}:${choice.style}` : "today";
}

export function dailyReadingMessages(
  level: ReadingLevel,
  theme: ReadingTheme,
  day: string,
  choice: ReadingChoice | null = null,
) {
  const spec = READING_SPECS[level];
  const system = [
    "You write original reading texts for Brazilian students learning English.",
    `Level: CEFR ${level.toUpperCase()}. ${spec.language}`,
    choice
      ? `Subject: ${CATEGORY_BRIEF[choice.category]}. Style: ${STYLE_BRIEF[choice.style]} Invented people only; no medical, religious or political content.`
      : `Theme: ${THEME_BRIEF[theme]}`,
    `Length: between ${spec.minWords} and ${spec.maxWords} words, in 2 to 5 short paragraphs separated by a blank line.`,
    "Write a completely original text. Never copy or adapt a published book, article or song.",
    `Then write ${spec.questions} multiple-choice comprehension questions in English about ${spec.questionFocus} Each has 4 options and exactly one correct answer; the explanation is one short sentence in Brazilian Portuguese.`,
    "Also give 6 to 10 key words or short expressions from the text with their Brazilian Portuguese meaning in this context, and a natural Brazilian Portuguese translation of the whole text, with the same paragraphs.",
    'Reply with JSON only: {"title": string, "text": string, "text_pt": string, "glossary": [{"word": string, "pt": string}], "questions": [{"question": string, "options": [string, string, string, string], "answer": number (0-3), "explanation_pt": string}]}',
  ].join("\n");
  return [
    { role: "system" as const, content: system },
    {
      role: "user" as const,
      content: choice
        ? `Write the ${choice.style} about ${choice.category.replace("_", " ")} for ${day}. Pick a fresh subject within it.`
        : `Write the daily reading for ${day}. Pick a fresh subject.`,
    },
  ];
}

const questionSchema = z
  .object({
    question: z.string().trim().min(3).max(300),
    options: z.array(z.string().trim().min(1).max(200)).length(4),
    answer: z.number().int().min(0).max(3),
    explanation_pt: z.string().trim().max(400).default(""),
  })
  .strict();

const readingSchema = z.object({
  title: z.string().trim().min(1).max(120),
  text: z.string().trim().min(40).max(4000),
  text_pt: z.string().trim().max(5000).default(""),
  glossary: z
    .array(
      z.object({ word: z.string().trim().min(1).max(60), pt: z.string().trim().min(1).max(120) }),
    )
    .max(14)
    .default([]),
  questions: z.array(questionSchema).min(1).max(6),
});

export type DailyReadingQuestion = z.infer<typeof questionSchema>;

export type DailyReadingContent = {
  title: string;
  text: string;
  textPt: string;
  glossary: { word: string; pt: string }[];
  questions: DailyReadingQuestion[];
};

export function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * The AI's JSON as a reading, or null when it does not fit the level: too short
 * or too long (with a 25% margin), or fewer questions than the level needs.
 * Distinct options and an answer inside them are required too.
 */
export function parseDailyReading(raw: string, level: ReadingLevel): DailyReadingContent | null {
  let json: unknown;
  try {
    json = JSON.parse(
      raw
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim(),
    );
  } catch {
    return null;
  }
  const parsed = readingSchema.safeParse(json);
  if (!parsed.success) return null;
  const spec = READING_SPECS[level];
  const words = wordCount(parsed.data.text);
  if (words < spec.minWords * 0.75 || words > spec.maxWords * 1.25) return null;
  const questions = parsed.data.questions.filter(
    (item) => new Set(item.options.map((option) => option.toLowerCase())).size === 4,
  );
  if (questions.length < spec.questions) return null;
  return {
    title: parsed.data.title,
    text: parsed.data.text,
    textPt: parsed.data.text_pt,
    glossary: parsed.data.glossary,
    questions: questions.slice(0, spec.questions),
  };
}

/** Right answers out of the questions; unanswered ones count as wrong. */
export function gradeReading(
  questions: readonly Pick<DailyReadingQuestion, "answer">[],
  chosen: readonly (number | null | undefined)[],
) {
  const right = questions.filter((question, index) => chosen[index] === question.answer).length;
  return {
    right,
    total: questions.length,
    score: questions.length ? Math.round((right / questions.length) * 100) : 0,
  };
}

/** The text's paragraphs, for the screen and the voice. */
export function readingParagraphs(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * The text as voice chunks of whole sentences, at most `maxChars` each (the
 * speech API takes 500 characters per request), read one after the other.
 */
export function readingSpeechChunks(text: string, maxChars = 400): string[] {
  const chunks: string[] = [];
  for (const paragraph of readingParagraphs(text)) {
    const sentences = paragraph.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [paragraph];
    let current = "";
    for (const raw of sentences) {
      const sentence = raw.trim();
      if (!sentence) continue;
      if (current && `${current} ${sentence}`.length > maxChars) {
        chunks.push(current);
        current = "";
      }
      // A single sentence longer than the limit is cut at the last space.
      let rest = sentence;
      while (rest.length > maxChars) {
        const cut = rest.lastIndexOf(" ", maxChars);
        const at = cut > 0 ? cut : maxChars;
        chunks.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
      }
      current = current ? `${current} ${rest}` : rest;
    }
    if (current) chunks.push(current);
  }
  return chunks.filter(Boolean);
}

/**
 * Fixed readings used only when the AI cannot write today's text, so the page
 * is never empty. One simple text per level band.
 */
const FALLBACK_EASY: DailyReadingContent = {
  title: "A Small Step",
  text: "Ana gets up at seven. She drinks coffee and reads one page of a book.\n\nShe works in a small shop. She likes her job. After work, she walks in the park with her dog.\n\nEvery night, Ana writes one new English word in her notebook. It is a small step. But every day, she learns a little more.",
  textPt:
    "Ana acorda às sete. Ela toma café e lê uma página de um livro.\n\nEla trabalha em uma pequena loja. Ela gosta do seu trabalho. Depois do trabalho, ela caminha no parque com o seu cachorro.\n\nToda noite, Ana escreve uma palavra nova em inglês no seu caderno. É um pequeno passo. Mas todo dia ela aprende um pouco mais.",
  glossary: [
    { word: "gets up", pt: "acorda, levanta" },
    { word: "shop", pt: "loja" },
    { word: "walks", pt: "caminha" },
    { word: "notebook", pt: "caderno" },
    { word: "step", pt: "passo" },
    { word: "a little more", pt: "um pouco mais" },
  ],
  questions: [
    {
      question: "What does Ana read in the morning?",
      options: ["A newspaper", "One page of a book", "An email", "A magazine"],
      answer: 1,
      explanation_pt: "O texto diz que ela lê uma página de um livro.",
    },
    {
      question: "Where does Ana work?",
      options: ["In a school", "In a hospital", "In a small shop", "In a park"],
      answer: 2,
      explanation_pt: "Ela trabalha em uma pequena loja.",
    },
    {
      question: "What does Ana do every night?",
      options: [
        "She watches TV",
        "She writes a new English word",
        "She calls her mother",
        "She cooks dinner",
      ],
      answer: 1,
      explanation_pt: "Toda noite ela escreve uma palavra nova em inglês.",
    },
  ],
};

const FALLBACK_RICH: DailyReadingContent = {
  title: "The Quiet Power of Small Habits",
  text: "Most people imagine that real change arrives in one dramatic moment: a new job, a big decision, a fresh start on the first day of the year. In practice, it rarely works that way. Lasting change tends to grow quietly, through habits so small that they seem almost unimportant.\n\nThink of someone learning a language. Studying for three hours once a month feels productive, but it rarely sticks. Ten minutes every day, on the other hand, keeps the new words alive and turns practice into part of who that person is. The secret is not intensity but consistency.\n\nSmall habits also protect us on difficult days. When motivation disappears, a tiny routine is still easy to keep, and keeping it reminds us that we are still moving forward. Progress, after all, is rarely a straight line; it is a collection of small promises we choose to keep.",
  textPt:
    "A maioria das pessoas imagina que a mudança real chega em um momento dramático: um novo emprego, uma grande decisão, um recomeço no primeiro dia do ano. Na prática, raramente funciona assim. A mudança duradoura costuma crescer em silêncio, por meio de hábitos tão pequenos que parecem quase sem importância.\n\nPense em alguém aprendendo um idioma. Estudar três horas uma vez por mês parece produtivo, mas raramente fica. Dez minutos todos os dias, por outro lado, mantêm as palavras novas vivas e transformam a prática em parte de quem a pessoa é. O segredo não é a intensidade, e sim a constância.\n\nPequenos hábitos também nos protegem nos dias difíceis. Quando a motivação desaparece, uma rotina pequena ainda é fácil de manter, e mantê-la nos lembra de que continuamos avançando. Afinal, o progresso raramente é uma linha reta; é um conjunto de pequenas promessas que escolhemos cumprir.",
  glossary: [
    { word: "lasting", pt: "duradouro" },
    { word: "tends to", pt: "costuma" },
    { word: "it rarely sticks", pt: "raramente fica, não se fixa" },
    { word: "on the other hand", pt: "por outro lado" },
    { word: "consistency", pt: "constância" },
    { word: "moving forward", pt: "avançando" },
    { word: "a straight line", pt: "uma linha reta" },
  ],
  questions: [
    {
      question: "According to the text, how does lasting change usually happen?",
      options: [
        "In one dramatic moment",
        "Quietly, through small habits",
        "Only at the start of the year",
        "After a big decision",
      ],
      answer: 1,
      explanation_pt:
        "O texto diz que a mudança duradoura cresce em silêncio, por pequenos hábitos.",
    },
    {
      question: "Why does the writer prefer ten minutes a day to three hours a month?",
      options: [
        "Because it is faster",
        "Because it is more intense",
        "Because consistency keeps the learning alive",
        "Because three hours is boring",
      ],
      answer: 2,
      explanation_pt: "O segredo, segundo o texto, é a constância, não a intensidade.",
    },
    {
      question: "How do small habits help on difficult days?",
      options: [
        "They remove all problems",
        "They are still easy to keep when motivation is low",
        "They replace motivation completely",
        "They make the day shorter",
      ],
      answer: 1,
      explanation_pt: "Uma rotina pequena continua fácil de manter quando falta motivação.",
    },
    {
      question: "What does the writer mean by 'progress is rarely a straight line'?",
      options: [
        "Progress is always fast",
        "Progress has ups and downs",
        "Progress is impossible",
        "Progress only happens once",
      ],
      answer: 1,
      explanation_pt:
        "Dizer que o progresso não é uma linha reta significa que ele tem altos e baixos.",
    },
    {
      question: "What is the general tone of the text?",
      options: ["Angry", "Encouraging", "Sarcastic", "Indifferent"],
      answer: 1,
      explanation_pt: "O texto é encorajador: mostra que pequenos passos levam à mudança.",
    },
  ],
};

export function fallbackReading(level: ReadingLevel): DailyReadingContent {
  const easy = level === "a1" || level === "a2";
  const base = easy ? FALLBACK_EASY : FALLBACK_RICH;
  return { ...base, questions: base.questions.slice(0, READING_SPECS[level].questions) };
}

export type ReadingToken = { text: string; word: boolean };

/**
 * The paragraph as words and the text between them (spaces, punctuation), so
 * every word can be tapped. Contractions and hyphenated words stay whole.
 */
export function readingTokens(paragraph: string): ReadingToken[] {
  const tokens: ReadingToken[] = [];
  let last = 0;
  for (const match of paragraph.matchAll(/\p{L}+(?:['’-]\p{L}+)*/gu)) {
    const at = match.index ?? 0;
    if (at > last) tokens.push({ text: paragraph.slice(last, at), word: false });
    tokens.push({ text: match[0], word: true });
    last = at + match[0].length;
  }
  if (last < paragraph.length) tokens.push({ text: paragraph.slice(last), word: false });
  return tokens;
}

/** The dictionary term for a tapped word: lower case, without a possessive 's. */
export function lookupTerm(word: string): string {
  return word.toLowerCase().replace(/’/g, "'").replace(/'s$/, "");
}

/**
 * What the text is about: the student's choice, or Today's pick of the day
 * (Motivation, or the category and style of the rotation).
 */
export function readingKindLabel(
  reading: { theme: ReadingTheme; day: string; choice?: ReadingChoice | null; fallback?: boolean },
  t: (label: string) => string = (label) => label,
): string {
  // The fixed text shown when the AI fails says what it is, not the day's subject.
  if (reading.fallback)
    return t(reading.theme === "motivational" ? "Motivation" : "Everyday story");
  const subject =
    reading.choice ?? (reading.theme === "motivational" ? null : todaysPickForDay(reading.day));
  if (subject) {
    return `${t(READING_CATEGORY_LABELS[subject.category])} · ${t(READING_STYLE_LABELS[subject.style])}`;
  }
  return t(reading.theme === "motivational" ? "Motivation" : "Everyday story");
}

/**
 * Where the text comes from (user request: the reference of an article, book
 * or magazine). Every daily reading is an original text written by EVO for the
 * student's level, never copied from a publication, so the reference says so
 * plainly instead of inventing an author or source.
 */
export function readingReference(
  reading: {
    level: string;
    theme: ReadingTheme;
    day: string;
    choice?: ReadingChoice | null;
    fallback?: boolean;
  },
  t: (label: string) => string = (label) => label,
): string {
  const kind = readingKindLabel(reading, t);
  return `${t("Original text by EVO")} · Evoluir+ English AI · ${reading.level.toUpperCase()} · ${kind} · ${reading.day}`;
}

/** The reading as plain text to copy or share: title, paragraphs and reference. */
export function readingShareText(
  reading: {
    title: string;
    text: string;
    level: string;
    theme: ReadingTheme;
    day: string;
    choice?: ReadingChoice | null;
  },
  t: (label: string) => string = (label) => label,
): string {
  return [
    reading.title,
    "",
    readingParagraphs(reading.text).join("\n\n"),
    "",
    `— ${readingReference(reading, t)}`,
  ].join("\n");
}
