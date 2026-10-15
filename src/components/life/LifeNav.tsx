import { Link } from "@tanstack/react-router";
import { Crown, LayoutDashboard, ListChecks, Repeat, Sparkles, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { cn } from "@/lib/utils";

export type LifeTab = "overview" | "goals" | "routine" | "habits" | "coach";

const TABS: { key: LifeTab; to: string; label: string; icon: typeof Target }[] = [
  { key: "overview", to: "/life", label: "Today", icon: LayoutDashboard },
  { key: "goals", to: "/goals", label: "Goals", icon: Target },
  { key: "routine", to: "/life/routine", label: "Routine", icon: ListChecks },
  { key: "habits", to: "/life/habits", label: "Habits", icon: Repeat },
  { key: "coach", to: "/life/coach", label: "Life Coach", icon: Sparkles },
];

export function useLifeT() {
  const { lang } = useUiLang();
  return {
    lang,
    t: (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label),
  };
}

/**
 * Header of every Life AI screen (the owner's Evoluir+ Life AI module, phase
 * 1): name, slogan and the tabs Today, Goals, Routine, Habits and Life Coach.
 */
export function LifeNav({ active }: { active: LifeTab }) {
  const { t } = useLifeT();
  return (
    <header className="mb-4">
      <h1 className="text-xl font-bold lg:text-3xl">
        Life AI <span className="text-brand-green">+</span>
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("Evolve one day at a time.")}</p>
      <nav
        aria-label="Life AI"
        className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const current = tab.key === active;
          return (
            <Link
              key={tab.key}
              to={tab.to}
              aria-current={current ? "page" : undefined}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
                current
                  ? "border-brand-green/50 bg-brand-green/10 text-brand-green"
                  : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {t(tab.label)}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

/** Shown on Premium parts of Life AI to free students (Goals stay free). */
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
      <Button asChild className="bg-brand-green text-sidebar hover:bg-brand-green/90">
        <Link to="/premium">{t("See plans")}</Link>
      </Button>
    </section>
  );
}
