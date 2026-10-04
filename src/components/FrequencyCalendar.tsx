import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useQualifiedStudyDays } from "@/hooks/useQualifiedStudyDays";
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

  const monthStartLocal = new Date(`${monthKey}-01T00:00:00-03:00`);
  const nextMonth = new Date(year, month, 1);
  const monthEndLocal = new Date(
    `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01T00:00:00-03:00`,
  );
  const { data: studyDays } = useQualifiedStudyDays({
    userId,
    start: monthStartLocal,
    end: monthEndLocal,
    queryKey: `month:${monthKey}`,
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
          className="size-7 sm:size-9"
          onClick={() => setMonthOffset((v) => v - 1)}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <h3 className="text-xs font-medium capitalize sm:text-sm">{monthLabel}</h3>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 sm:size-9"
          onClick={() => setMonthOffset((v) => v + 1)}
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <p className="mt-0.5 text-center text-[11px] text-muted-foreground sm:mt-1 sm:text-xs">
        {studiedCount} {studiedCount === 1 ? "day studied" : "days studied"}
      </p>
      <div className="mt-2 grid grid-cols-7 gap-0.5 text-center sm:mt-3 sm:gap-1">
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
                "mx-auto flex size-6 items-center justify-center rounded-full text-[11px] sm:size-7 sm:text-xs " +
                (studied
                  ? "bg-brand-green font-semibold text-primary-foreground"
                  : "text-muted-foreground") +
                (isToday ? " ring-1 ring-foreground/50" : "")
              }
            >
              {day}
            </span>
          );
        })}
      </div>
      <p className="mt-2 hidden text-xs text-muted-foreground sm:mt-3 sm:block">
        Green days are the days you practiced. Keep the streak going!
      </p>
    </div>
  );
}
