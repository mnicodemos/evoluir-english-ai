import { useQuery } from "@tanstack/react-query";
import { Check, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { STUDY_DAY_ACTIVITY_TYPES } from "@/lib/studyDay";
import { STUDY_TIME_ZONE } from "@/lib/today";
import { useUiLang } from "@/lib/uiLang";

type Props = {
  userId: string;
  daysPerWeek?: number;
  compact?: boolean;
  presentation?: "default" | "summary" | "dashboard-panel";
};

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: STUDY_TIME_ZONE });
const LABELS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LABELS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Weekly frequency strip: one tile per weekday of the current week.
 *  The trophy uses the student's configured weekly frequency, falling back to 7. */
export function WeeklyFrequency({
  userId,
  daysPerWeek,
  compact = false,
  presentation = "default",
}: Props) {
  const weeklyGoal = daysPerWeek ?? 7;
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

  const allStudied = (studyDays?.size ?? 0) >= weeklyGoal;
  const studiedCount = studyDays?.size ?? 0;
  const goalLabel = lang === "pt" ? "Meu objetivo:" : "My goal:";
  const daysLabel = lang === "pt" ? "dias" : "days";

  if (presentation === "summary") {
    return (
      <div className="flex h-full min-w-0 items-center gap-3 px-3 py-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-warning/10">
          <Trophy className="size-5 text-warning" strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold">
            {studiedCount} / {weeklyGoal} {daysLabel}
          </p>
          <p className="text-xs text-muted-foreground">
            {lang === "pt" ? "Esta semana" : "This week"}
          </p>
        </div>
      </div>
    );
  }

  if (presentation === "dashboard-panel") {
    const radius = 34;
    const circumference = 2 * Math.PI * radius;
    const progress = weeklyGoal > 0 ? Math.min(1, studiedCount / weeklyGoal) : 0;
    return (
      <section className="card-soft h-full min-w-0 p-3" aria-labelledby="weekly-rhythm-title">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-dashboard-cyan/10">
            <Trophy className="size-4 text-dashboard-cyan" />
          </span>
          <h2 id="weekly-rhythm-title" className="text-sm font-semibold">
            {lang === "pt" ? "Seu ritmo de aprendizado" : "Your learning rhythm"}
          </h2>
        </div>
        <div className="mt-2 grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3">
          <div className="relative grid size-[5.5rem] place-items-center text-brand-green">
            <svg
              className="absolute inset-0 size-full -rotate-90"
              viewBox="0 0 80 80"
              aria-hidden="true"
            >
              <circle
                cx="40"
                cy="40"
                r={radius}
                fill="none"
                stroke="var(--secondary)"
                strokeWidth="8"
              />
              <circle
                cx="40"
                cy="40"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
              />
            </svg>
            <span className="relative text-center text-lg font-bold leading-none text-foreground">
              {studiedCount}/{weeklyGoal}
              <span className="mt-1 block text-[9px] font-medium text-muted-foreground">
                {daysLabel}
              </span>
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold">
              {studiedCount} {lang === "pt" ? "dias ativos esta semana" : "days active this week"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {allStudied
                ? lang === "pt"
                  ? "Ótima consistência!"
                  : "Great consistency!"
                : lang === "pt"
                  ? "Continue construindo seu ritmo."
                  : "Keep building your rhythm."}
            </p>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {weekKeys.map((key, i) => {
            const studied = studyDays?.has(key) ?? false;
            return (
              <div key={key} className="grid justify-items-center gap-1">
                <span className="text-[9px] text-muted-foreground">{labels[i]}</span>
                {studied ? (
                  <span className="grid size-5 place-items-center rounded-full bg-brand-green text-primary-foreground">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                ) : (
                  <span className="size-5 rounded-full border border-dashed border-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <div className={cn("flex h-full items-center", compact ? "gap-2" : "gap-3")}>
      <div className="flex flex-col items-center gap-1.5">
        <TrophyBadge active={allStudied} lang={lang} days={weeklyGoal} compact={compact} />
        <div className="flex w-11 flex-col items-center text-center text-[10px] font-medium leading-tight text-muted-foreground">
          <span>{goalLabel}</span>
          <span>
            {studiedCount}/{weeklyGoal} {daysLabel}
          </span>
        </div>
      </div>

      <div className="flex flex-1 items-center">
        <div className="flex w-full flex-col gap-2">
          <div className="grid grid-cols-7 place-items-center gap-1">
            {weekKeys.map((key, i) => {
              const studied = studyDays?.has(key) ?? false;
              return (
                <div key={key} className="flex flex-col items-center gap-1">
                  {studied ? (
                    <span className="grid size-6 place-items-center rounded-full bg-success text-success-foreground">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                  ) : (
                    <span className="size-6 rounded-full border-2 border-border" />
                  )}
                  <span className="text-sm text-muted-foreground">{labels[i]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrophyBadge({
  active,
  lang,
  days,
  compact,
}: {
  active: boolean;
  lang: "pt" | "en";
  days: number;
  compact: boolean;
}) {
  const unlockedText =
    lang === "pt" ? `Troféu de ${days} dias desbloqueado` : `${days}-day trophy unlocked`;
  const lockedText =
    lang === "pt" ? `Troféu de ${days} dias bloqueado` : `${days}-day trophy locked`;

  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center self-center rounded-full shadow-lg transition-all duration-500",
        compact ? "size-9" : "size-11",
        active
          ? "bg-gradient-to-br from-[oklch(0.90_0.15_95)] to-[oklch(0.68_0.15_80)] text-[oklch(0.45_0.10_80)] motion-safe:animate-pulse"
          : "bg-gradient-to-br from-[oklch(0.80_0.01_250)] to-[oklch(0.60_0.02_240)] text-[oklch(0.55_0.01_250)]",
      )}
      role="img"
      aria-label={active ? unlockedText : lockedText}
      title={active ? unlockedText : lockedText}
    >
      <Trophy className={compact ? "size-4" : "size-5"} strokeWidth={2.5} />
    </span>
  );
}
