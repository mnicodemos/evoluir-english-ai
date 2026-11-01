import { useQuery } from "@tanstack/react-query";

import { useTodayActivities } from "@/components/DailyGoalCard";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { dailyGoalTrend, GOAL_TREND_DAYS, trendDayStart } from "@/lib/dailyGoalTrend";
import { countsAsLearningMinutes, LEARNING_ACTIVITY_TYPES } from "@/lib/studyDay";

/**
 * The daily goal over the last seven days, under Today's Progress on desktop
 * (owner request, 2026-11-01: the taller card left an empty band there). One
 * evolution bar of the average share of the minutes goal reached over the last
 * seven days, every activity that counts minutes included (owner review, the
 * same day: a bar instead of a line), today live from Today's Progress' own
 * query. Earlier days are read once a minute; each day's share shows on hover.
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

  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });

  return (
    <div
      className="w-full"
      title={days.map((d) => `${weekday.format(d.date)} ${d.percent}%`).join(" · ")}
    >
      <div className="flex items-baseline justify-between text-[11px] leading-none">
        <span className="font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {t("Daily goal · last 7 days")}
        </span>
        <span className="text-muted-foreground">
          {t("Average")}{" "}
          <span className="font-semibold tabular-nums text-brand-green">{average}%</span>
        </span>
      </div>
      {/* One evolution bar, the average share of the daily goal over the last
          seven days (owner review, 2026-11-01: a bar reads better than a line). */}
      <Progress
        value={average}
        fillIn
        className="mt-1.5 h-2.5 bg-white/[0.07]"
        aria-label={`${t("Last 7 days")}: ${t("Average")} ${average}%`}
      />
      {/* What the number is (owner request, 2026-11-01: students must know where
          it comes from): the share of the daily minutes goal reached each day,
          averaged over the seven days, every activity that counts minutes. */}
      <p className="mt-1 line-clamp-2 text-[10.5px] leading-tight text-muted-foreground">
        {t("Share of your {minutes} min goal reached per day, all activities.").replace(
          "{minutes}",
          String(goalMinutes),
        )}
      </p>
      <span className="sr-only">
        {days.map((d) => `${weekday.format(d.date)} ${d.percent}%`).join(", ")}
      </span>
    </div>
  );
}
