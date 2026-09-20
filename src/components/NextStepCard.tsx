import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Compass, Sparkles } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  NEXT_STEP_ACTION_TEXT,
  NEXT_STEP_REASON_TEXT,
  NEXT_STEP_SKILL_TEXT,
} from "@/lib/pedagogy/nextStep";
import { loadNextStep } from "@/lib/pedagogy/nextStep.functions";
import { findLevel } from "@/lib/level";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

/**
 * Adaptive next step. Everything shown here is decided server-side from the
 * student's own pedagogical data; the card only presents it.
 */
export function NextStepCard() {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["next-step"],
    queryFn: () => loadNextStep({ data: undefined }),
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <section className="card-soft p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-4 w-64" />
        <Skeleton className="mt-4 h-9 w-40" />
      </section>
    );
  }

  if (isError || !data) return null;

  const skillLabel = data.prioritySkill
    ? t(NEXT_STEP_SKILL_TEXT[data.prioritySkill] ?? data.prioritySkill)
    : t("Free practice");
  const confidence =
    data.insight?.confidence === null || data.insight?.confidence === undefined
      ? null
      : Math.round(data.insight.confidence * 100);
  const cefrLevel = data.insight?.cefrLevel ? findLevel(data.insight.cefrLevel).label : null;
  const progressionReason = data.insight?.recentlyPractised
    ? t("Builds on your recent practice")
    : t("Adds recent evidence to your progress");

  return (
    <section className="card-soft p-5" aria-label={t("Your next step")}>
      <div className="grid gap-5 lg:grid-cols-2 lg:gap-0">
        <div className="flex min-w-0 items-start gap-4 lg:pr-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary">
            <Compass className="size-5 text-[oklch(0.45_0.11_255)]" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">{t("Your next step")}</h2>
            <p className="mt-0.5 font-medium">{skillLabel}</p>
            <p className="text-sm text-muted-foreground">{t(NEXT_STEP_REASON_TEXT[data.reason])}</p>
            <p className="mt-2 text-sm">
              {t("How to practise")}: <span className="font-medium">{data.activity.title}</span>
            </p>
            {data.activity.params ? (
              <Link
                to="/learning/$lessonId"
                params={data.activity.params}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                {t(NEXT_STEP_ACTION_TEXT[data.action])}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            ) : (
              <Link
                to={data.activity.to}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                {t(NEXT_STEP_ACTION_TEXT[data.action])}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>

        <aside className="min-w-0 border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            <h3 className="font-semibold">{t("AI Learning Insight")}</h3>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase text-muted-foreground">
            {t("Why now?")}
          </p>
          <p className="mt-1 text-sm">{t(NEXT_STEP_REASON_TEXT[data.reason])}</p>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">{t("Current level")}</dt>
              <dd className="mt-0.5 font-medium">{cefrLevel ?? t("Not available yet")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("Confidence")}</dt>
              <dd className="mt-0.5 font-medium">
                {confidence === null ? t("Building evidence") : `${confidence}%`}
              </dd>
            </div>
          </dl>

          <div className="mt-4">
            <p className="text-xs text-muted-foreground">{t("Recommended because")}</p>
            <ul className="mt-2 space-y-2 text-sm">
              {cefrLevel ? (
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  <span>{t("Matches your CEFR level")}</span>
                </li>
              ) : null}
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                <span>{progressionReason}</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                <span>{t("Supports your progression")}</span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}
