import { studyToday } from "@/lib/today";

export const DAILY_REFLECTIONS = [
  {
    thought: "Small consistent actions create meaningful progress.",
    reflection: "Keep building your English journey one step at a time.",
  },
  {
    thought: "Progress grows when practice becomes part of your day.",
    reflection: "Every focused minute brings confident English closer.",
  },
  {
    thought: "Confidence is built through small moments of real practice.",
    reflection: "Use what you know today and let fluency grow naturally.",
  },
  {
    thought: "The words you practise today become tomorrow's confidence.",
    reflection: "Stay curious, keep showing up and trust your progress.",
  },
  {
    thought: "Meaningful learning happens one clear step at a time.",
    reflection: "Focus on today's practice and your journey will keep moving.",
  },
  {
    thought: "Your consistency matters more than a perfect study session.",
    reflection: "Keep your rhythm and give yourself room to improve.",
  },
  {
    thought: "Every attempt helps your English become more natural.",
    reflection: "Practise with purpose today and notice how far you have come.",
  },
] as const;

function stableHash(value: string): number {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash;
}

export function getDailyReflection(userId: string, date: Date = new Date()) {
  const key = `${userId}:${studyToday(date)}`;
  return DAILY_REFLECTIONS[stableHash(key) % DAILY_REFLECTIONS.length];
}

export function getGreeting(hour: number): "Good morning" | "Good afternoon" | "Good evening" {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
