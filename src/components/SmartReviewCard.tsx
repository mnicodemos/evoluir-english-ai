import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, ChevronRight, RotateCcw } from "lucide-react";

import reviewListening from "@/assets/review-listening.jpg.asset.json";
import reviewWriting from "@/assets/review-writing.jpg.asset.json";

import { EvoGuide } from "@/components/EvoGuide";
import { LearningMomentum } from "@/components/LearningMomentum";
import { PathProgressCard } from "@/components/LearningPathCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivityIndicators } from "@/hooks/useActivityIndicators";
import { useProfile } from "@/hooks/useProfile";
import { dashboardActionAvailable } from "@/lib/activityIndicators";
import { NEXT_STEP_SKILL_TEXT } from "@/lib/pedagogy/nextStep";
import { loadNextStep } from "@/lib/pedagogy/nextStep.functions";
import { SMART_REVIEW_REASON_TEXT } from "@/lib/pedagogy/smartReviewUx";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

/**
 * "Smart review" — what is worth recovering now. Semantically distinct from
 * "Your next step" (what matters most now). Everything shown here is decided
 * server-side; this section only presents it, and it renders nothing when there
 * is no valid recommendation.
 */
export function SmartReviewCard({
  streakDays,
  compact = false,
}: {
  streakDays: number;
  compact?: boolean;
}) {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);

  const { data: profile } = useProfile();
  const indicators = useActivityIndicators();
  // Same query key as the next step: the data is already in cache, so this
  // section adds no request at all.
  const { data, isLoading, isError } = useQuery({
    queryKey: ["next-step", profile?.level ?? null],
    queryFn: () => loadNextStep({ data: undefined }),
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <section
        className={compact ? "card-soft h-full p-4" : "card-soft p-5"}
        aria-busy="true"
        aria-label={t("Smart review")}
      >
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-4 w-64" />
      </section>
    );
  }

  // An error here must never break the dashboard: the section simply steps out.
  if (isError || !data) return null;

  const items = (data.reviews ?? []).filter((item) =>
    dashboardActionAvailable(item.resource.to, indicators),
  );
  if (items.length === 0) return null;

  if (compact) {
    return (
      <section className="card-soft flex h-full min-w-0 flex-col p-3 xl:p-3" aria-labelledby="smart-review-title">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <BookOpen className="size-6 text-dashboard-cyan" strokeWidth={2.5} aria-hidden="true" />
          <h2 id="smart-review-title" className="font-display text-sm font-semibold">
            {t("Keep improving")}
          </h2>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <ul className="mt-3 grid flex-1 grid-rows-2 gap-2 overflow-hidden xl:mt-4 xl:gap-2">
          {items.slice(0, 2).map((item, index) => {
            const skillLabel = t(NEXT_STEP_SKILL_TEXT[item.skill] ?? item.skill);
            return (
              <li
                key={item.skill}
                className="grid min-h-0 min-w-0 grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-md border border-border bg-secondary/45 pr-2"
              >
                <img
                  src={(index === 0 ? reviewWriting : reviewListening).url}
                  alt=""
                  className="h-full min-h-0 w-16 object-cover"
                />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground">{skillLabel}</p>
                  <p className="truncate text-sm font-semibold">{t(item.resource.title)}</p>
                  <p className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">
                    {t(SMART_REVIEW_REASON_TEXT[item.category])}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  {item.resource.params ? (
                    <Link
                      to="/learning/$lessonId"
                      params={item.resource.params}
                      aria-label={`${t("Review now")}: ${skillLabel}`}
                    >
                      {t("Review")}
                    </Link>
                  ) : (
                    <Link to={item.resource.to} aria-label={`${t("Review now")}: ${skillLabel}`}>
                      {t("Review")}
                    </Link>
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <section className="card-soft p-5" aria-labelledby="smart-review-title">
      <div className="grid min-w-0 lg:grid-cols-2 lg:gap-x-0">
        <div className="lg:pr-5">
          <EvoGuide title={t("This is a good skill to reinforce now.")} imageSize="lesson" />
        </div>
        <LearningMomentum streakDays={streakDays} />
      </div>

      <div className="mt-5 grid min-w-0 border-t border-border pt-5 lg:grid-cols-2 lg:gap-x-0">
        <div className="flex min-w-0 items-start gap-4 lg:pr-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary">
            <RotateCcw className="size-5 text-[oklch(0.45_0.11_255)]" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="smart-review-title" className="text-lg font-semibold">
              {t("Smart review")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("Worth recovering now")}</p>

            <ul className="mt-4 grid gap-4">
              {items.map((item) => {
                const skillLabel = t(NEXT_STEP_SKILL_TEXT[item.skill] ?? item.skill);
                return (
                  <li
                    key={item.skill}
                    className="min-w-0 border-t border-border pt-4 first:border-t-0 first:pt-0"
                  >
                    <p className="break-words font-medium">{skillLabel}</p>
                    <p className="mt-0.5 break-words text-sm text-muted-foreground">
                      {t(SMART_REVIEW_REASON_TEXT[item.category])}
                    </p>
                    <p className="mt-1 break-words text-sm">
                      {t("How to practise")}:{" "}
                      <span className="font-medium">{t(item.resource.title)}</span>
                    </p>
                    {item.resource.params ? (
                      <Button asChild variant="outline" className="mt-3 w-full sm:w-auto">
                        <Link
                          to="/learning/$lessonId"
                          params={item.resource.params}
                          aria-label={`${t("Review now")}: ${skillLabel}`}
                        >
                          {t("Review now")}
                          <ArrowRight aria-hidden="true" />
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild variant="outline" className="mt-3 w-full sm:w-auto">
                        <Link
                          to={item.resource.to}
                          aria-label={`${t("Review now")}: ${skillLabel}`}
                        >
                          {t("Review now")}
                          <ArrowRight aria-hidden="true" />
                        </Link>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="mt-5 min-w-0 border-t border-border pt-5 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <PathProgressCard embedded />
        </div>
      </div>
    </section>
  );
}
