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
 * calm set instead of mixed badges. A cell with `to` opens a page; its chevron
 * only appears on hover to keep the row quiet.
 */
export function DashboardHeaderStat({
  icon,
  tone,
  label,
  value,
  detail,
  detailStyle,
  to,
}: {
  icon: ReactNode;
  tone: keyof typeof TONES;
  label: string;
  value: string;
  detail?: string | null;
  detailStyle?: CSSProperties | undefined;
  to?: "/league" | "/study-plan";
}) {
  const body = (
    <>
      <span
        className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", TONES[tone])}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        <span className="mt-0.5 block truncate font-display text-lg font-bold leading-tight text-foreground">
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
  const cell = "flex h-full min-w-0 items-center gap-4 px-6 py-3";
  if (!to) return <div className={cell}>{body}</div>;
  return (
    <Link
      to={to}
      className={cn(
        cell,
        "group transition-colors hover:bg-foreground/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-green/60",
      )}
    >
      {body}
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden="true"
      />
    </Link>
  );
}
