import { cn } from "@/lib/utils";

export type League = {
  name: string;
  index: number;
  from: string;
  to: string;
  glow: string;
  /** Text colour that stays readable over this badge's gradient. */
  ink: string;
  /** Outline colour behind the text, opposite of the ink. */
  inkEdge: string;
};

const DARK_INK = { ink: "oklch(0.22 0.02 260)", inkEdge: "oklch(1 0 0 / 0.75)" };
const LIGHT_INK = { ink: "oklch(0.99 0 0)", inkEdge: "oklch(0.15 0.02 260 / 0.6)" };

const LEAGUES: (Omit<League, "index"> & { pt: string })[] = [
  { name: "Bronze", pt: "Bronze", from: "oklch(0.70 0.10 60)", to: "oklch(0.48 0.09 50)", glow: "oklch(0.70 0.10 60 / 0.55)", ...LIGHT_INK },
  { name: "Silver", pt: "Prata", from: "oklch(0.90 0.01 250)", to: "oklch(0.66 0.02 250)", glow: "oklch(0.85 0.02 250 / 0.55)", ...DARK_INK },
  { name: "Gold", pt: "Ouro", from: "oklch(0.90 0.15 95)", to: "oklch(0.68 0.15 80)", glow: "oklch(0.85 0.16 90 / 0.6)", ...DARK_INK },
  { name: "Sapphire", pt: "Safira", from: "oklch(0.78 0.14 250)", to: "oklch(0.45 0.18 260)", glow: "oklch(0.60 0.18 255 / 0.6)", ...LIGHT_INK },
  { name: "Ruby", pt: "Rubi", from: "oklch(0.72 0.19 20)", to: "oklch(0.45 0.19 15)", glow: "oklch(0.60 0.20 18 / 0.6)", ...LIGHT_INK },
  { name: "Emerald", pt: "Esmeralda", from: "oklch(0.80 0.16 158)", to: "oklch(0.48 0.14 160)", glow: "oklch(0.65 0.16 158 / 0.6)", ...LIGHT_INK },
  { name: "Amethyst", pt: "Ametista", from: "oklch(0.78 0.14 305)", to: "oklch(0.47 0.17 300)", glow: "oklch(0.62 0.17 302 / 0.6)", ...LIGHT_INK },
  { name: "Pearl", pt: "Pérola", from: "oklch(0.97 0.02 100)", to: "oklch(0.80 0.04 320)", glow: "oklch(0.92 0.03 320 / 0.6)", ...DARK_INK },
  { name: "Obsidian", pt: "Obsidiana", from: "oklch(0.45 0.03 280)", to: "oklch(0.20 0.02 280)", glow: "oklch(0.45 0.05 285 / 0.6)", ...LIGHT_INK },
  { name: "Diamond", pt: "Diamante", from: "oklch(0.97 0.03 200)", to: "oklch(0.72 0.10 220)", glow: "oklch(0.85 0.10 210 / 0.7)", ...DARK_INK },
];

export const DAYS_PER_LEAGUE = 7;

export function getLeague(streakDays: number): League & { nextIn: number; progress: number } {
  const step = Math.floor(Math.max(0, streakDays) / DAYS_PER_LEAGUE);
  const index = Math.min(step, LEAGUES.length - 1);
  const base = LEAGUES[index]!;
  const isMax = index === LEAGUES.length - 1;
  const within = Math.max(0, streakDays) % DAYS_PER_LEAGUE;
  return {
    ...base,
    index,
    nextIn: isMax ? 0 : DAYS_PER_LEAGUE - within,
    progress: isMax ? 100 : Math.round((within / DAYS_PER_LEAGUE) * 100),
  };
}

/** The league that comes next after the current streak, or null at the top league. */
export function getNextLeague(streakDays: number) {
  const { index } = getLeague(streakDays);
  if (index >= LEAGUES.length - 1) return null;
  const next = LEAGUES[index + 1]!;
  return { name: next.name, namePt: next.pt, from: next.from };
}

export function LeagueBadge({
  streakDays,
  size = 56,
  className,
}: {
  streakDays: number;
  size?: number;
  className?: string;
}) {
  const league = getLeague(streakDays);

  return (
    <span
      className={cn("relative grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size, color: league.from }}
      role="img"
      aria-label={`${league.name} league`}
      title={`${league.name} league`}
    >
      <ShieldCheck size={size} strokeWidth={2.4} aria-hidden="true" />
    </span>
  );
}
