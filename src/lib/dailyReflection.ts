import { studyToday } from "@/lib/today";

export const DAILY_REFLECTIONS = [
  {
    thought: {
      en: "Great things are built by small actions.",
      pt: "Grandes conquistas são construídas por pequenas ações.",
    },
    reflection: {
      en: "Keep building your consistency.",
      pt: "Continue construindo sua consistência.",
    },
  },
  {
    thought: {
      en: "Direct your energy toward what you can practise today.",
      pt: "Direcione sua energia para o que você pode praticar hoje.",
    },
    reflection: {
      en: "Let today's effort be enough for today.",
      pt: "Permita que o esforço de hoje seja suficiente por hoje.",
    },
  },
  {
    thought: {
      en: "Progress begins when intention becomes action.",
      pt: "O progresso começa quando a intenção se transforma em ação.",
    },
    reflection: {
      en: "Take the next useful step with attention.",
      pt: "Dê o próximo passo útil com atenção.",
    },
  },
  {
    thought: {
      en: "Patience gives steady practice time to become strength.",
      pt: "A paciência dá tempo para a prática constante se tornar força.",
    },
    reflection: {
      en: "Respect your pace and remain present.",
      pt: "Respeite seu ritmo e permaneça presente.",
    },
  },
  {
    thought: {
      en: "What you repeat with purpose shapes what you become.",
      pt: "O que você repete com propósito molda quem você se torna.",
    },
    reflection: {
      en: "Choose one meaningful practice and do it well.",
      pt: "Escolha uma prática significativa e faça-a bem.",
    },
  },
  {
    thought: {
      en: "A calm mind learns more clearly than a hurried one.",
      pt: "Uma mente serena aprende com mais clareza do que uma mente apressada.",
    },
    reflection: {
      en: "Practise with calm attention, not pressure.",
      pt: "Pratique com atenção serena, não com pressão.",
    },
  },
  {
    thought: {
      en: "Each new attempt is evidence that you are moving forward.",
      pt: "Cada nova tentativa é uma evidência de que você está avançando.",
    },
    reflection: {
      en: "Value the practice, not only the result.",
      pt: "Valorize a prática, não apenas o resultado.",
    },
  },
] as const;

function stableHash(value: string): number {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash;
}

export function getDailyReflection(userId: string, date: Date = new Date()) {
  const key = `${userId}:${studyToday(date)}`;
  const reflection = DAILY_REFLECTIONS[stableHash(key) % DAILY_REFLECTIONS.length];
  if (!reflection) throw new Error("Daily reflection collection is empty");
  return reflection;
}

export function getGreeting(hour: number): "Good morning" | "Good afternoon" | "Good evening" {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
