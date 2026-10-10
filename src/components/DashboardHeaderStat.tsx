import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

const TONES = {
  coral: "bg-dashboard-coral/12 text-dashboard-coral",
  amber: "bg-amber-400/12 text-amber-400",
  green: "bg-brand-green/12 text-brand-green",
} as const;

/**
 * One cell of the Dashboard header strip. Every cell shares the same anatomy
 * (icon tile · small label · value · supporting line), so the row reads as one
 * calm set instead of mixed badges. A cell with `to` opens a page and always
 * shows its chevron, so students know it can be opened. Label and value wrap
 * to a second line instead of being cut ("Every planned day is…", user request). `iconColor` replaces
 * the tone's colour (the streak jewel follows the current jewel phase).
 */
export function DashboardHeaderStat({
  icon,
  tone,
  label,
  value,
  detail,
  detailStyle,
  iconColor,
  to,
  hint,
}: {
  icon: ReactNode;
  tone: keyof typeof TONES;
  label: string;
  value: string;
  detail?: string | null;
  detailStyle?: CSSProperties | undefined;
  iconColor?: string | undefined;
  to?: "/league" | "/study-plan";
  /** Shown on hover: how the number works (e.g. the jewels rule). */
  hint?: string;
}) {
  const body = (
    <>
      <span
        className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", TONES[tone])}
        style={
          iconColor
            ? {
                color: iconColor,
                backgroundColor: `color-mix(in oklab, ${iconColor} 14%, transparent)`,
              }
            : undefined
        }
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[10.5px] font-semibold uppercase leading-snug tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        <span className="mt-0.5 line-clamp-2 break-words font-display text-lg font-bold leading-tight text-foreground">
          {value}
        </span>
        {detail && (
          <span
            className="mt-0.5 block truncate text-xs leading-tight text-muted-foreground"
            style={detailStyle}
          >
            {detail}
          </span>
        )}
      </span>
    </>
  );
  const cell = "flex h-full min-w-0 items-center gap-3 px-4 py-3 2xl:gap-4 2xl:px-6";
  if (!to)
    return (
      <div className={cell} title={hint}>
        {body}
      </div>
    );
  return (
    <Link
      to={to}
      title={hint}
      className={cn(
        cell,
        "group transition-colors hover:bg-foreground/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-green/60",
      )}
    >
      {body}
      <span
        className="grid size-7 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-colors group-hover:border-brand-green/50 group-hover:text-brand-green group-focus-visible:text-brand-green"
        aria-hidden="true"
      >
        <ChevronRight className="size-4" strokeWidth={2.4} />
      </span>
    </Link>
  );
}
