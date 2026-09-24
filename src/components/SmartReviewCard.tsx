import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, RotateCcw } from "lucide-react";

import { EvoGuide } from "@/components/EvoGuide";
import { LearningMomentum } from "@/components/LearningMomentum";
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
export function SmartReviewCard({ streakDays }: { streakDays: number }) {
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
      <section className="card-soft p-5" aria-busy="true" aria-label={t("Smart review")}>
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

  return (
    <section className="card-soft p-5" aria-labelledby="smart-review-title">
      <div className="grid min-w-0 lg:grid-cols-2 lg:gap-5">
        <EvoGuide title={t("This is a good skill to reinforce now.")} imageSize="lesson" />
        <LearningMomentum streakDays={streakDays} />
      </div>

      <div className="mt-5 flex min-w-0 items-start gap-4 border-t border-border pt-5">
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
                      <Link to={item.resource.to} aria-label={`${t("Review now")}: ${skillLabel}`}>
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
    </section>
  );
}
