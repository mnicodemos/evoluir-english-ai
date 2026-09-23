import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { STUDY_DAY_ACTIVITY_TYPES } from "@/lib/studyDay";
import { STUDY_TIME_ZONE } from "@/lib/today";
import { useUiLang } from "@/lib/uiLang";

type Props = {
  userId: string;
};

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: STUDY_TIME_ZONE });
const WEEKDAYS_EN = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAYS_PT = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Monthly calendar showing the days the user studied (any activity recorded). */
export function FrequencyCalendar({ userId }: Props) {
  const { lang } = useUiLang();
  const todayKey = dayFmt.format(new Date());
  const [monthOffset, setMonthOffset] = useState(0);

  const baseYear = Number(todayKey.slice(0, 4));
  const baseMonth = Number(todayKey.slice(5, 7));
  // Shift the current month by the offset chosen via the arrows.
  const shifted = new Date(baseYear, baseMonth - 1 + monthOffset, 1);
  const year = shifted.getFullYear();
  const month = shifted.getMonth() + 1;
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  const { data: studyDays } = useQuery({
    queryKey: ["study-frequency", userId, monthKey],
    enabled: !!userId,
    queryFn: async () => {
      // Fetch activities between the start and end of the shown month (Brazil time).
      const monthStartLocal = new Date(`${monthKey}-01T00:00:00-03:00`);
      const nextMonth = new Date(year, month, 1);
      const monthEndLocal = new Date(
        `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01T00:00:00-03:00`,
      );
      const { data } = await supabase
        .from("activities")
        .select("created_at")
        // Same rule as the streak: only lessons and AI Talking sessions mark a day.
        .in("activity_type", [...STUDY_DAY_ACTIVITY_TYPES])
        .gte("created_at", monthStartLocal.toISOString())
        .lt("created_at", monthEndLocal.toISOString());
      const days = new Set<string>();
      for (const row of data ?? []) {
        days.add(dayFmt.format(new Date(row.created_at)));
      }
      return days;
    },
  });

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const monthLabel = new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 15));

  const studiedCount = studyDays?.size ?? 0;

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMonthOffset((v) => v - 1)}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <h3 className="text-sm font-medium capitalize">{monthLabel}</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMonthOffset((v) => v + 1)}
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <p className="mt-1 text-center text-xs text-muted-foreground">
        {studiedCount} {studiedCount === 1 ? "day studied" : "days studied"}
      </p>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {(lang === "pt" ? WEEKDAYS_PT : WEEKDAYS_EN).map((w, i) => (
          <span key={i} className="text-[10px] font-medium text-muted-foreground">
            {w}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`e-${i}`} />;
          const key = `${monthKey}-${String(day).padStart(2, "0")}`;
          const studied = studyDays?.has(key);
          const isToday = key === todayKey;
          return (
            <span
              key={key}
              className={
                "mx-auto flex size-7 items-center justify-center rounded-full text-xs " +
                (studied
                  ? "bg-success font-semibold text-success-foreground"
                  : "text-muted-foreground") +
                (isToday ? " ring-1 ring-foreground/50" : "")
              }
            >
              {day}
            </span>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Green days are the days you practiced. Keep the streak going!
      </p>
    </div>
  );
}
