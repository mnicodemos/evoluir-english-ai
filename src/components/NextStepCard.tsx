import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
  CalendarCheck2,
  CalendarDays,
  Medal,
  MessageSquareText,
  Mic,
  PenLine,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EvoDailyReflection } from "@/components/EvoDailyReflection";
import { EvoGuide } from "@/components/EvoGuide";

import { Skeleton } from "@/components/ui/skeleton";
import { useActivityIndicators } from "@/hooks/useActivityIndicators";
import { useDueReviewState } from "@/hooks/useDueReviewCount";
import { useMistakesDue } from "@/hooks/useMistakesDue";
import { useNextStep } from "@/hooks/useNextStep";
import { useProfile } from "@/hooks/useProfile";
import { useTodayActivities } from "@/components/DailyGoalCard";
import {
  dailyChallengeGoal,
  pronunciationQuickWinDone,
  practiceXpLabel,
} from "@/lib/dailyChallenge";
import {
  LEAGUE_MEDAL_TEXT,
  leagueMedal,
  useWeeklyLeagueStanding,
} from "@/components/WeeklyLeagueSummary";
import { dashboardActionAvailable } from "@/lib/activityIndicators";
import {
  NEXT_STEP_ACTION_TEXT,
  NEXT_STEP_PRIORITY_TEXT,
  NEXT_STEP_REASON_TEXT,
  NEXT_STEP_SITUATION_TEXT,
  NEXT_STEP_SKILL_TEXT,
  NEXT_STEP_WHY_NOW_TEXT,
} from "@/lib/pedagogy/nextStep";
import { loadStudyPlan } from "@/lib/studyPlan.functions";

import { SKILL_QUEST_ACTION_TEXT } from "@/lib/pedagogy/skillQuest";

