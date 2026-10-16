import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { ACCENTS, type Accent } from "@/lib/accents";
import { cn } from "@/lib/utils";

/**
 * The same page header on every student page (user request: a professional,
 * elegant look across the app): the page's icon in a tinted tile (smaller on
 * phones, so the one-screen pages keep their room),
 * a small brand-coloured eyebrow, the title and its line, actions on the right
 * and anything else (pills, level chips) under the line.
 */
export function PageHeader({
  icon: Icon,
  accent = "green",
  eyebrow,
  title,
  description,
  descriptionClassName,
  actions,
  className,
  children,
}: {
  icon: LucideIcon;
  accent?: Accent;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  descriptionClassName?: string;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  // Phones: once the header scrolls away, a compact glass bar keeps the page's
  // name on top, like a native app's large title (user request).
  const ref = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setCompact(!entry?.isIntersecting), {
      rootMargin: "-8px 0px 0px 0px",
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          "fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-background/75 pt-[env(safe-area-inset-top)] backdrop-blur-xl transition-[opacity,translate] duration-200 lg:hidden",
          compact ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0",
        )}
      >
        <div className="flex h-12 items-center gap-2.5 px-4">
          <span
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-lg ring-1",
              ACCENTS[accent],
            )}
          >
            <Icon className="size-4" />
          </span>
          <span className="min-w-0 truncate font-display text-sm font-semibold">{title}</span>
        </div>
      </div>
      <header ref={ref} className={cn("animate-rise flex items-start gap-3 sm:gap-4", className)}>
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl ring-1 sm:size-12 sm:rounded-2xl lg:size-14",
            ACCENTS[accent],
          )}
          aria-hidden="true"
        >
          <Icon className="size-5 sm:size-6 lg:size-7" />
        </span>
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-green">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-display text-xl font-bold leading-tight tracking-tight lg:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className={cn("mt-1 max-w-2xl text-sm text-muted-foreground", descriptionClassName)}>
              {description}
            </p>
          ) : null}
          {children}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
    </>
  );
}
