import { CalendarDays, Infinity as InfinityIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Dashboard scope marks (user request): one shared badge in the same corner
 * of each card says what the card measures. "∞ Continuous" follows the whole
 * journey (skills, today's priority, keep improving); "Today" is today only
 * (today's progress).
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
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none",
        continuous
          ? "border-brand-green/35 bg-brand-green/10 text-brand-green"
          : "border-dashboard-cyan/35 bg-dashboard-cyan/10 text-dashboard-cyan",
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      {translate(continuous ? "Continuous" : "Today")}
    </span>
  );
}
