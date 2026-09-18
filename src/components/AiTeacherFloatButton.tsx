import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

const GRAD = {
  from: "oklch(0.80 0.16 158)",
  to: "oklch(0.48 0.14 160)",
  glow: "oklch(0.65 0.16 158 / 0.6)",
  icon: "oklch(0.99 0 0)",
} as const;

const SIZE = 56;
const PATH = "M32 4 54 18 54 46 32 60 10 46 10 18Z";

export function AiTeacherFloatButton({ className }: { className?: string }) {
  const id = "ai-teacher-grad";

  return (
    <Link
      to="/teacher"
      aria-label="AI Teacher"
      className={cn(
        "fixed bottom-[4.5rem] right-4 z-40 grid place-items-center lg:bottom-8 lg:right-8",
        className
      )}
      style={{ width: SIZE, height: SIZE }}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-full blur-md motion-safe:animate-[pulse_2.4s_ease-in-out_infinite]"
        style={{ background: `radial-gradient(circle, ${GRAD.glow} 0%, transparent 70%)` }}
      />
      <svg
        viewBox="0 0 64 64"
        width={SIZE}
        height={SIZE}
        className="relative motion-safe:animate-[league-float_3.6s_ease-in-out_infinite]"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={GRAD.from} />
            <stop offset="100%" stopColor={GRAD.to} />
          </linearGradient>
          <clipPath id={`${id}-clip`}>
            <path d={PATH} />
          </clipPath>
        </defs>
        <path d={PATH} fill={`url(#${id})`} />
        <path d="M32 4 54 18 32 30 10 18Z" fill="white" opacity="0.22" />
        <path d="M32 30 54 18 54 46 32 60Z" fill="black" opacity="0.14" />
        <g clipPath={`url(#${id}-clip)`}>
          <rect
            x="-40"
            y="0"
            width="24"
            height="64"
            fill="white"
            opacity="0.35"
            transform="skewX(-18)"
            className="motion-safe:animate-[league-shine_3.2s_linear_infinite]"
          />
        </g>
        <path
          d={PATH}
          fill="none"
          stroke="white"
          strokeOpacity="0.5"
          strokeWidth="1.5"
        />
      </svg>
      <Sparkles
        className="pointer-events-none absolute m-auto size-7"
        style={{ color: GRAD.icon }}
        strokeWidth={2.5}
        aria-hidden="true"
      />
    </Link>
  );
}