import { findLevel } from "@/lib/level";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { DoneSeal } from "@/components/DoneSeal";

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
  const { data: todayActivities = [], isFetched: todayFetched } = useTodayActivities(profile?.id);
  const { data: studyPlan, isFetched: planFetched } = useQuery({
    queryKey: ["study-plan", profile?.id],
    queryFn: () => loadStudyPlan({ data: undefined }),
    enabled: !!profile?.id,
    staleTime: 60 * 1000,
  });
  const weekDone = !!studyPlan && studyPlan.plan.nextIndex === null;
  // Vocabulary words whose review date has arrived (same count as the bell).
  const activityIndicators = useActivityIndicators();
  // Reviews waiting today: on phones they take the Quick Win's place when there
  // is no Quick Win (user request, 2026-10-24).
  const { count: wordsDue, ready: wordsDueReady } = useDueReviewState(profile?.id);
  const { data: mistakesDue = 0, isFetched: mistakesFetched } = useMistakesDue(profile?.id);
  // Until today's practice has loaded, the buttons show right away instead of
  // popping in seconds later; they leave only once that activity is known done.
  const actionAvailable = (to: string, indicators: typeof activityIndicators) =>
    !indicators.ready || dashboardActionAvailable(to, indicators);
  const { data, isLoading, isError, isFetching, isPlaceholderData, refetch } = useNextStep();

  // Phones' pill row waits for everything it reads (user report, 2026-10-25:
  // a pill showed, then another replaced it): the Quick Win from the fresh
  // answer, not the one kept from the last visit, today's activities, due
  // words and mistakes, the league and the week, at most 4 s; until then
  // three pill-shaped placeholders hold the place, so the pills arrive once.
  const [pillWaitOver, setPillWaitOver] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setPillWaitOver(true), 4000);
    return () => window.clearTimeout(timer);
  }, []);
  const pillsReady =
    pillWaitOver ||
    (!isPlaceholderData &&
      activityIndicators.ready &&
      todayFetched &&
      wordsDueReady &&
      mistakesFetched &&
      league.loaded &&
      planFetched);

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

  // A new student's priority is the first conversation with EVO (buildNextStep).
  const skillLabel = data.prioritySkill
    ? t(NEXT_STEP_SKILL_TEXT[data.prioritySkill] ?? data.prioritySkill)
    : data.reason === "no_data"
      ? t("Speaking")
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
  // No measured level yet (a new student): the profile's level names it, so
  // "in your {level} journey" never reads "in your your current level journey".
  const levelSource = data.insight?.cefrLevel ?? profile?.level ?? null;
  const cefrLevel = levelSource ? findLevel(levelSource).cefr.replace(/^CEFR /, "") : null;
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
  const mainAvailable = actionAvailable(data.activity.to, activityIndicators);
  const quickWinAvailable = quickWin
    ? actionAvailable(quickWin.activity.to, activityIndicators) &&
      !(quickWin.cta === "Say 5 words out loud" && pronunciationQuickWinDone(todayActivities))
    : false;
  // The challenge has a goal for the day (user request): it shows the progress
  // and leaves once the goal is reached (dailyChallengeGoal).
  const challengeGoal = data.quest
    ? dailyChallengeGoal(data.quest.resource.to, todayActivities)
    : null;
  const challengeAvailable = data.quest
    ? actionAvailable(data.quest.resource.to, activityIndicators) && !challengeGoal?.reached
    : false;
  const challengeProgress = challengeGoal
    ? ` · ${challengeGoal.done}/${challengeGoal.target} ${t(challengeGoal.unit)}`
    : "";
  // Extra practice earns the weekly league's XP (user request): each option
  // shows what its activity is worth.
  const xpChip = (destination: string) => {
    const label = practiceXpLabel(destination);
    return label ? (
      <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold leading-none text-amber-400 max-sm:hidden">
        {label}
      </span>
    ) : null;
  };
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
        className="h-8 min-w-0 px-2 max-sm:text-[10px] text-sidebar-foreground hover:bg-sidebar-accent max-sm:min-w-max max-sm:flex-auto max-sm:justify-center max-sm:gap-1 max-sm:h-7 max-sm:rounded-full max-sm:border max-sm:border-white/10 max-sm:bg-white/[0.05] max-sm:px-1.5 max-sm:whitespace-nowrap sm:h-auto sm:min-h-0 sm:flex-1 sm:items-start sm:rounded-lg sm:px-2 sm:py-1.5 xl:py-1 sm:whitespace-normal sm:text-left"
      >
        {quickWin.activity.params ? (
          <Link to="/learning/$lessonId" params={quickWin.activity.params}>
            <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
              <span className="flex items-center gap-1.5 text-[11.5px] font-bold leading-none max-sm:text-[10px] max-sm:font-medium sm:text-[13px]">
                {quickWinIcon} {t("Quick Win")} {xpChip(quickWin.activity.to)}
              </span>
              <span className="hidden w-full text-left text-[9.5px] leading-tight text-sidebar-foreground/70 sm:block sm:text-xs sm:font-normal">
                {t(quickWin.cta)} · {t(quickWin.activity.title)}
              </span>
            </span>
          </Link>
        ) : (
          <Link to={quickWin.activity.to}>
            <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
              <span className="flex items-center gap-1.5 text-[11.5px] font-bold leading-none max-sm:text-[10px] max-sm:font-medium sm:text-[13px]">
                {quickWinIcon} {t("Quick Win")} {xpChip(quickWin.activity.to)}
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
        className="h-8 min-w-0 px-2 max-sm:text-[10px] text-sidebar-foreground hover:bg-sidebar-accent max-sm:min-w-max max-sm:flex-auto max-sm:justify-center max-sm:gap-1 max-sm:h-7 max-sm:rounded-full max-sm:border max-sm:border-white/10 max-sm:bg-white/[0.05] max-sm:px-1.5 max-sm:whitespace-nowrap sm:h-auto sm:min-h-0 sm:flex-1 sm:items-start sm:rounded-lg sm:px-2 sm:py-1.5 xl:py-1 sm:whitespace-normal sm:text-left"
      >
        {data.quest.resource.params ? (
          <Link to="/learning/$lessonId" params={data.quest.resource.params}>
            <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
              <span className="flex items-center gap-1.5 text-[11.5px] font-bold leading-none max-sm:text-[10px] max-sm:font-medium sm:text-[13px]">
                {challengeIcon} {t("Take the challenge")} {xpChip(data.quest.resource.to)}
              </span>
              <span className="hidden w-full text-left text-[9.5px] leading-tight text-sidebar-foreground/70 sm:block sm:text-xs sm:font-normal">
                {questDetail}
                {challengeProgress}
              </span>
            </span>
          </Link>
        ) : (
          <Link to={data.quest.resource.to}>
            <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
              <span className="flex items-center gap-1.5 text-[11.5px] font-bold leading-none max-sm:text-[10px] max-sm:font-medium sm:text-[13px]">
                {challengeIcon} {t("Take the challenge")} {xpChip(data.quest.resource.to)}
              </span>
              <span className="hidden w-full text-left text-[9.5px] leading-tight text-sidebar-foreground/70 sm:block sm:text-xs sm:font-normal">
                {questDetail}
                {challengeProgress}
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
      className="h-8 min-w-0 px-2 text-sidebar-foreground hover:bg-sidebar-accent max-sm:min-w-max max-sm:flex-auto max-sm:justify-center max-sm:gap-1 max-sm:h-7 max-sm:rounded-full max-sm:border max-sm:border-white/10 max-sm:bg-white/[0.05] max-sm:px-1.5 max-sm:text-[10px] max-sm:whitespace-nowrap sm:h-9"
    >
      <Link to="/study-plan">
        <span className="flex items-center gap-1.5 text-[11.5px] font-bold leading-none max-sm:text-[10px] max-sm:font-medium">
          {weekDone ? (
            <CalendarCheck2
              className="size-3.5 shrink-0 text-brand-green"
              strokeWidth={2.2}
              aria-hidden="true"
            />
          ) : (
            <CalendarDays
              className="size-3.5 shrink-0 text-pink-400"
              strokeWidth={2.2}
              aria-hidden="true"
            />
          )}
          {t("Your week")}
        </span>
      </Link>
    </Button>
  );

  // Mobile-only league chip (in place of the challenge, which stays on desktop):
  // the header strip with the league is hidden on phones.
  // Phones: with no Quick Win, a review fills its place, the same order as
  // Keep improving: due words, due mistakes, then EVO's first review
  // suggestion still open today (never where Practice now already goes).
  const reviewSuggestion = (data.reviews ?? []).find(
    (item) =>
      actionAvailable(item.resource.to, activityIndicators) &&
      item.resource.to !== data.activity.to,
  );
  const mobileReview: { to: string; params?: { lessonId: string }; label: string } | null =
    wordsDue > 0
      ? { to: "/vocabulary", label: t("Review words") }
      : mistakesDue > 0
        ? { to: "/mistakes", label: t("Review mistakes") }
        : reviewSuggestion
          ? {
              to: reviewSuggestion.resource.to,
              ...(reviewSuggestion.resource.params
                ? { params: reviewSuggestion.resource.params }
                : {}),
              label: `${t("Review")}: ${t(
                NEXT_STEP_SKILL_TEXT[reviewSuggestion.skill] ?? reviewSuggestion.skill,
              )}`,
            }
          : null;
  const mobileReviewButton =
    !quickWinButton && mobileReview ? (
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="h-8 min-w-0 px-2 text-sidebar-foreground hover:bg-sidebar-accent max-sm:min-w-max max-sm:flex-auto max-sm:justify-center max-sm:gap-1 max-sm:h-7 max-sm:rounded-full max-sm:border max-sm:border-white/10 max-sm:bg-white/[0.05] max-sm:px-1.5 max-sm:text-[10px] max-sm:whitespace-nowrap sm:hidden"
      >
        {mobileReview.params ? (
          <Link to="/learning/$lessonId" params={mobileReview.params}>
            <span className="flex items-center gap-1.5 font-medium leading-none">
              <RefreshCw className="size-3.5 shrink-0 text-sky-300" aria-hidden="true" />
              {mobileReview.label}
            </span>
          </Link>
        ) : (
          <Link to={mobileReview.to}>
            <span className="flex items-center gap-1.5 font-medium leading-none">
              <RefreshCw className="size-3.5 shrink-0 text-sky-300" aria-hidden="true" />
              {mobileReview.label}
            </span>
          </Link>
        )}
      </Button>
    ) : null;
  const leagueButton = (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="h-8 min-w-0 px-2 text-sidebar-foreground hover:bg-sidebar-accent max-sm:min-w-max max-sm:flex-auto max-sm:justify-center max-sm:gap-1 max-sm:h-7 max-sm:rounded-full max-sm:border max-sm:border-white/10 max-sm:bg-white/[0.05] max-sm:px-1.5 max-sm:text-[10px] max-sm:whitespace-nowrap sm:h-9"
    >
      <Link to="/league">
        <span className="flex items-center gap-1.5 text-[11.5px] font-bold leading-none max-sm:text-[10px] max-sm:font-medium">
          <Medal
            className={`size-3.5 shrink-0 ${LEAGUE_MEDAL_TEXT[leagueMedal(league)]}`}
            aria-hidden="true"
          />
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
        className="dashboard-focus relative h-full min-w-0 overflow-hidden rounded-lg border border-border bg-card text-sidebar-foreground shadow-[var(--shadow-soft)] max-sm:-mt-1 max-sm:h-[calc(100%+0.25rem)]"
        aria-label={t("Your next step")}
      >
        <div className="dashboard-evo-grid flex h-full min-w-0 flex-col sm:grid sm:grid-cols-[14rem_minmax(0,1fr)]">
          <div
            className="relative h-auto w-full flex-none self-stretch overflow-hidden bg-transparent p-2.5 pb-0 sm:min-h-[13.5rem] sm:h-auto sm:p-0 lg:min-h-[10.5rem] xl:min-h-0"
            aria-hidden="true"
          >
            {/* Mobile: the owner's whole banner, uncropped, inset from the card
                edges with rounded corners — the same look as the desktop image. */}
            <img
              src={evoDashboardMobileFull}
              alt=""
              width={1400}
              height={415}
              className="block h-auto w-full rounded-lg sm:hidden"
            />
            <div className="absolute inset-0 hidden overflow-hidden sm:inset-3 sm:flex sm:items-center sm:overflow-visible">
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
              of pressed against the banner. Below xl: centred beside the image,
              with room for the scope badge. From xl: top-aligned, the EVO label
              level with "Why this matters now" (same 12 px top padding and 22 px
              icon row; user request). */}
          <div className="relative z-10 flex min-w-0 flex-col gap-2 px-3 py-2 max-sm:flex-1 max-sm:justify-center max-sm:gap-2 max-sm:py-2 sm:justify-center sm:pb-4 sm:pt-10 xl:justify-start xl:pb-6 xl:pt-3 sm:pl-6 sm:pr-5 xl:order-2 xl:pl-5 xl:pr-4 min-[1440px]:pl-8 min-[1440px]:pr-6">
            {/* Top-right of the priority column below xl; from xl it moves to the
                "Why this matters now" column (see the aside). */}
            {/* Coach label: white, with the AI icon in the brand colour (the
                AI Teacher's sparkles; a red "!" read as an error, user
                request). Its own full line on phones, with Practice now beside
                the priority below; desktop matches "Why this matters now". */}
            <p className="flex items-center gap-1.5 font-display text-sm font-semibold leading-tight text-sidebar-foreground sm:gap-2 sm:text-base sm:leading-snug">
              <Sparkles
                className="size-4 shrink-0 text-brand-green sm:size-[1.375rem]"
                strokeWidth={2.4}
                aria-hidden="true"
              />
              <span className="truncate">EVO · {t("Your AI Learning Coach")}</span>
            </p>
            {/* From xl the priority block sits at the bottom: Practice now ends
                level with the bottom of the challenge's last text line in the Extra
                practice column (24 px from the card edge: the aside's 12 px
                padding, the row border and its 10 px padding; user request);
                the coach label stays at the top. */}
            {/* Phones: the same padding above the coach label and below the last
                line, so EVO sits as far from the image as the reason line from the
                card's bottom, with a little more room under the label (user request). */}
            <div className="mt-1 flex items-center justify-between gap-3 sm:mt-2 sm:block xl:mt-auto">
              <div className="min-w-0 flex-1">
                <div>
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
              {/* Phones (user request): lower and wider, beside the priority, so
                  the coach label above keeps its whole line. */}
              {mainAvailable && (
                <Button
                  asChild
                  className="h-9 w-[54%] shrink-0 self-center rounded-xl bg-brand-green px-4 text-sm font-bold text-sidebar [word-spacing:0.1em] hover:bg-brand-green/90 sm:hidden"
                >
                  {data.activity.params ? (
                    <Link to="/learning/$lessonId" params={data.activity.params}>
                      <PriorityIcon className="size-4 shrink-0" aria-hidden="true" />
                      {t("Practice now")}
                      <ChevronRight strokeWidth={3} aria-hidden="true" />
                    </Link>
                  ) : (
                    <Link to={data.activity.to}>
                      <PriorityIcon className="size-4 shrink-0" aria-hidden="true" />
                      {t("Practice now")}
                      <ChevronRight strokeWidth={3} aria-hidden="true" />
                    </Link>
                  )}
                </Button>
              )}
            </div>
            {/* Mobile-only action row: Quick Win + weekly league + Your trail. */}
            {/* Glass pills (user request: more sophisticated than outlined ones).
                The priority, pills and reason line breathe evenly through the
                card's free height instead of crowding under the EVO label
                (user report). */}
            <div className="mt-1 flex flex-nowrap items-center gap-1.5 sm:hidden">
              {pillsReady ? (
                <>
                  {quickWinButton ?? mobileReviewButton}
                  {leagueButton}
                  {mapButton}
                </>
              ) : (
                [0, 1, 2].map((key) => (
                  <span
                    key={key}
                    aria-hidden="true"
                    className="h-7 flex-auto animate-pulse rounded-full border border-white/10 bg-white/[0.05]"
                  />
                ))
              )}
            </div>
            {/* Mobile-only: one line with the real reason for today's priority.
                Due word reviews live in the bell; a box here was clipped by the
                card and showed only as a green line. */}
            <p className="mt-1 flex items-center gap-1.5 text-[11px] leading-snug text-sidebar-foreground/75 sm:hidden">
              <Lightbulb
                className="size-3.5 shrink-0 text-warning"
                strokeWidth={2.5}
                aria-hidden="true"
              />
              <span className="min-w-0 truncate">{priorityText}</span>
            </p>
            <p className="mt-1 hidden line-clamp-2 text-xs text-sidebar-foreground/70 sm:mt-3 sm:block sm:text-sm">
              {t(NEXT_STEP_REASON_TEXT[data.reason])}
            </p>
            <p className="mt-2 hidden line-clamp-1 text-sm text-sidebar-foreground/85 sm:mt-1 sm:block">
              {t("How to practice")}: <span className="font-semibold">{data.activity.title}</span>
            </p>
            {mainAvailable && (
              <Button
                asChild
                className="mt-2 hidden w-full max-w-full shrink-0 bg-brand-green text-sidebar [word-spacing:0.1em] hover:bg-brand-green/90 sm:mt-2 sm:flex sm:h-10 sm:w-fit sm:rounded-xl sm:px-5 sm:text-sm sm:font-bold xl:w-full xl:max-w-64"
              >
                {data.activity.params ? (
                  <Link to="/learning/$lessonId" params={data.activity.params}>
                    <PriorityIcon className="size-4 shrink-0" aria-hidden="true" />
                    {t("Practice now")}
                    <ChevronRight strokeWidth={3} aria-hidden="true" />
                  </Link>
                ) : (
                  <Link to={data.activity.to}>
                    <PriorityIcon className="size-4 shrink-0" aria-hidden="true" />
                    {t("Practice now")}
                    <ChevronRight strokeWidth={3} aria-hidden="true" />
                  </Link>
                )}
              </Button>
            )}
          </div>

          <aside className="relative z-10 hidden min-w-0 sm:col-span-2 sm:block sm:border-t sm:border-border sm:px-5 sm:py-4 xl:order-3 xl:py-3 xl:col-span-1 xl:flex xl:flex-col xl:self-stretch xl:border-l xl:border-t-0">
            {/* Top-right corner of the card (user request): level with the weekday
                badge of Today's Progress (its header centres a 22 px icon inside
                the card's padding) and in line with Keep improving's badge below
                (16 px from the card's right edge). */}
            <div className="flex items-center gap-2 xl:pr-24">
              <Lightbulb className="size-[1.375rem] text-warning" aria-hidden="true" />
              <h3 className="whitespace-nowrap text-[13px] font-semibold tracking-tight text-sidebar-foreground">
                {t("Why this matters now")}
              </h3>
            </div>
            {/* One sentence with the reason; the main column already says what
                happened ("You have not practiced this skill yet"). */}
            {/* Wraps before the Continuous badge's left edge (user request). */}
            {/* At most two lines, so it never runs into Extra practice (user request). */}
            <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-sidebar-foreground/80 xl:pr-24">
              {priorityText}
            </p>
            {/* Always there (user request): when today's extras are done the
                block stays with a done state, like Keep improving, instead of
                leaving a hole in the card. */}
            <div className="mt-3 hidden sm:block xl:mt-auto">
              {/* A short heading tells the student what these two extras are. */}
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-green">
                {t("Extra practice")}
              </p>
              {quickWinButton || challengeButton ? (
                <>
                  <p className="mt-0.5 text-xs text-sidebar-foreground/70">
                    {t("Two short options beyond today's priority.")}
                  </p>
                  {/* Stacked, one full-width option per row, each with its description. */}
                  <div className="mt-2 grid gap-2 [&>*]:justify-start [&>*]:rounded-lg [&>*]:border [&>*]:border-border [&>*]:bg-secondary/30 sm:[&>*]:px-3 sm:[&>*]:py-2.5">
                    {quickWinButton}
                    {challengeButton}
                    {!(quickWinButton && challengeButton) && (
                      // One option left: the other row says it is done.
                      <p className="flex min-h-12 items-center justify-center gap-2 !border-dashed !bg-transparent text-xs text-muted-foreground">
                        <DoneSeal size="sm" />
                        {t("Nothing else pending right now.")}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="mt-2 flex min-h-[7.5rem] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border px-3 text-center">
                  <DoneSeal />
                  <p className="text-sm font-semibold">{t("Extra practice done for today")}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("New options appear tomorrow.")}
                  </p>
                </div>
              )}
            </div>
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
                    <PriorityIcon className="size-4 shrink-0" aria-hidden="true" />
                    {t("Practice now")}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              ) : (
                <Button asChild className="mt-3">
                  <Link to={data.activity.to}>
                    <PriorityIcon className="size-4 shrink-0" aria-hidden="true" />
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
