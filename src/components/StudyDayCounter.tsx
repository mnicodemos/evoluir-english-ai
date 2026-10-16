import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * How much of today's study-day rule a page has done (Listening sessions,
 * Vocabulary reviews): one compact card with the count, a thin bar and one
 * line under it (user request: the two-line pill looked stretched).
 */
export function StudyDayCounter({
  label,
  value,
  goal,
  doneText,
  hint,
}: {
  label: ReactNode;
  value: number;
  goal: number;
  doneText: ReactNode;
  hint: ReactNode;
}) {
  const reached = value >= goal;
  const shown = Math.min(value, goal);
  return (
    <div
      className={cn(
        "mt-3 w-full max-w-sm rounded-xl border px-3 py-2",
        reached ? "border-brand-green/40 bg-brand-green/10" : "border-border bg-white/[0.03]",
      )}
    >
      <div className="flex items-center justify-between gap-3 text-xs font-semibold">
        <span className={reached ? "text-brand-green" : "text-foreground"}>{label}</span>
        <span
          className={cn("tabular-nums", reached ? "text-brand-green" : "text-muted-foreground")}
        >
          {`${shown}/${goal}`}
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        <div
          className="h-full rounded-full bg-brand-green transition-[width] duration-500"
          style={{ width: `${goal ? (shown / goal) * 100 : 0}%` }}
        />
      </div>
      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
        {reached ? (
          <>
            <CheckCircle2 className="size-3.5 shrink-0 text-brand-green" aria-hidden="true" />
            <span className="text-brand-green">{doneText}</span>
          </>
        ) : (
          hint
        )}
      </p>
    </div>
  );
}
