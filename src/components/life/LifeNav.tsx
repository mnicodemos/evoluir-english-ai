import { Link } from "@tanstack/react-router";
import { BookMarked, Crown, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { cn } from "@/lib/utils";

export function useLifeT() {
  const { lang } = useUiLang();
  return {
    lang,
    t: (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label),
  };
}

/**
 * Header of the one-page Life+ AI: name, slogan and the visual guide (user
 * request). No Premium badge: Life+ AI mixes free and Premium parts.
 */
export function LifeHeader() {
  const { t } = useLifeT();
  return (
    <header className="mb-4 flex flex-wrap items-start gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-xl font-bold lg:text-3xl">
          {/* The name with its plus in the brand colour, like Evoluir+. */}
          <span translate="no">
            {"Life"}
            <span className="text-brand-green">+</span>
            {" AI"}
          </span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("Evolve one day at a time.")}</p>
      </div>
      <Button asChild variant="outline" size="sm" className="ml-auto gap-1.5">
        <Link to="/life/guide">
          <BookMarked className="size-4" aria-hidden="true" />
          {t("How Life+ AI works")}
        </Link>
      </Button>
    </header>
  );
}

/** What Premium adds to Life+ AI, each marked with a gold crown for free students. */
const PREMIUM_ITEMS = [
  "Priority of the day",
  "Routine",
  "Habits",
  "Life Coach",
  "All meditations",
] as const;

/** Shown to free students in place of the Premium parts of Life+ AI (Goals stay free). */
export function LifePremiumGate({ feature }: { feature: string }) {
  const { t } = useLifeT();
  return (
    <section className="card-soft flex flex-col items-center gap-3 p-6 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-amber-400/12 text-amber-400">
        <Crown className="size-6" aria-hidden="true" />
      </span>
      <h2 className="text-base font-semibold">{t(feature)}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {t("Routine, habits and the Life Coach are part of Premium. Your goals stay free.")}
      </p>
      <ul className="grid w-full max-w-sm gap-1.5 text-left text-sm">
        {PREMIUM_ITEMS.map((item) => (
          <li key={item} className="flex items-center gap-2 rounded-lg bg-secondary/40 px-3 py-2">
            <Crown className="size-4 shrink-0 text-amber-400" aria-label="Premium" />
            {t(item)}
          </li>
        ))}
      </ul>
      <Button asChild className="bg-brand-green text-sidebar hover:bg-brand-green/90">
        <Link to="/premium">{t("See plans")}</Link>
      </Button>
    </section>
  );
}

/** One accent per Life+ AI part, used on its icon tile (user request: a modern, sophisticated page). */
export const LIFE_ACCENTS = {
  green: "bg-brand-green/12 text-brand-green ring-brand-green/25",
  sky: "bg-sky-400/12 text-sky-400 ring-sky-400/25",
  violet: "bg-violet-400/12 text-violet-400 ring-violet-400/25",
  amber: "bg-amber-400/12 text-amber-400 ring-amber-400/25",
  rose: "bg-rose-400/12 text-rose-400 ring-rose-400/25",
} as const;

/**
 * The same header on every Life+ AI block: the icon in a tinted tile, the
 * title with an optional line under it, a count pill and the block's actions.
 */
export function LifeSectionTitle({
  id,
  icon: Icon,
  accent,
  title,
  subtitle,
  meta,
  titleClassName,
  children,
}: {
  id: string;
  icon: LucideIcon;
  accent: keyof typeof LIFE_ACCENTS;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  titleClassName?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl ring-1",
          LIFE_ACCENTS[accent],
        )}
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2
          id={id}
          className={cn("font-display text-base font-semibold leading-tight", titleClassName)}
        >
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {meta !== undefined && meta !== null ? (
        <span className="shrink-0 rounded-full border border-border bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
          {meta}
        </span>
      ) : null}
      {children}
    </div>
  );
}
