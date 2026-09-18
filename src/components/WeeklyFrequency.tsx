import { useQuery } from "@tanstack/react-query";
import { Check, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { STUDY_DAY_ACTIVITY_TYPES } from "@/lib/studyDay";
import { STUDY_TIME_ZONE } from "@/lib/today";
import { useUiLang } from "@/lib/uiLang";


type Props = { userId: string };

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: STUDY_TIME_ZONE });
const LABELS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LABELS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Weekly frequency strip: one tile per weekday of the current week. */
export function WeeklyFrequency({ userId }: Props) {
  const { lang } = useUiLang();
  const labels = lang === "pt" ? LABELS_PT : LABELS_EN;
  const todayKey = dayFmt.format(new Date());

  // Build the 7 day keys of the current week (Sunday to Saturday) in study time zone.
  const [y, m, d] = todayKey.split("-").map(Number);
  const base = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  const weekStart = new Date(base);
  weekStart.setUTCDate(base.getUTCDate() - base.getUTCDay());
  const weekKeys = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekStart);
    day.setUTCDate(weekStart.getUTCDate() + i);
    return day.toISOString().slice(0, 10);
  });

  const { data: studyDays } = useQuery({
    queryKey: ["weekly-frequency", userId, weekKeys[0]],
    enabled: !!userId,
    queryFn: async () => {
      const start = new Date(`${weekKeys[0]}T00:00:00-03:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const { data } = await supabase
        .from("activities")
        .select("created_at")
        .in("activity_type", [...STUDY_DAY_ACTIVITY_TYPES])
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString());
      const days = new Set<string>();
      for (const row of data ?? []) days.add(dayFmt.format(new Date(row.created_at)));
      return days;
    },
  });

  const allStudied = (studyDays?.size ?? 0) === 7;

  return (
    <div className="flex h-full flex-col justify-center gap-2">
      <div className="flex justify-center">
        <TrophyBadge active={allStudied} />
      </div>


      <div className="grid flex-1 grid-cols-7 place-items-center gap-1.5">
        {weekKeys.map((key, i) => {
          const studied = studyDays?.has(key) ?? false;
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              className={
                "flex flex-col items-center gap-1.5 rounded-lg border p-2 " +
                (studied ? "border-transparent bg-success/10" : "border-border bg-card") +
                (isToday ? " ring-1 ring-foreground/30" : "")
              }
            >
              {studied ? (
                <span className="grid size-6 place-items-center rounded-full bg-success text-success-foreground">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
              ) : (
                <span className="size-6 rounded-full border-2 border-border" />
              )}
              <span className="text-[11px] text-muted-foreground">{labels[i]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrophyBadge({ active, size = 44 }: { active: boolean; size?: number }) {
  const id = `trophy-grad-${active ? "gold" : "gray"}`;
  const from = active ? "oklch(0.90 0.15 95)" : "oklch(0.80 0.01 250)";
  const to = active ? "oklch(0.68 0.15 80)" : "oklch(0.60 0.02 240)";
  const glow = active ? "oklch(0.85 0.16 90 / 0.6)" : "oklch(0.70 0.02 245 / 0.35)";
  const iconColor = active ? "oklch(0.45 0.10 80)" : "oklch(0.55 0.01 250)";

  return (
    <span
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={active ? "7-day trophy unlocked" : "7-day trophy locked"}
      title={active ? "7-day trophy unlocked" : "7-day trophy locked"}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-full blur-md motion-safe:animate-[pulse_2.4s_ease-in-out_infinite]"
        style={{ background: `radial-gradient(circle, ${glow} 0%, transparent 70%)` }}
      />
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        className="relative motion-safe:animate-[league-float_3.6s_ease-in-out_infinite]"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
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
        <foreignObject x="14" y="14" width="36" height="36" className="pointer-events-none">
          <div className="grid h-full w-full place-items-center">
            <Trophy className="size-5" style={{ color: iconColor }} strokeWidth={2.5} />
          </div>
        </foreignObject>
      </svg>
    </span>
  );
}
