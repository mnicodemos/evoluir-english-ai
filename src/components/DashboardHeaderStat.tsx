import { Link } from "@tanstack/react-router";
import { ArrowRight, Search } from "lucide-react";
import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

const TONES = {
  coral: "bg-dashboard-coral/12 text-dashboard-coral",
  amber: "bg-amber-400/12 text-amber-400",
  green: "bg-brand-green/12 text-brand-green",
  // Not teal (user request): a teal tile read as a button, the menu's colour.
  pink: "bg-pink-400/12 text-pink-400",
  blue: "bg-sky-400/12 text-sky-400",
  // League medal by place (user request): gold, silver, bronze, then grey.
  gold: "bg-amber-400/12 text-amber-400",
  silver: "bg-slate-300/12 text-slate-300",
  bronze: "bg-[#cd7f32]/15 text-[#cd7f32]",
  grey: "bg-muted-foreground/10 text-muted-foreground",
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
  detailClassName,
  detailIcon,
  valueStyle,
  iconColor,
  to,
  opens,
  singleLine,
  hint,
  labelClassName,
}: {
  icon: ReactNode;
  tone: keyof typeof TONES;
  label: string;
  value: string;
  detail?: string | null;
  detailStyle?: CSSProperties | undefined;
  detailClassName?: string;
  detailIcon?: ReactNode;
  valueStyle?: CSSProperties | undefined;
  iconColor?: string | undefined;
  to?: "/league" | "/study-plan";
  /** The cell sits inside a trigger that opens something (the jewels
   *  popover): it shows a magnifier in the same circle as a cell with `to`. */
  opens?: boolean;
  /** The value keeps to one line (the jewels cell; owner request: the jewel's
   *  name never on two lines). */
  singleLine?: boolean;
  /** Shown on hover: how the number works (e.g. the jewels rule). */
  hint?: string;
  /** Optional responsive styling for labels in narrow dashboard cells. */
  labelClassName?: string;
}) {
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const labelElement = labelRef.current;
    const availableSpace = labelElement?.parentElement;
    if (!labelElement || !availableSpace) return;

    const fitLabel = () => {
      const availableWidth = availableSpace.clientWidth;
      if (!availableWidth) return;

      const styles = window.getComputedStyle(labelElement);
      const measure = document.createElement("span");
      measure.textContent = labelElement.textContent ?? "";
      Object.assign(measure.style, {
        position: "fixed",
        left: "-10000px",
        top: "0",
        width: "max-content",
        maxWidth: "none",
        whiteSpace: "nowrap",
        visibility: "hidden",
        fontFamily: styles.fontFamily,
        fontWeight: styles.fontWeight,
        fontStyle: styles.fontStyle,
        fontVariant: styles.fontVariant,
        letterSpacing: styles.letterSpacing,
        textTransform: styles.textTransform,
        fontSize: "10.5px",
        lineHeight: styles.lineHeight,
      });
      document.body.append(measure);
      const naturalWidth = measure.getBoundingClientRect().width;
      measure.remove();
      if (!naturalWidth) return;

      // Measure with the browser's actual font renderer (including loaded web
      // fonts and tracking), then scale only when the real cell is too narrow.
      const scale = Math.min(1, availableWidth / naturalWidth);
      labelElement.style.fontSize = `${Math.max(5, 10.5 * scale)}px`;
    };

    const observer = new ResizeObserver(fitLabel);
    observer.observe(availableSpace);
    fitLabel();
    document.fonts?.ready.then(fitLabel);
    return () => observer.disconnect();
  }, [label]);

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
        <span
          ref={labelRef}
          className={cn(
            "block w-full overflow-hidden whitespace-nowrap text-[10.5px] font-semibold uppercase leading-snug tracking-[0.02em] text-muted-foreground",
            labelClassName,
          )}
        >
          {label}
        </span>
        {singleLine ? (
          <span className="mt-0.5 block truncate font-display text-lg font-bold leading-tight text-foreground">
            {value}
          </span>
        ) : (
          <span className="mt-0.5 line-clamp-2 break-words font-display text-lg font-bold leading-tight text-foreground">
            {value}
          </span>
        )}
        {detail &&
          (detailIcon ? (
            <span
              className={cn(
                "mt-0.5 flex min-w-0 items-center gap-1 text-xs leading-tight text-muted-foreground",
                detailClassName,
              )}
              style={detailStyle}
            >
              {detailIcon}
              <span className="min-w-0 whitespace-nowrap">{detail}</span>
            </span>
          ) : (
            <span
              className={cn(
                "mt-0.5 block truncate text-xs leading-tight text-muted-foreground",
                detailClassName,
              )}
              style={detailStyle}
            >
              {detail}
            </span>
          ))}
      </span>
    </>
  );
  const circle = (glyph: ReactNode) => (
    <span
      className="grid size-7 shrink-0 place-items-center rounded-full border border-border text-muted-foreground group-focus-visible:text-brand-green"
      aria-hidden="true"
    >
      {glyph}
    </span>
  );
  const chevron = circle(
    <ArrowRight
      className="size-4 transition-transform group-hover:translate-x-0.5"
      strokeWidth={2.25}
    />,
  );
  // A cell that opens a popover shows a magnifier, like the Life+ AI slots.
  const magnifier = circle(<Search className="size-3.5" strokeWidth={2.4} />);
  const cell = "flex h-full min-w-0 items-center gap-3 px-4 py-3 2xl:gap-4 2xl:px-6";
  if (!to)
    return (
      <div
        className={cn(
          cell,
          // No button look (owner request, 2026-11-02): the magnifier says it opens.
          opens && "group cursor-pointer rounded-xl",
        )}
        title={hint}
      >
        {body}
        {opens ? magnifier : null}
      </div>
    );
  return (
    <Link
      to={to}
      title={hint}
      className={cn(
        cell,
        // The whole cell opens its page, with no button look on hover or press
        // (owner request, 2026-11-02); only the keyboard focus ring stays.
        "group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-green/60",
      )}
    >
      {body}
      {chevron}
    </Link>
  );
}
