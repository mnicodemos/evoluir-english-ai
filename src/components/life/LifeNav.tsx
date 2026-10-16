import { Link } from "@tanstack/react-router";
import { BookMarked, Crown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

export function useLifeT() {
  const { lang } = useUiLang();
  return {
    lang,
    t: (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label),
  };
}

/**
 * Header of the one-page Life AI: name, slogan and the visual guide (user
 * request). No Premium badge: Life AI mixes free and Premium parts.
 */
export function LifeHeader() {
  const { t } = useLifeT();
  return (
    <header className="mb-4 flex flex-wrap items-start gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-xl font-bold lg:text-3xl">
          Life AI <span className="text-brand-green">+</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("Evolve one day at a time.")}</p>
      </div>
      <Button asChild variant="outline" size="sm" className="ml-auto gap-1.5">
        <Link to="/life/guide">
          <BookMarked className="size-4" aria-hidden="true" />
          {t("How Life AI works")}
        </Link>
      </Button>
    </header>
  );
}

/** What Premium adds to Life AI, each marked with a gold crown for free students. */
const PREMIUM_ITEMS = [
  "Priority of the day",
  "Routine",
  "Habits",
  "Life Coach",
  "All meditations",
] as const;

/** Shown to free students in place of the Premium parts of Life AI (Goals stay free). */
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
