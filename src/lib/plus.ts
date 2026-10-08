// Evoluir+ Plus: 1 to 3 personal goals, one small daily step per goal from
// EVO, one shared streak and one evolution score. Pure rules here, so the
// server, the page and the tests agree.

export const PLUS_MAX_GOALS = 3;
export const PLUS_AREAS = ["english", "money", "health", "other"] as const;
export type PlusArea = (typeof PLUS_AREAS)[number];

export type PlusLang = "pt" | "en";

export type PlusGoal = { id: string; title: string; area: PlusArea };
export type PlusStep = {
  id: string;
  goalId: string;
  day: string;
  text: string;
  doneAt: string | null;
};

/** Days of history the evolution score looks back on. */
export const PLUS_SCORE_DAYS = 14;
const MAX_STEP_CHARS = 160;

/** Guess the area from the goal's words, so the student only types the goal. */
export function guessPlusArea(title: string): PlusArea {
  const text = title.toLowerCase();
  if (/ingl[eê]s|english|speak|falar|reuni|listening|vocab|fluen/.test(text)) return "english";
  if (/r\$|reais|guardar|poupar|econom|d[ií]vida|invest|dinheiro|money|save|gast/.test(text))
    return "money";
  if (
    /caminh|corr|treino|academia|exerc|dorm|sono|[aá]gua|peso|sa[uú]de|walk|run|sleep|gym/.test(
      text,
    )
  )
    return "health";
  return "other";
}

const FALLBACK_STEPS: Record<PlusArea, Record<PlusLang, string[]>> = {
  english: {
    pt: [
      "Fale em voz alta por 5 minutos com a EVO no AI Speaking.",
      "Anote 3 frases em inglês que você usaria nesse objetivo e leia em voz alta.",
      "Faça uma lição curta da sua trilha de inglês.",
      "Revise 10 palavras no Vocabulário.",
      "Escreva 3 frases sobre seu dia em inglês no Writing.",
    ],
    en: [
      "Speak out loud for 5 minutes with EVO in AI Speaking.",
      "Write 3 English sentences you would use for this goal and read them aloud.",
      "Do one short lesson from your English path.",
      "Review 10 words in Vocabulary.",
      "Write 3 sentences about your day in Writing.",
    ],
  },
  money: {
    pt: [
      "Anote todos os gastos de hoje, até os pequenos.",
      "Separe hoje um valor pequeno para essa meta, mesmo que seja R$ 5.",
      "Revise uma assinatura ou gasto fixo que você pode cortar.",
      "Passe um dia sem compras por impulso.",
      "Confira quanto já juntou e anote o número.",
    ],
    en: [
      "Write down every expense of the day, even the small ones.",
      "Set aside a small amount for this goal today, even R$ 5.",
      "Review one subscription or fixed cost you could cut.",
      "Spend the day without impulse purchases.",
      "Check how much you have saved so far and write the number down.",
    ],
  },
  health: {
    pt: [
      "Caminhe 15 minutos hoje.",
      "Beba 2 copos de água a mais do que o normal.",
      "Faça 10 minutos de alongamento.",
      "Vá dormir 20 minutos mais cedo hoje.",
      "Suba escadas ou caminhe em vez de usar o carro em um trajeto curto.",
    ],
    en: [
      "Walk for 15 minutes today.",
      "Drink 2 more glasses of water than usual.",
      "Do 10 minutes of stretching.",
      "Go to bed 20 minutes earlier tonight.",
      "Take the stairs or walk instead of driving on one short trip.",
    ],
  },
  other: {
    pt: [
      "Dedique 10 minutos a essa meta hoje, sem distrações.",
      "Escreva o próximo passo concreto dessa meta e faça a primeira parte.",
      "Conte para alguém sobre essa meta.",
      "Revise o que você já fez por essa meta e anote uma melhoria.",
      "Elimine uma distração que atrapalha essa meta.",
    ],
    en: [
      "Spend 10 focused minutes on this goal today.",
      "Write the next concrete step of this goal and do the first part.",
      "Tell someone about this goal.",
      "Review what you have done for this goal and note one improvement.",
      "Remove one distraction that gets in the way of this goal.",
    ],
  },
};

