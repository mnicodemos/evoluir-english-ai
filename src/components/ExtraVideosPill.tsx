import { Link } from "@tanstack/react-router";
import { ChevronRight, Clapperboard } from "lucide-react";

import { useProfile } from "@/hooks/useProfile";
import { useExtraVideosNews } from "@/hooks/useExtraVideosNews";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

/**
 * The learning path's way to the Premium extra videos, in the glass capsule
 * of the Dashboard's Weather talk (owner request, 2026-10-31: the same size):
 * the icon in its circle, "Extra videos" over its line and a chevron; phones
 * keep the icon only. A "New" mark sits on the icon while there are videos the
 * device has not seen yet (useExtraVideosNews).
 */
export function ExtraVideosPill() {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const { data: profile } = useProfile();
  const { hasNew } = useExtraVideosNews(profile?.id);
  return (
    <div className="flex h-11 items-center rounded-full border border-white/10 bg-white/[0.04] p-1">
      <Link
        to="/learning/videos"
        aria-label={`${t("Extra videos")} · ${t("Lessons on video, Premium")}${hasNew ? ` · ${t("Just added")}` : ""}`}
        className="group flex h-9 shrink-0 items-center gap-2.5 rounded-full text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60 sm:pr-3"
      >
        <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-warning/15 text-warning">
          <Clapperboard className="size-[1.15rem]" aria-hidden="true" />
          {hasNew ? (
            <span
              className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-brand-green ring-2 ring-background"
              aria-hidden="true"
            />
          ) : null}
        </span>
        <span className="hidden leading-tight sm:block">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            {t("Extra videos")}
            {hasNew ? (
              <span className="rounded-full bg-brand-green/15 px-1.5 text-[9.5px] font-bold uppercase tracking-wide text-brand-green">
                {t("Just added")}
              </span>
            ) : null}
          </span>
          <span className="block text-[10.5px] text-muted-foreground">
            {t("Lessons on video, Premium")}
          </span>
        </span>
        <ChevronRight
          className="hidden size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block"
          aria-hidden="true"
        />
      </Link>
    </div>
  );
}
