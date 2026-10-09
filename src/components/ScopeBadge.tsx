import { CalendarDays, Infinity as InfinityIcon } from "lucide-react";

import { studyWeekday } from "@/lib/today";
import { useUiLang } from "@/lib/uiLang";
import { cn } from "@/lib/utils";

/**
 * Dashboard scope marks (user request): one shared white badge in the same
 * corner of each card says what the card measures. "∞ Continuous" follows the
 * whole journey (skills, today's priority, keep improving); the day badge
 * names today's weekday (today's progress), so it changes every day.
 */
export function ScopeBadge({
  kind,
  translate,
  className,
}: {
  kind: "continuous" | "today";
  translate: (label: string) => string;
  className?: string;
}) {
  const { lang } = useUiLang();
  const continuous = kind === "continuous";
  const Icon = continuous ? InfinityIcon : CalendarDays;
  return (
    <span
      title={translate(
        continuous
          ? "Continuous learning: your scores carry on into every new level."
          : "Today only: starts again tomorrow.",
      )}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-white/35 bg-white/10 px-2 py-0.5 text-[10px] font-semibold leading-none text-white",
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      {continuous ? translate("Continuous") : studyWeekday(lang)}
    </span>
  );
}
