import type { ReactNode } from "react";

/** Open part of the ring, at the bottom, where the amount is written (degrees). */
export const GAUGE_GAP_DEGREES = 100;

const RADIUS = 39;
const STROKE = 11;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC = CIRCUMFERENCE * ((360 - GAUGE_GAP_DEGREES) / 360);
// SVG angles run clockwise from 3 o'clock; the arc starts just past the gap.
const START_ROTATION = 90 + GAUGE_GAP_DEGREES / 2;

/**
 * The Dashboard's goal rings as a gauge open at the bottom (user request,
 * 2026-10-24): the amount ("32/15 min", "6/5 days") sits in the gap, the
 * centre keeps the check or the share. Drawn inside the caller's ring box,
 * which keeps its size, colour (currentColor) and celebration.
 */
export function GaugeRing({
  progress,
  value,
  goal,
  unit,
  children,
}: {
  progress: number;
  /** What was done so far: large and light, the eye's first stop in the gap. */
  value: number;
  /** The goal and its unit, smaller and muted after the value ("/25 min"). */
  goal: number;
  unit: string;
  children: ReactNode;
}) {
  const share = Math.min(1, Math.max(0, progress));
  return (
    <>
      <svg className="absolute inset-0 size-full" viewBox="0 0 96 96" aria-hidden="true">
        <g transform={`rotate(${START_ROTATION} 48 48)`}>
          <circle
            cx="48"
            cy="48"
            r={RADIUS}
            fill="none"
            stroke="var(--secondary)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${ARC} ${CIRCUMFERENCE}`}
          />
          {share > 0 && (
            <circle
              cx="48"
              cy="48"
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${ARC * share} ${CIRCUMFERENCE}`}
            />
          )}
        </g>
      </svg>
      <span className="relative grid place-items-center">{children}</span>
      {/* The amount in the gap: the value large and light, "/goal unit" small
          and muted on the same baseline (user request, 2026-10-24). */}
      <span className="absolute inset-x-0 bottom-[8%] flex items-baseline justify-center whitespace-nowrap leading-none tabular-nums">
        <span className="text-[15px] font-light text-foreground/90 2xl:text-base">{value}</span>
        <span className="text-[10px] font-normal text-muted-foreground">
          /{goal} {unit}
        </span>
      </span>
    </>
  );
}
