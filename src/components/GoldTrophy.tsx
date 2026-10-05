import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * Filled trophy for weekly goals: gold with a star and shine when unlocked,
 * a muted grey silhouette while locked. Replaces the thin outline icon.
 */
export function GoldTrophy({
  unlocked,
  className,
  label,
}: {
  unlocked: boolean;
  className?: string;
  label: string;
}) {
  const id = useId().replace(/:/g, "");
  const cup = unlocked ? `url(#${id}-gold)` : "currentColor";
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={label}
      className={cn(
        "shrink-0",
        unlocked ? "drop-shadow-[0_0_10px_rgba(245,184,61,0.35)]" : "text-muted-foreground/25",
        className,
      )}
    >
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE58A" />
          <stop offset="0.55" stopColor="#F7BE45" />
          <stop offset="1" stopColor="#E0952A" />
        </linearGradient>
        <linearGradient id={`${id}-base`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3A4048" />
          <stop offset="1" stopColor="#1C2026" />
        </linearGradient>
      </defs>
      {/* handles */}
      <path
        d="M17 14H8c0 11 5 17 12 18M47 14h9c0 11-5 17-12 18"
        fill="none"
        stroke={unlocked ? "#E9A93A" : "currentColor"}
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* cup */}
      <path d="M16 8h32v16c0 11.5-7.2 20-16 20S16 35.5 16 24z" fill={cup} />
      {/* stem and base */}
      <path d="M28 43h8v7h-8z" fill={unlocked ? "#E0952A" : "currentColor"} />
      <rect
        x="19"
        y="50"
        width="26"
        height="8"
        rx="2.5"
        fill={unlocked ? `url(#${id}-base)` : "currentColor"}
      />
      {unlocked && (
        <>
          <path
            d="M32 15l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L32 29.8l-5.8 3 1.1-6.4-4.7-4.6 6.5-.9z"
            fill="#FFF7D6"
          />
          <path
            d="M21 12c-1 5-1 10 1 15"
            stroke="#FFF3C4"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.7"
            fill="none"
          />
          <rect x="24" y="52.5" width="16" height="3" rx="1.5" fill="#F7BE45" opacity="0.85" />
        </>
      )}
    </svg>
  );
}
