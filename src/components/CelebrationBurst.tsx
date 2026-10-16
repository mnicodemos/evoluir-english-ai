import { cn } from "@/lib/utils";

const DOTS = Array.from({ length: 10 }, (_, index) => index * 36);

/**
 * A short burst of brand-green and gold sparks around a ring when a goal is
 * reached (useCelebrate). Purely decorative; nothing renders while inactive.
 */
export function CelebrationBurst({ active, className }: { active: boolean; className?: string }) {
  if (!active) return null;
  return (
    <span className={cn("pointer-events-none absolute inset-0", className)} aria-hidden="true">
      {DOTS.map((angle, index) => (
        <span
          key={angle}
          className={cn(
            "animate-burst-dot absolute left-1/2 top-1/2 -ml-[3px] -mt-[3px] size-1.5 rounded-full",
            index % 2 ? "bg-amber-400" : "bg-brand-green",
          )}
          style={{ "--burst-angle": `${angle}deg` } as React.CSSProperties}
        />
      ))}
    </span>
  );
}
