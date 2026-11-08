import { Link } from "@tanstack/react-router";
import { ArrowRight, Compass, Map } from "lucide-react";

import { EnglishAdventuresAvatar } from "@/components/EnglishAdventuresAvatar";
import { PremiumBadge, useIsPremium } from "@/components/PremiumBadge";
import { useEnglishAdventuresProgress } from "@/hooks/useEnglishAdventuresProgress";
import { FILL_IN_TRANSITION, useFillIn } from "@/hooks/useFillIn";
import { useProfile } from "@/hooks/useProfile";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

export function EnglishAdventuresDashboardCard() {
  const { data: profile } = useProfile();
  const locked = useIsPremium() === false;
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const level = (profile?.max_level || profile?.level || "a1").toLowerCase();
  const levelKey = level === "a2" ? "a2" : "a1";
  const title = levelKey === "a2" ? "The Surprise Delivery" : "The Welcome Mix-Up";
  const progress = useEnglishAdventuresProgress(levelKey);
  const barPercent = useFillIn(progress.percent);

  return (
    <section
      className={`card-soft relative flex h-full min-w-0 min-h-0 flex-col overflow-hidden p-3 xl:px-4 xl:py-3 ${locked ? "[&>*:not(:first-child)]:opacity-50" : ""}`}
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
        <EnglishAdventuresAvatar decorative className="size-10 shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-green">
            {t("Adventures with EVO")}
          </p>
          <p className="truncate text-sm font-semibold" translate="no" lang="en">
            {title}
          </p>
          {level === "a2" ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {t("An adventure about deliveries, problems and finding a solution.")}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-1 flex min-h-7 items-center gap-2">
        <div className="h-1.5 min-w-0 flex-1 rounded-full bg-secondary" aria-hidden="true">
          <div
            className={`h-full rounded-full bg-brand-green transition-[width] ${FILL_IN_TRANSITION}`}
            style={{ width: `${barPercent}%` }}
          />
        </div>
        <span
          className="shrink-0 text-[11px] font-semibold text-muted-foreground"
          title={`${progress.completed}/${progress.total}`}
        >
          {progress.percent}%
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground" title={t("Study time")}>
          {progress.minutes} {t("min")}
        </span>
        <Link
          to={locked ? "/premium" : "/adventures"}
          {...(!locked && level === "a2" ? { search: { story: "a2-1" } } : {})}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-brand-green hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60"
        >
          {!locked && <Map className="size-3.5" aria-hidden="true" />}
          {locked ? t("See plans") : t("Let's explore!")}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
