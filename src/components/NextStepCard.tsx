import { useQuery } from "@tanstack/react-query";
import evoDashboardApproved from "@/assets/evo-dashboard-desktop-4x1.png.asset.json";
import evoDashboardMobile from "@/assets/evo-dashboard-mobile-original-2026-10-03.png.asset.json";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, ChevronRight, Compass, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EvoDailyReflection } from "@/components/EvoDailyReflection";
import { EvoGuide } from "@/components/EvoGuide";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivityIndicators } from "@/hooks/useActivityIndicators";
import { useProfile } from "@/hooks/useProfile";
import { dashboardActionAvailable } from "@/lib/activityIndicators";
import {
  NEXT_STEP_ACTION_TEXT,
  NEXT_STEP_EVIDENCE_TEXT,
  NEXT_STEP_PRIORITY_TEXT,
  NEXT_STEP_PROGRESS_TEXT,
  NEXT_STEP_REASON_TEXT,
  NEXT_STEP_SITUATION_TEXT,
  NEXT_STEP_SKILL_TEXT,
  NEXT_STEP_WHY_NOW_TEXT,
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
export function NextStepCard({ compact = false }: { compact?: boolean }) {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);

  // Key the cache by the current CEFR level: when the level changes, the
  // previous level's insight (confidence, reasons) is never reused.
  const { data: profile } = useProfile();
  const activityIndicators = useActivityIndicators();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["next-step", profile?.level ?? null],
    queryFn: () => loadNextStep({ data: undefined }),
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <section className={compact ? "card-soft h-full p-4" : "card-soft p-5"}>
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
  const cefrLevel = data.insight?.cefrLevel
    ? findLevel(data.insight.cefrLevel).cefr.replace(/^CEFR /, "")
    : null;
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
  // "Why now?" explains the real reason that won the SAME server-side priority
  // decision — never a parallel logic, never score or confidence.
  const whyNowText = t(NEXT_STEP_WHY_NOW_TEXT[data.reason])
    .replaceAll("{skill}", skillLabel)
    .replaceAll("{level}", cefrLevel ?? t("your current level"));
  // "Why this matters now?" reuses the SAME server-side decision: priority line
  // filled only with the resolved skill/level, evidence line from the real
  // reason, and an evolution-context line backed by existing insight data.
  const priorityText = t(NEXT_STEP_PRIORITY_TEXT)
    .replaceAll("{skill}", skillLabel)
    .replaceAll("{level}", cefrLevel ?? t("your current level"));
  const evidenceText = t(NEXT_STEP_EVIDENCE_TEXT[data.reason])
    .replaceAll("{skill}", skillLabel)
    .replaceAll("{level}", cefrLevel ?? t("your current level"));
  const progressText =
    data.insight?.situation === "strong_elsewhere" && strongestLabel
      ? t(NEXT_STEP_PROGRESS_TEXT.withStrongSkill)
          .replaceAll("{strongest}", strongestLabel)
          .replaceAll("{level}", cefrLevel ?? t("your current level"))
      : t(NEXT_STEP_PROGRESS_TEXT.neutral);
  const actionText = t(NEXT_STEP_ACTION_TEXT[data.action]);
  const quickWin = data.quickWin;
  const mainAvailable = dashboardActionAvailable(data.activity.to, activityIndicators);
  const quickWinAvailable = quickWin
    ? dashboardActionAvailable(quickWin.activity.to, activityIndicators)
    : false;
  const challengeAvailable = data.quest
    ? dashboardActionAvailable(data.quest.resource.to, activityIndicators)
    : false;
  // Shared action buttons: Quick Win sits next to "Today's focus" on mobile and
  // inside the "Why now?" card on larger screens; the challenge button sits
  // next to the focus title on mobile and inside the card on larger screens.
  // Colored action icons: ⚡ renders in its native yellow, ✣ uses the button
  // text color as a filled glyph instead of the previous outline strokes.
  const quickWinIcon = (
    <span aria-hidden="true" className="text-[13px] leading-none">
      ⚡
    </span>
  );
  const challengeIcon = (
    <span aria-hidden="true" className="text-[13px] leading-none text-sidebar-foreground">
      ✣
    </span>
  );
  const quickWinButton =
    quickWin && quickWinAvailable ? (
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="h-8 min-w-0 px-2 text-[11px] text-sidebar-foreground hover:bg-sidebar-accent sm:h-9 sm:text-sm"
      >
        {quickWin.activity.params ? (
          <Link to="/learning/$lessonId" params={quickWin.activity.params}>
            {quickWinIcon} {t("Quick Win")}
          </Link>
        ) : (
          <Link to={quickWin.activity.to}>
            {quickWinIcon} {t("Quick Win")}
          </Link>
        )}
      </Button>
    ) : null;
  const challengeButton =
    data.quest && challengeAvailable ? (
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="h-8 min-w-0 px-2 text-[11px] text-sidebar-foreground hover:bg-sidebar-accent sm:h-9 sm:text-sm"
      >
        {data.quest.resource.params ? (
          <Link to="/learning/$lessonId" params={data.quest.resource.params}>
            {challengeIcon} {t("Take the challenge")}
          </Link>
        ) : (
          <Link to={data.quest.resource.to}>
            {challengeIcon} {t("Take the challenge")}
          </Link>
        )}
      </Button>
    ) : null;
  const actionButtons = (
    <>
      {quickWinButton}
      {challengeButton}
    </>
  );

  if (compact) {
    return (
      <section
        className="dashboard-focus relative h-full min-w-0 overflow-hidden rounded-lg border-x border-b border-border border-t-0 bg-card text-sidebar-foreground shadow-[var(--shadow-soft)] sm:border-t sm:border-border sm:bg-evo-block"
        aria-label={t("Your next step")}
      >
        <div className="flex h-full min-w-0 flex-col sm:grid sm:grid-cols-[14rem_minmax(0,1fr)] xl:flex xl:flex-col 2xl:grid 2xl:grid-cols-[auto_minmax(0,1fr)] 2xl:items-center">
          <div
            className="relative aspect-[4/1] h-auto w-full flex-none self-stretch overflow-hidden bg-sidebar sm:aspect-auto sm:min-h-[13.5rem] sm:h-auto sm:bg-evo-block lg:min-h-[10.5rem] xl:aspect-[4/1] xl:h-auto xl:max-h-[10.5rem] xl:min-h-0 2xl:h-44 2xl:max-h-none 2xl:self-center"
            aria-hidden="true"
          >
            <div className="absolute inset-0 overflow-hidden sm:static sm:aspect-auto sm:overflow-visible">
              <img
                src={evoDashboardMobile.url}
                alt=""
                width={1920}
                height={709}
                className="absolute inset-x-0 top-0 block h-auto w-full -translate-y-[14.245%] sm:hidden"
              />
              <img
                src={evoDashboardApproved.url}
                alt=""
                width={880}
                height={300}
                className="hidden h-auto w-full sm:absolute sm:inset-0 sm:block sm:h-full sm:object-cover sm:object-left xl:object-[50%_22%]"
              />
            </div>
          </div>

          <div className="sm:contents xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(19.66rem,1.16fr)] xl:items-stretch">
          <div className="relative z-10 flex min-w-0 flex-col px-3 py-2 sm:px-4 sm:py-2 xl:order-2 xl:justify-center xl:px-3 xl:py-2">
            <div className="flex items-center justify-between gap-3 sm:block">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase text-brand-green">
                  EVO · {t("Your AI Learning Coach")}
                </p>
                <div className="mt-2">
                  <p className="whitespace-nowrap text-[10px] font-semibold leading-none text-sidebar-foreground/75 sm:whitespace-normal sm:text-sm sm:leading-normal">
                    {t("TODAY'S PRIORITY")}
                  </p>
                  <h2 className="mt-2 min-w-0 break-words text-lg font-bold leading-tight text-sidebar-foreground sm:mt-0.5 sm:text-2xl sm:leading-normal xl:text-3xl">
                    {skillLabel}
                  </h2>
                </div>
              </div>
              {mainAvailable && (
                <Button
                  asChild
                  className="h-[2.875rem] w-[42%] shrink-0 self-center rounded-xl bg-brand-green px-2 text-sm font-bold text-sidebar [word-spacing:0.1em] hover:bg-brand-green/90 sm:hidden"
                >
                  {data.activity.params ? (
                    <Link to="/learning/$lessonId" params={data.activity.params}>
                      {t("Practice now")}
                      <ChevronRight strokeWidth={3} aria-hidden="true" />
                    </Link>
                  ) : (
                    <Link to={data.activity.to}>
                      {t("Practice now")}
                      <ChevronRight strokeWidth={3} aria-hidden="true" />
                    </Link>
                  )}
                </Button>
              )}
            </div>
            <p className="mt-1 hidden line-clamp-2 text-xs text-sidebar-foreground/70 sm:block sm:mt-2 sm:text-sm xl:mt-1 xl:text-xs">
              {t(NEXT_STEP_REASON_TEXT[data.reason])}
            </p>
            <p className="mt-2 hidden line-clamp-1 text-sm text-sidebar-foreground/85 sm:block xl:mt-1 xl:text-xs">
              {t("How to practise")}: <span className="font-semibold">{data.activity.title}</span>
            </p>
            {mainAvailable && (
              <Button
                asChild
                className="mt-4 hidden w-full bg-brand-green text-sidebar [word-spacing:0.1em] hover:bg-brand-green/90 sm:flex sm:w-fit sm:rounded-xl sm:px-5 sm:text-sm sm:font-bold xl:mt-2 xl:h-9"
              >
                {data.activity.params ? (
                  <Link to="/learning/$lessonId" params={data.activity.params}>
                    {t("Practice now")}
                    <ChevronRight strokeWidth={3} aria-hidden="true" />
                  </Link>
                ) : (
                  <Link to={data.activity.to}>
                    {t("Practice now")}
                    <ChevronRight strokeWidth={3} aria-hidden="true" />
                  </Link>
                )}
              </Button>
            )}
          </div>

          <aside className="relative z-10 m-3 mt-0 hidden min-w-0 rounded-lg border border-border bg-background/35 p-2.5 sm:col-span-2 sm:block sm:border-border sm:bg-card sm:p-3 xl:order-3 xl:col-span-1 xl:m-1.5 xl:flex xl:flex-col xl:self-stretch">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-brand-green" aria-hidden="true" />
              <h3 className="font-semibold text-sidebar-foreground">
                {t("Why this matters now?")}
              </h3>
            </div>
            <ul className="mt-1 grid gap-2 text-xs text-sidebar-foreground/80 sm:mt-2 xl:mt-2.5 xl:gap-1.5 xl:text-xs xl:leading-snug">
              {/* Mobile: short summary + evidence item — never clamped, never cut. */}
              <li className="flex items-start gap-2 sm:hidden">
                <Check className="mt-0.5 size-3.5 shrink-0 text-brand-green" />
                <span className="leading-tight">{priorityText}</span>
              </li>
              <li className="flex items-start gap-2 sm:hidden">
                <Check className="mt-0.5 size-3.5 shrink-0 text-brand-green" />
                <span className="leading-tight">{evidenceText}</span>
              </li>
              {/* Desktop/tablet: the complete three-line explanation. */}
              <li className="hidden items-start gap-2 sm:flex">
                <Check className="mt-0.5 size-3.5 shrink-0 text-brand-green" />
                <span>{progressText}</span>
              </li>
              <li className="hidden items-start gap-2 sm:flex">
                <Check className="mt-0.5 size-3.5 shrink-0 text-brand-green" />
                <span>{priorityText}</span>
              </li>
              <li className="hidden items-start gap-2 sm:flex">
                <Check className="mt-0.5 size-3.5 shrink-0 text-brand-green" />
                <span>{evidenceText}</span>
              </li>
            </ul>
            {(quickWinButton || challengeButton) && (
              <div className="mt-3 hidden flex-wrap gap-1 sm:flex xl:mt-auto xl:items-center xl:gap-2 xl:pt-3">
                {actionButtons}
              </div>
            )}
          </aside>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="card-soft p-5" aria-label={t("Your next step")}>
      <div className="grid min-w-0 lg:grid-cols-2 lg:gap-x-0">
        <div className="lg:pr-6">
          <EvoGuide title={t("Your focus is here. Get started now!")} imageSize="lesson" />
        </div>
        <EvoDailyReflection userId={profile?.id ?? "student"} name={profile?.name ?? ""} />
      </div>

      <div className="mt-5 grid gap-5 border-t border-border pt-5 lg:grid-cols-2 lg:gap-x-0">
        <div className="space-y-4 lg:pr-6">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary">
              <Compass className="size-5 text-[oklch(0.45_0.11_255)]" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">{t("Your next step")}</h2>
              <p className="mt-0.5 font-medium">{skillLabel}</p>
              <p className="text-sm text-muted-foreground">
                {t(NEXT_STEP_REASON_TEXT[data.reason])}
              </p>
              <p className="mt-2 text-sm">
                {t("How to practise")}: <span className="font-medium">{data.activity.title}</span>
              </p>
              {!mainAvailable ? null : data.activity.params ? (
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
            </div>
          </div>

          {quickWin ? (
            <div className="border-t border-border pt-3">
              <div className="flex min-w-0 items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary">
                  <span aria-hidden="true" className="text-lg leading-none">
                    ⚡
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold">{t("Quick Win")}</h2>
                  <p className="mt-0.5 font-medium">{t(quickWin.title)}</p>

                  <ul className="mt-2 grid gap-1 text-sm">
                    <li className="flex min-w-0 items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="font-medium">{t("Review")}</span>
                        <span className="text-muted-foreground"> — {t("5 missed words")}</span>
                      </span>
                    </li>
                    <li className="flex min-w-0 items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="font-medium">{t("Recall")}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          — {t("Remember before revealing")}
                        </span>
                      </span>
                    </li>
                    <li className="flex min-w-0 items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="font-medium">{t("Track")}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          — {t("Mark Error or Correct")}
                        </span>
                      </span>
                    </li>
                  </ul>

                  {!quickWinAvailable ? null : quickWin.activity.params ? (
                    <Button asChild className="mt-3">
                      <Link to="/learning/$lessonId" params={quickWin.activity.params}>
                        {t("Quick practice")}
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild className="mt-3">
                      <Link to={quickWin.activity.to}>
                        {t("Quick practice")}
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : null}
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
              <p className="mt-1 text-sm">{whyNowText}</p>

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
                  {!challengeAvailable ? null : data.quest.resource.params ? (
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
