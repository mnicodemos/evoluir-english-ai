import { Link } from "@tanstack/react-router";
import { ArrowRight, Compass } from "lucide-react";

import { EvoAvatar } from "@/components/EvoAvatar";
import { PremiumBadge, useIsPremium } from "@/components/PremiumBadge";
import { useProfile } from "@/hooks/useProfile";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

export function EnglishAdventuresDashboardCard() {
  const { data: profile } = useProfile();
  const locked = useIsPremium() === false;
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const level = (profile?.max_level || profile?.level || "a1").toLowerCase();
  const title = level === "a2" ? "The Surprise Delivery" : "The Welcome Mix-Up";
  const teaser =
    level === "a2"
      ? "A delivery arrives with an unexpected surprise. What will you do?"
      : "Help EVO welcome the guests and match their name cards.";

  return (
    <section
      className={`card-soft relative flex min-w-0 flex-col overflow-hidden p-3 xl:h-full xl:min-h-0 xl:px-4 xl:py-3 ${locked ? "[&>*:not(:first-child)]:opacity-50" : ""}`}
      aria-labelledby="adventures-card-title"
    >
      <div className="flex min-h-[1.65rem] items-center gap-2">
        <Compass className="size-[1.35rem] shrink-0 text-brand-green" aria-hidden="true" />
        <h2 id="adventures-card-title" className="font-display text-sm font-semibold">
          {t("English Adventures")}
        </h2>
        <PremiumBadge className="ml-auto" />
      </div>
      <div className="mt-1 flex min-h-0 min-w-0 flex-1 items-center gap-2.5">
        <EvoAvatar decorative className="size-10 shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-green">
            {level.toUpperCase()} · {t("A story with EVO")}
          </p>
          <p className="truncate text-sm font-semibold" translate="no" lang="en">
            {title}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{t(teaser)}</p>
        </div>
      </div>
      <Link
        to={locked ? "/premium" : "/adventures"}
        className="mt-1 inline-flex min-h-7 items-center justify-end gap-1.5 text-xs font-semibold text-brand-green hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60"
      >
        {locked ? t("See plans") : t("Let's explore!")}
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </section>
  );
}
