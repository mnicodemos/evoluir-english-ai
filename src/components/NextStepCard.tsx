import { useQuery } from "@tanstack/react-query";
import evoDashboardApproved from "@/assets/evo-dashboard-more-than-english.png.asset.json";
import evoDashboardMobileFull from "@/assets/evo-banner-mobile-full.webp";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Compass,
  GraduationCap,
  Headphones,
  Lightbulb,
  Map,
  Medal,
  MessageSquareText,
  Mic,
  PenLine,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EvoDailyReflection } from "@/components/EvoDailyReflection";
import { EvoGuide } from "@/components/EvoGuide";

import { Skeleton } from "@/components/ui/skeleton";
import { useActivityIndicators } from "@/hooks/useActivityIndicators";
import { useDueReviewCount } from "@/hooks/useDueReviewCount";
import { useProfile } from "@/hooks/useProfile";
import { useWeeklyLeagueStanding } from "@/components/WeeklyLeagueSummary";
import { dashboardActionAvailable } from "@/lib/activityIndicators";
import {
  NEXT_STEP_ACTION_TEXT,
  NEXT_STEP_PRIORITY_TEXT,
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
  const league = useWeeklyLeagueStanding(profile);
  // Vocabulary words whose review date has arrived (same count as the bell).
  const dueWordReviews = useDueReviewCount(profile?.id);
  const activityIndicators = useActivityIndicators();
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
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

  // A failed load keeps the card's place with a retry, instead of leaving a
  // hole in the Dashboard.
  if (isError || !data) {
    return (
      <section
        className={
          compact
            ? "card-soft flex h-full flex-col items-center justify-center gap-3 p-4 text-center"
            : "card-soft flex flex-col items-center gap-3 p-5 text-center"
        }
        aria-label={t("Your next step")}
      >
        <p className="text-sm text-muted-foreground">{t("We could not load your next step.")}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isFetching}
          onClick={() => void refetch()}
          className="gap-2"
        >
          <RefreshCw className={isFetching ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
          {t("Try again")}
        </Button>
      </section>
    );
  }

  const skillLabel = data.prioritySkill
    ? t(NEXT_STEP_SKILL_TEXT[data.prioritySkill] ?? data.prioritySkill)
    : t("Free practice");
  const PriorityIcon =
    {
      speaking: Mic,
      pronunciation: Mic,
      writing: PenLine,
      listening: Headphones,
      vocabulary: BookOpen,
      reading: BookOpen,
      grammar: GraduationCap,
    }[data.prioritySkill ?? ""] ?? MessageSquareText;
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
  // "Why this matters now": one sentence from the SAME server-side decision,
  // filled only with the resolved skill and level.
  const priorityText = t(NEXT_STEP_PRIORITY_TEXT)
    .replaceAll("{skill}", skillLabel)
    .replaceAll("{level}", cefrLevel ?? t("your current level"));
  const actionText = t(NEXT_STEP_ACTION_TEXT[data.action]);
  // "Writing · Writing" when the skill and the place share a name: say it once.
  const questSkillLabel = data.quest
    ? t(NEXT_STEP_SKILL_TEXT[data.quest.skill] ?? data.quest.skill)
    : "";
  const questPlaceLabel = data.quest ? t(data.quest.resource.title) : "";
  const questDetail =
    questSkillLabel === questPlaceLabel
      ? questSkillLabel
      : `${questSkillLabel} · ${questPlaceLabel}`;
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
  // Mobile-only chips with outline: Quick Win, challenge and "Your trail".
  const quickWinButton =
    quickWin && quickWinAvailable ? (
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="h-8 min-w-0 px-2 max-sm:text-[10px] text-sidebar-foreground hover:bg-sidebar-accent max-sm:min-w-max max-sm:flex-auto max-sm:justify-center max-sm:gap-1 max-sm:rounded-full max-sm:border max-sm:border-sidebar-foreground/40 max-sm:px-1.5 max-sm:whitespace-nowrap sm:h-auto sm:min-h-0 sm:flex-1 sm:items-start sm:rounded-lg sm:px-2 sm:py-1.5 xl:py-1 sm:whitespace-normal sm:text-left"
      >
        {quickWin.activity.params ? (
          <Link to="/learning/$lessonId" params={quickWin.activity.params}>
            <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
              <span className="flex items-center gap-1.5 text-[11.5px] font-bold leading-none max-sm:text-[10px] max-sm:font-normal sm:text-[13px]">
                {quickWinIcon} {t("Quick Win")}
              </span>
              <span className="hidden w-full text-left text-[9.5px] leading-tight text-sidebar-foreground/70 sm:block sm:text-xs sm:font-normal">
                {t(quickWin.cta)} · {t(quickWin.activity.title)}
              </span>
            </span>
          </Link>
        ) : (
          <Link to={quickWin.activity.to}>
            <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
              <span className="flex items-center gap-1.5 text-[11.5px] font-bold leading-none max-sm:text-[10px] max-sm:font-normal sm:text-[13px]">
                {quickWinIcon} {t("Quick Win")}
              </span>
              <span className="hidden w-full text-left text-[9.5px] leading-tight text-sidebar-foreground/70 sm:block sm:text-xs sm:font-normal">
                {t(quickWin.cta)} · {t(quickWin.activity.title)}
              </span>
            </span>
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
        className="h-8 min-w-0 px-2 max-sm:text-[10px] text-sidebar-foreground hover:bg-sidebar-accent max-sm:min-w-max max-sm:flex-auto max-sm:justify-center max-sm:gap-1 max-sm:rounded-full max-sm:border max-sm:border-sidebar-foreground/40 max-sm:px-1.5 max-sm:whitespace-nowrap sm:h-auto sm:min-h-0 sm:flex-1 sm:items-start sm:rounded-lg sm:px-2 sm:py-1.5 xl:py-1 sm:whitespace-normal sm:text-left"
      >
        {data.quest.resource.params ? (
          <Link to="/learning/$lessonId" params={data.quest.resource.params}>
            <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
              <span className="flex items-center gap-1.5 text-[11.5px] font-bold leading-none max-sm:text-[10px] max-sm:font-normal sm:text-[13px]">
                {challengeIcon} {t("Take the challenge")}
              </span>
              <span className="hidden w-full text-left text-[9.5px] leading-tight text-sidebar-foreground/70 sm:block sm:text-xs sm:font-normal">
                {questDetail}
              </span>
            </span>
          </Link>
        ) : (
          <Link to={data.quest.resource.to}>
            <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
              <span className="flex items-center gap-1.5 text-[11.5px] font-bold leading-none max-sm:text-[10px] max-sm:font-normal sm:text-[13px]">
                {challengeIcon} {t("Take the challenge")}
              </span>
              <span className="hidden w-full text-left text-[9.5px] leading-tight text-sidebar-foreground/70 sm:block sm:text-xs sm:font-normal">
                {questDetail}
              </span>
            </span>
          </Link>
        )}
      </Button>
    ) : null;
  // Mobile-only companion chip: opens the Study Plan page ("Your trail"). Same
  // outline chip as Quick Win; the map icon matches the desktop "View your trail" button.
  const mapButton = (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="h-8 min-w-0 px-2 text-sidebar-foreground hover:bg-sidebar-accent max-sm:min-w-max max-sm:flex-auto max-sm:justify-center max-sm:gap-1 max-sm:rounded-full max-sm:border max-sm:border-sidebar-foreground/40 max-sm:px-1.5 max-sm:text-[10px] max-sm:whitespace-nowrap sm:h-9"
    >
      <Link to="/study-plan">
        <span className="flex items-center gap-1.5 text-[11.5px] font-bold leading-none max-sm:text-[10px] max-sm:font-normal">
          <Map className="size-3.5 shrink-0 text-brand-green" aria-hidden="true" />
          {t("Your trail")}
        </span>
      </Link>
    </Button>
  );

  // Mobile-only league chip (in place of the challenge, which stays on desktop):
  // the header strip with the league is hidden on phones.
  const leagueButton = (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="h-8 min-w-0 px-2 text-sidebar-foreground hover:bg-sidebar-accent max-sm:min-w-max max-sm:flex-auto max-sm:justify-center max-sm:gap-1 max-sm:rounded-full max-sm:border max-sm:border-sidebar-foreground/40 max-sm:px-1.5 max-sm:text-[10px] max-sm:whitespace-nowrap sm:h-9"
    >
      <Link to="/league">
        <span className="flex items-center gap-1.5 text-[11.5px] font-bold leading-none max-sm:text-[10px] max-sm:font-normal">
          <Medal className="size-3.5 shrink-0 text-amber-400" aria-hidden="true" />
          {league.joined
            ? league.total > 1 && league.rank
              ? `#${league.rank} · ${league.xp} XP`
              : `${league.xp} XP`
            : t("Weekly league")}
        </span>
      </Link>
    </Button>
  );

  if (compact) {
    return (
      <section
        className="dashboard-focus relative h-full min-w-0 overflow-hidden rounded-lg border-x border-b border-border border-t-0 bg-card text-sidebar-foreground shadow-[var(--shadow-soft)] max-sm:mt-1.5 sm:border-t sm:border-border"
        aria-label={t("Your next step")}
      >
        <div className="dashboard-evo-grid flex h-full min-w-0 flex-col sm:grid sm:grid-cols-[14rem_minmax(0,1fr)]">
          <div
            className="relative aspect-[1400/415] h-auto w-full flex-none self-stretch overflow-hidden bg-sidebar sm:aspect-auto sm:min-h-[13.5rem] sm:h-auto sm:bg-transparent lg:min-h-[10.5rem] xl:min-h-0"
            aria-hidden="true"
          >
            <div className="absolute inset-0 overflow-hidden sm:inset-3 sm:flex sm:items-center sm:overflow-visible">
              {/* The owner's whole banner, uncropped: the frame has the image's own
                  proportions, so nothing is cut. */}
              <img
                src={evoDashboardMobileFull}
                alt=""
                width={1400}
                height={415}
                className="absolute inset-0 block size-full object-cover sm:hidden"
              />
              <img
                src={evoDashboardApproved.url}
                alt=""
                width={1536}
                height={1024}
                className="hidden h-auto w-full sm:block sm:h-auto sm:w-auto sm:max-h-full sm:max-w-full sm:rounded-lg sm:object-contain"
              />
            </div>
          </div>

          {/* Mobile: the content sits centred in the card's free height instead
              of pressed against the banner. */}
          <div className="relative z-10 flex min-w-0 flex-col px-3 py-2 max-sm:flex-1 max-sm:justify-center max-sm:py-4 sm:justify-center sm:py-4 sm:pl-6 sm:pr-5 xl:order-2 xl:pl-5 xl:pr-4 min-[1440px]:pl-8 min-[1440px]:pr-6">
            <div className="flex items-center justify-between gap-3 sm:block">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase text-brand-green sm:hidden">
                  EVO · {t("Your AI Learning Coach")}
                </p>
                <div className="mt-2 sm:mt-0">
                  {/* No level badge here: next to the priority it read as part of it,
                      and the level already shows in the reason line. */}
                  <p className="whitespace-nowrap text-[10px] font-semibold leading-none text-sidebar-foreground/75 sm:text-xs sm:font-bold sm:tracking-[0.08em] sm:text-brand-green">
                    {t("TODAY'S PRIORITY")}
                  </p>
                  <h2 className="mt-2 flex min-w-0 items-center gap-2 break-words text-lg font-bold leading-tight text-sidebar-foreground sm:mt-2 sm:text-2xl xl:text-3xl">
                    <PriorityIcon
                      className="size-5 shrink-0 text-warning sm:size-[1.375rem]"
                      aria-hidden="true"
                    />
                    <span>{skillLabel}</span>
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
            {/* Mobile-only action row: Quick Win + weekly league + Your trail. */}
            <div className="mt-2.5 flex flex-nowrap items-center gap-1.5 sm:hidden">
              {quickWinButton}
              {leagueButton}
              {mapButton}
            </div>
            {/* Mobile-only: one line with the real reason for today's priority,
                then the word reviews that are due (otherwise only in the bell). */}
            <p className="mt-2.5 flex items-start gap-2 text-xs leading-snug text-sidebar-foreground/85 sm:hidden">
              <Lightbulb
                className="size-4 shrink-0 text-warning"
                strokeWidth={2.5}
                aria-hidden="true"
              />
              <span className="min-w-0">{priorityText}</span>
            </p>
            {dueWordReviews > 0 && (
              <Link
                to="/vocabulary"
                className="mt-2 flex items-center gap-2 rounded-lg border border-brand-green/30 bg-brand-green/[0.07] px-2.5 py-2 text-xs font-semibold text-sidebar-foreground sm:hidden"
              >
                <RotateCcw className="size-4 shrink-0 text-brand-green" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">
                  {dueWordReviews === 1
                    ? t("Review 1 word")
                    : t("Review {n} words").replace("{n}", String(dueWordReviews))}
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            )}
            <p className="mt-1 hidden line-clamp-2 text-xs text-sidebar-foreground/70 sm:mt-3 sm:block sm:text-sm">
              {t(NEXT_STEP_REASON_TEXT[data.reason])}
            </p>
            <p className="mt-2 hidden line-clamp-1 text-sm text-sidebar-foreground/85 sm:mt-1 sm:block">
              {t("How to practice")}: <span className="font-semibold">{data.activity.title}</span>
            </p>
            {mainAvailable && (
              <Button
                asChild
                className="mt-4 hidden w-full bg-brand-green text-sidebar [word-spacing:0.1em] hover:bg-brand-green/90 sm:mt-5 sm:flex sm:h-10 sm:w-fit sm:rounded-xl sm:px-5 sm:text-sm sm:font-bold"
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

          <aside className="relative z-10 hidden min-w-0 sm:col-span-2 sm:block sm:border-t sm:border-border sm:px-5 sm:py-4 xl:order-3 xl:py-3 xl:col-span-1 xl:flex xl:flex-col xl:self-stretch xl:border-l xl:border-t-0">
            <div className="flex items-center gap-2">
              <Lightbulb className="size-[1.375rem] text-warning" aria-hidden="true" />
              <h3 className="font-semibold text-sidebar-foreground">{t("Why this matters now")}</h3>
            </div>
            {/* One sentence with the reason; the main column already says what
                happened ("You have not practiced this skill yet"). */}
            <p className="mt-2 text-[13px] leading-snug text-sidebar-foreground/80">
              {priorityText}
            </p>
            {(quickWinButton || challengeButton) && (
              <div className="mt-3 hidden border-t border-border pt-3 sm:block xl:mt-auto">
                {/* A short heading tells the student what these two extras are. */}
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-green">
                  {t("Extra practice")}
                </p>
                <p className="mt-0.5 text-xs text-sidebar-foreground/70">
                  {t("Two short options beyond today's priority.")}
                </p>
                {/* Stacked, one full-width option per row, each with its description. */}
                <div className="mt-2 grid gap-2 [&>*]:justify-start [&>*]:rounded-lg [&>*]:border [&>*]:border-border [&>*]:bg-secondary/30 sm:[&>*]:px-3 sm:[&>*]:py-2.5">
                  {quickWinButton}
                  {challengeButton}
                </div>
              </div>
            )}
          </aside>
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
                {t("How to practice")}: <span className="font-medium">{data.activity.title}</span>
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
                          — {t("Mark Correct or Incorrect")}
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
