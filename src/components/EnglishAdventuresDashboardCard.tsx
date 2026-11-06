import { Link } from "@tanstack/react-router";
import { ArrowRight, Compass, Sparkles } from "lucide-react";

import { EvoAvatar } from "@/components/EvoAvatar";
import { useProfile } from "@/hooks/useProfile";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

export function EnglishAdventuresDashboardCard() {
  const { data: profile } = useProfile();
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const level = (profile?.max_level || profile?.level || "a1").toLowerCase();
  const title = level === "a2" ? "The Surprise Delivery" : "The Missing Bag";
  const teaser =
    level === "a2"
      ? "A delivery arrives with an unexpected surprise. What will you do?"
      : "Oh no! Something is missing! Can you help find it?";

  return (
    <section
      className="card-soft relative flex min-w-0 flex-col overflow-hidden p-3 xl:h-full xl:min-h-0 xl:px-4 xl:py-3"
      aria-labelledby="adventures-card-title"
    >
      <div className="flex min-h-[1.65rem] items-center gap-2">
        <Compass className="size-[1.35rem] shrink-0 text-brand-green" aria-hidden="true" />
        <h2 id="adventures-card-title" className="font-display text-sm font-semibold">
          English Adventures
        </h2>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-brand-green/30 bg-brand-green/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-green">
          <Sparkles className="size-3" aria-hidden="true" />
          {t("Bonus")}
        </span>
      </div>
      <div className="mt-2 flex min-w-0 flex-1 items-center gap-3">
        <EvoAvatar decorative className="size-12 sm:size-14" />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-green">
            {level.toUpperCase()} · {t("A story with EVO")}
          </p>
          <p className="truncate text-sm font-semibold" translate="no" lang="en">{title}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t(teaser)}</p>
        </div>
      </div>
      <Link
        to="/adventures"
        className="mt-2 inline-flex min-h-8 items-center justify-end gap-1.5 text-xs font-semibold text-brand-green hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60"
      >
        {t("Let's explore!")}
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </section>
  );
}
