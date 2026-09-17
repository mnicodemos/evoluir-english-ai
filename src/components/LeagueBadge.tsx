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

const LEAGUES: Omit<League, "index">[] = [
  { name: "Bronze", from: "oklch(0.70 0.10 60)", to: "oklch(0.48 0.09 50)", glow: "oklch(0.70 0.10 60 / 0.55)", ...LIGHT_INK },
  { name: "Silver", from: "oklch(0.90 0.01 250)", to: "oklch(0.66 0.02 250)", glow: "oklch(0.85 0.02 250 / 0.55)", ...DARK_INK },
  { name: "Gold", from: "oklch(0.90 0.15 95)", to: "oklch(0.68 0.15 80)", glow: "oklch(0.85 0.16 90 / 0.6)", ...DARK_INK },
  { name: "Sapphire", from: "oklch(0.78 0.14 250)", to: "oklch(0.45 0.18 260)", glow: "oklch(0.60 0.18 255 / 0.6)", ...LIGHT_INK },
  { name: "Ruby", from: "oklch(0.72 0.19 20)", to: "oklch(0.45 0.19 15)", glow: "oklch(0.60 0.20 18 / 0.6)", ...LIGHT_INK },
  { name: "Emerald", from: "oklch(0.80 0.16 158)", to: "oklch(0.48 0.14 160)", glow: "oklch(0.65 0.16 158 / 0.6)", ...LIGHT_INK },
  { name: "Amethyst", from: "oklch(0.78 0.14 305)", to: "oklch(0.47 0.17 300)", glow: "oklch(0.62 0.17 302 / 0.6)", ...LIGHT_INK },
  { name: "Pearl", from: "oklch(0.97 0.02 100)", to: "oklch(0.80 0.04 320)", glow: "oklch(0.92 0.03 320 / 0.6)", ...DARK_INK },
  { name: "Obsidian", from: "oklch(0.45 0.03 280)", to: "oklch(0.20 0.02 280)", glow: "oklch(0.45 0.05 285 / 0.6)", ...LIGHT_INK },
  { name: "Diamond", from: "oklch(0.97 0.03 200)", to: "oklch(0.72 0.10 220)", glow: "oklch(0.85 0.10 210 / 0.7)", ...DARK_INK },
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

export function LeagueBadge({
  streakDays,
  size = 56,
  label,
  className,
}: {
  streakDays: number;
  size?: number;
  /** CEFR level shown inside the badge, e.g. "B1". */
  label?: string;
  className?: string;
}) {
  const league = getLeague(streakDays);
  const id = `league-grad-${league.index}`;

  return (
    <span
      className={cn("relative grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ? `${league.name} league, level ${label}` : `${league.name} league`}
      title={label ? `${league.name} league · ${label}` : `${league.name} league`}
    >

      <span
        aria-hidden
        className="absolute inset-0 rounded-full blur-md motion-safe:animate-[pulse_2.4s_ease-in-out_infinite]"
        style={{ background: `radial-gradient(circle, ${league.glow} 0%, transparent 70%)` }}
      />
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        className="relative motion-safe:animate-[league-float_3.6s_ease-in-out_infinite]"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={league.from} />
            <stop offset="100%" stopColor={league.to} />
          </linearGradient>
          <clipPath id={`${id}-clip`}>
            <path d="M32 4 54 18 54 46 32 60 10 46 10 18Z" />
          </clipPath>
        </defs>
        <path d="M32 4 54 18 54 46 32 60 10 46 10 18Z" fill={`url(#${id})`} />
        <path d="M32 4 54 18 32 30 10 18Z" fill="white" opacity="0.22" />
        <path d="M32 30 54 18 54 46 32 60Z" fill="black" opacity="0.14" />
        <g clipPath={`url(#${id}-clip)`}>
          <rect
            x="-40"
            y="0"
            width="24"
            height="64"
            fill="white"
            opacity="0.35"
            transform="skewX(-18)"
            className="motion-safe:animate-[league-shine_3.2s_linear_infinite]"
          />
        </g>
        <path
          d="M32 4 54 18 54 46 32 60 10 46 10 18Z"
          fill="none"
          stroke="white"
          strokeOpacity="0.5"
          strokeWidth="1.5"
        />
        {label && (
          <text
            x="32"
            y="34"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="20"
            fontWeight="800"
            fill={league.ink}
            stroke={league.inkEdge}
            strokeWidth="2"
            strokeLinejoin="round"
            paintOrder="stroke"
            style={{ letterSpacing: "0.5px" }}
          >
            {label}
          </text>
        )}

      </svg>
    </span>
  );
}
