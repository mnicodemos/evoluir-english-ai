import { Link } from "@tanstack/react-router";
import { BookMarked, Crown, Sprout, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { EvoAvatar } from "@/components/EvoAvatar";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { ACCENTS } from "@/lib/accents";
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
    <PageHeader
      icon={Sprout}
      className="mb-4"
      title={
        // The name with its plus in the brand colour, like Evoluir+.
        <span translate="no">
          {"Life"}
          <span className="text-brand-green">+</span>
          {" AI"}
        </span>
      }
      description={t("Evolve one day at a time.")}
      actions={
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link to="/life/guide" aria-label={t("How Life+ AI works")}>
            <BookMarked className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t("How Life+ AI works")}</span>
          </Link>
        </Button>
      }
    />
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

/** Life+ AI blocks use the app-wide accents (src/lib/accents.ts). */
export const LIFE_ACCENTS = ACCENTS;

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
      {/* min-w keeps the title readable on phones: the count pill and buttons
          wrap below instead of squeezing the text to one word per line
          (user report, 2026-10-17: Focus on a phone). */}
      <div className="min-w-[11rem] flex-1">
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

/** An empty list with EVO and a nudge, instead of a grey line (user request). */
export function LifeEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-white/[0.02] p-3">
      <EvoAvatar decorative className="size-9 shrink-0" />
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
