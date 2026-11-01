import { useQuery } from "@tanstack/react-query";

import { useTodayActivities } from "@/components/DailyGoalCard";
import { supabase } from "@/integrations/supabase/client";
import { dailyGoalTrend, GOAL_TREND_DAYS, trendDayStart } from "@/lib/dailyGoalTrend";
import { countsAsLearningMinutes, LEARNING_ACTIVITY_TYPES } from "@/lib/studyDay";

/**
 * The daily goal over the last seven days, under Today's Progress on desktop
 * (owner request, 2026-11-01: the taller card left an empty band there). One
 * line of the share of the minutes goal reached each day, the average beside
 * the title, today as the solid last dot (live, from Today's Progress' own
 * query). Earlier days are read once a minute.
 */
export function DailyGoalTrend({
  userId,
  goalMinutes,
  translate: t,
  locale,
}: {
  userId: string;
  goalMinutes: number;
  translate: (text: string) => string;
  locale: string;
}) {
  const { data: today = [] } = useTodayActivities(userId);
  const { data: earlier } = useQuery({
    queryKey: ["minutes-week", userId],
    staleTime: 60_000,
    queryFn: async () => {
      const now = new Date();
      const { data, error } = await supabase
        .from("activities")
        .select("duration_minutes, activity_type, created_at")
        .eq("user_id", userId)
        .in("activity_type", [...LEARNING_ACTIVITY_TYPES])
        .gte("created_at", trendDayStart(now, GOAL_TREND_DAYS - 1).toISOString())
        .lt("created_at", trendDayStart(now, 0).toISOString());
      if (error) throw error;
      return (data ?? []).filter((a) => countsAsLearningMinutes(a.activity_type));
    },
  });
  if (!earlier) return null;

  const now = new Date();
  const todayRows = today.map((a) => ({
    created_at: now.toISOString(),
    duration_minutes: a.duration_minutes,
  }));
  const { days, average } = dailyGoalTrend([...earlier, ...todayRows], goalMinutes, now);

  // Points in a 100 x 100 box; the svg stretches to the row, the dots are HTML
  // so they stay round.
  const points = days.map((d, i) => ({
    x: (i / (days.length - 1)) * 100,
    y: 100 - d.percent,
    day: d,
  }));
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between text-[11px] leading-none">
        <span className="font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {t("Last 7 days")}
        </span>
        <span className="text-muted-foreground">
          {t("Average")}{" "}
          <span className="font-semibold tabular-nums text-brand-green">{average}%</span>
        </span>
      </div>
      <div className="relative mt-2 h-9">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible"
          aria-hidden="true"
        >
          <line
            x1="0"
            x2="100"
            y1="100"
            y2="100"
            className="stroke-white/10"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <polygon points={`0,100 ${line} 100,100`} className="fill-brand-green/10" />
          <polyline
            points={line}
            fill="none"
            className="stroke-brand-green/80"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {points.map((p, i) => {
          const isToday = i === points.length - 1;
          return (
            <span
              key={p.day.key}
              title={`${weekday.format(p.day.date)} · ${p.day.percent}%`}
              className={
                isToday
                  ? "absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-green ring-2 ring-background"
                  : "absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-green/70"
              }
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            />
          );
        })}
      </div>
      <span className="sr-only">
        {days.map((d) => `${weekday.format(d.date)} ${d.percent}%`).join(", ")}
      </span>
    </div>
  );
}
