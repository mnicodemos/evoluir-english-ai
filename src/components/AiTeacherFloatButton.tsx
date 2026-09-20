import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

const GRAD = {
  from: "oklch(0.80 0.16 158)",
  to: "oklch(0.48 0.14 160)",
  glow: "oklch(0.65 0.16 158 / 0.6)",
  icon: "oklch(0.99 0 0)",
} as const;

export function AiTeacherFloatButton({ className }: { className?: string }) {
  return (
    <Link
      to="/teacher"
      aria-label="AI Teacher"
      className={cn(
        "fixed bottom-[calc(8rem+env(safe-area-inset-bottom))] right-4 z-40 grid size-14 place-items-center rounded-full transition-transform duration-200 hover:scale-110 sm:bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-8 lg:right-8",
        className
      )}
      style={{
        background: `linear-gradient(135deg, ${GRAD.from}, ${GRAD.to})`,
        boxShadow: `0 8px 24px -6px ${GRAD.glow}`,
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-full blur-md motion-safe:animate-[pulse_2.4s_ease-in-out_infinite]"
        style={{ background: `radial-gradient(circle, ${GRAD.glow} 0%, transparent 70%)` }}
      />
      <span
        aria-hidden
        className="absolute inset-0 overflow-hidden rounded-full motion-safe:animate-[league-float_3.6s_ease-in-out_infinite]"
      >
        <span
          aria-hidden
          className="absolute -inset-[25%] block w-[40%] bg-gradient-to-r from-transparent via-white/30 to-transparent motion-safe:animate-[league-shine_3.2s_linear_infinite]"
          style={{ transform: "skewX(-18deg)" }}
        />
      </span>
      <Sparkles
        className="pointer-events-none relative z-10 size-7"
        style={{ color: GRAD.icon }}
        strokeWidth={2.5}
        aria-hidden="true"
      />
    </Link>
  );
}
