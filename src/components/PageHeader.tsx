import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { ACCENTS, type Accent } from "@/lib/accents";
import { cn } from "@/lib/utils";

/**
 * The same page header on every student page (user request: a professional,
 * elegant look across the app): the page's icon in a tinted tile (from sm),
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
  return (
    <header className={cn("animate-rise flex items-start gap-4", className)}>
      <span
        className={cn(
          "hidden size-12 shrink-0 place-items-center rounded-2xl ring-1 sm:grid lg:size-14",
          ACCENTS[accent],
        )}
        aria-hidden="true"
      >
        <Icon className="size-6 lg:size-7" />
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
  );
}
