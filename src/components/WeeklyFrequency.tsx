import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";

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

  return (
    <div>
      <h3 className="text-sm font-medium">
        {lang === "pt" ? "Frequência semanal" : "Weekly frequency"}
      </h3>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
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
