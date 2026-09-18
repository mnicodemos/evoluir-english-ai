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
  const studiedCount = studyDays?.size ?? 0;
  const goalLabel = lang === "pt" ? "Meu objetivo:" : "My goal:";
  const daysLabel = lang === "pt" ? "dias" : "days";
  const aiGoalLabel =
    lang === "pt" ? "Evoluir + English AI objetivo" : "Evoluir + English AI goal";

  return (
    <div className="flex h-full items-center gap-3">
      <div className="flex flex-col items-center gap-1.5">
        <TrophyBadge active={allStudied} lang={lang} />
        <div className="flex w-14 flex-col items-center text-center text-[10px] font-medium leading-tight text-muted-foreground">
          <span>{goalLabel}</span>
          <span>
            {studiedCount}/7 {daysLabel}
          </span>
        </div>
      </div>

      <div className="flex flex-1 items-center">
        <div className="flex w-full flex-col gap-2 rounded-lg border border-border bg-card p-2.5 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
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
          <p className="text-center text-base font-medium lg:hidden">{aiGoalLabel}</p>
        </div>
      </div>
    </div>
  );
}

function TrophyBadge({ active, lang }: { active: boolean; lang: "pt" | "en" }) {
  const unlockedText = lang === "pt" ? "Troféu de 7 dias desbloqueado" : "7-day trophy unlocked";
  const lockedText = lang === "pt" ? "Troféu de 7 dias bloqueado" : "7-day trophy locked";

  return (
    <span
      className={cn(
        "relative grid size-14 shrink-0 place-items-center self-center rounded-full shadow-lg transition-all duration-500",
        active
          ? "bg-gradient-to-br from-[oklch(0.90_0.15_95)] to-[oklch(0.68_0.15_80)] text-[oklch(0.45_0.10_80)] motion-safe:animate-pulse"
          : "bg-gradient-to-br from-[oklch(0.80_0.01_250)] to-[oklch(0.60_0.02_240)] text-[oklch(0.55_0.01_250)]"
      )}
      role="img"
      aria-label={active ? unlockedText : lockedText}
      title={active ? unlockedText : lockedText}
    >
      <Trophy className="size-7" strokeWidth={2.5} />
    </span>
  );
}
