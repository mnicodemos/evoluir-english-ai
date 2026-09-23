import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Compass, Sparkles, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/useProfile";
import {
  NEXT_STEP_ACTION_TEXT,
  NEXT_STEP_REASON_TEXT,
  NEXT_STEP_SITUATION_TEXT,
  NEXT_STEP_SKILL_TEXT,
} from "@/lib/pedagogy/nextStep";
import { loadNextStep } from "@/lib/pedagogy/nextStep.functions";
import { SKILL_QUEST_ACTION_TEXT } from "@/lib/pedagogy/skillQuest";

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

  // Key the cache by the current CEFR level: when the level changes, the
  // previous level's insight (confidence, reasons) is never reused.
  const { data: profile } = useProfile();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["next-step", profile?.level ?? null],
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
  const cefrLevel = data.insight?.cefrLevel ? findLevel(data.insight.cefrLevel).cefr : null;
  const strongestLabel = data.insight?.strongestSkill
    ? t(NEXT_STEP_SKILL_TEXT[data.insight.strongestSkill] ?? data.insight.strongestSkill)
    : null;
  // Deterministic copy: the template comes from the pedagogy layer and is
  // filled only with values the server already provided for this level.
  const situation = data.insight?.situation ?? "no_data";
  const situationText = t(NEXT_STEP_SITUATION_TEXT[situation])
    .replaceAll("{skill}", skillLabel)
    .replaceAll("{level}", cefrLevel ?? t("your current level"))
    .replaceAll("{strongest}", strongestLabel ?? skillLabel);
  const actionText = t(NEXT_STEP_ACTION_TEXT[data.action]);
  const quickWin = data.quickWin;


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
              <Button asChild className="mt-3">
                <Link to="/learning/$lessonId" params={data.activity.params}>
                  {t("Practice now")}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <Button asChild className="mt-3">
                <Link to={data.activity.to}>
                  {t("Practice now")}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            )}

            {quickWin ? (
              <div className="mt-5 border-t border-border pt-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary">
                    <Zap className="size-4 text-primary" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      {t("Quick Win")}
                    </p>
                    <h3 className="font-semibold leading-snug">{t(quickWin.title)}</h3>
                  </div>
                </div>

                <ul className="mt-3 grid gap-2 text-sm">
                  {quickWin.steps.map((step) => (
                    <li key={`${step.label}-${step.text}`} className="flex min-w-0 items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="font-medium">{t(step.label)}</span>
                        <span className="text-muted-foreground"> — {t(step.text)}</span>
                      </span>
                    </li>
                  ))}
                </ul>

                {quickWin.activity.params ? (
                  <Button asChild className="mt-4">
                    <Link to="/learning/$lessonId" params={quickWin.activity.params}>
                      {t("Quick practice")}
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                ) : (
                  <Button asChild className="mt-4">
                    <Link to={quickWin.activity.to}>
                      {t("Quick practice")}
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <aside className="min-w-0 border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary">
              <Sparkles className="size-5 text-primary" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold">{t("AI Learning Insight")}</h3>

              <p className="mt-3 text-xs font-semibold uppercase text-muted-foreground">
                {t("Your next focus")}
              </p>
              <p className="mt-1 font-medium">
                {skillLabel}
                {cefrLevel ? ` — ${cefrLevel}` : ""}
              </p>

              <p className="mt-4 text-xs font-semibold uppercase text-muted-foreground">
                {t("What is happening")}
              </p>
              <p className="mt-1 text-sm">{situationText}</p>

              <p className="mt-4 text-xs font-semibold uppercase text-muted-foreground">
                {t("Why this matters now")}
              </p>
              <p className="mt-1 text-sm">{t(NEXT_STEP_REASON_TEXT[data.reason])}</p>

              <p className="mt-4 text-xs font-semibold uppercase text-muted-foreground">
                {t("Next step")}
              </p>
              <p className="mt-1 flex items-start gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                <span>
                  {actionText}
                  {data.activity.title ? `: ${data.activity.title}` : ""}
                </span>
              </p>

              {data.quest ? (
                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    {t("Next challenge")}
                  </p>
                  <p className="mt-1 font-medium">
                    {t(NEXT_STEP_SKILL_TEXT[data.quest.skill] ?? data.quest.skill)}
                  </p>
                  <p className="mt-1 text-sm">{t(SKILL_QUEST_ACTION_TEXT[data.quest.action])}</p>
                  {data.quest.resource.params ? (
                    <Button asChild className="mt-3">
                      <Link to="/learning/$lessonId" params={data.quest.resource.params}>
                        {t("Take the challenge")}
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild className="mt-3">
                      <Link to={data.quest.resource.to}>
                        {t("Take the challenge")}
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    </Button>
                  )}
                </div>
              ) : null}
            </div>

          </div>
        </aside>
      </div>
    </section>
  );
}