/** A step that never needs the AI: rotates by day, so it changes daily. */
export function fallbackPlusStep(area: PlusArea, day: string, lang: PlusLang): string {
  const list = FALLBACK_STEPS[area][lang];
  const dayNumber = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  return list[((dayNumber % list.length) + list.length) % list.length]!;
}

export function plusStepsPrompt(input: {
  goals: { id: string; title: string; area: PlusArea; recent: string[] }[];
  lang: PlusLang;
  englishLevel: string;
}) {
  const language = input.lang === "pt" ? "Brazilian Portuguese" : "English";
  return [
    {
      role: "system" as const,
      content:
        "You are EVO, a warm coach in the Evoluir+ app. For each goal, give ONE small, concrete " +
        "step the student can finish today in 5 to 20 minutes. One short sentence, imperative, " +
        `no emojis, at most 140 characters, written in ${language}. Do not repeat recent steps. ` +
        "English goals may point to the app's practice (AI Speaking, Vocabulary, Writing, " +
        `lessons) at CEFR level ${input.englishLevel.toUpperCase()}. Never give medical or ` +
        "investment advice. Reply only with JSON: " +
        '{"steps":[{"goal_id":"<id>","step":"<text>"}]}',
    },
    {
      role: "user" as const,
      content: JSON.stringify(
        input.goals.map((goal) => ({
          goal_id: goal.id,
          goal: goal.title,
          area: goal.area,
          recent_steps: goal.recent.slice(0, 5),
        })),
      ),
    },
  ];
}

/** Salvages the AI reply step by step; a goal without a valid step gets none. */
export function parsePlusSteps(raw: string, goalIds: readonly string[]): Map<string, string> {
  const steps = new Map<string, string>();
  let parsed: unknown;
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    parsed = JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw);
  } catch {
    return steps;
  }
  const items = (parsed as { steps?: unknown })?.steps;
  if (!Array.isArray(items)) return steps;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const { goal_id: goalId, step } = item as { goal_id?: unknown; step?: unknown };
    if (typeof goalId !== "string" || !goalIds.includes(goalId) || steps.has(goalId)) continue;
    if (typeof step !== "string") continue;
    const text = step.replace(/\s+/g, " ").trim();
    if (text.length < 8) continue;
    steps.set(
      goalId,
      text.length > MAX_STEP_CHARS ? `${text.slice(0, MAX_STEP_CHARS - 1)}…` : text,
    );
  }
  return steps;
}

/** The Plus part of a study day: at least one step that day, all of them done. */
export function plusDayComplete(steps: readonly { doneAt: string | null }[]) {
  return steps.length > 0 && steps.every((step) => step.doneAt !== null);
}

export type EvolutionScore = {
  /** 0–100, or null before there is anything to measure. */
  score: number | null;
  /** Average of the measured English skills (evidence layer), 0–100. */
  english: number | null;
  /** Share of the goal steps done in the last PLUS_SCORE_DAYS days, 0–100. */
  goals: number | null;
};

/**
 * One evolution score across Evoluir+: the English skills and the goal steps
 * weigh the same; when only one is measured, the score is that one.
 */
export function evolutionScore(input: {
  englishSkills: readonly (number | null)[];
  stepsGiven: number;
  stepsDone: number;
}): EvolutionScore {
  const measured = input.englishSkills.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  const english = measured.length
    ? Math.round(measured.reduce((sum, value) => sum + value, 0) / measured.length)
    : null;
  const goals =
    input.stepsGiven > 0
      ? Math.round((Math.min(input.stepsDone, input.stepsGiven) / input.stepsGiven) * 100)
      : null;
  const parts = [english, goals].filter((value): value is number => value !== null);
  return {
    score: parts.length
      ? Math.round(parts.reduce((sum, value) => sum + value, 0) / parts.length)
      : null,
    english,
    goals,
  };
}
