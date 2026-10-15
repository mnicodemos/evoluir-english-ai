import { Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";

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

/** Header of the one-page Life AI: name and slogan (no tabs; user request). */
export function LifeHeader() {
  const { t } = useLifeT();
  return (
    <header className="mb-4">
      <h1 className="text-xl font-bold lg:text-3xl">
        Life AI <span className="text-brand-green">+</span>
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("Evolve one day at a time.")}</p>
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
