import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Bolt,
  CalendarCheck2,
  ChartLine,
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  Flame,
  GraduationCap,
  Headphones,
  MessageSquareText,
  Minus,
  PenLine,
  RotateCcw,
  Sparkles,
  SpellCheck,
  TriangleAlert,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { AppShell } from "@/components/AppShell";
import { useMinutesToday } from "@/components/DailyGoalCard";
import { EvoDailyReflection } from "@/components/EvoDailyReflection";
import { LevelCard } from "@/components/LevelCard";
import { getLeague, getNextLeague } from "@/components/LeagueBadge";
import { PathProgressCard } from "@/components/PathProgressCard";
import { NextStepCard } from "@/components/NextStepCard";
import { SmartReviewCard } from "@/components/SmartReviewCard";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WeeklyFrequency } from "@/components/WeeklyFrequency";

import { useActivityIndicators } from "@/hooks/useActivityIndicators";
import { useDueReviewCount } from "@/hooks/useDueReviewCount";
import { loadStudyPlan } from "@/lib/studyPlan.functions";
import type { StudyPlanDay } from "@/lib/studyPlan";
import { effectiveStreak, useProfile } from "@/hooks/useProfile";
import { useStudySnapshot } from "@/hooks/useStudyContext";
import { WeatherTalk } from "@/components/WeatherTalk";
import { FirstWeekGuide } from "@/components/FirstWeekGuide";
import { WeeklyLeagueSummary } from "@/components/WeeklyLeagueSummary";
import { DashboardHeaderStat } from "@/components/DashboardHeaderStat";
import { supabase } from "@/integrations/supabase/client";
import { MISTAKE_MASTERED_STEP } from "@/lib/mistakeReview";
import { graphiteIconButtonClass, graphitePanelClass } from "@/lib/surfaces";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · Dashboard" },
      {
        name: "description",
        content: "Your daily English plan, streak and skill scores in one place.",
      },
      { property: "og:title", content: "Evoluir+ English AI · Dashboard" },
      { property: "og:description", content: "Your daily English plan, streak and skill scores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

type DashboardNotificationsProps = {
  indicators: ReturnType<typeof useActivityIndicators>;
  /** Vocabulary reviews due today (already capped at the daily review limit). */
  reviewCount: number;
  /** The study plan's day to do now (today or a missed day), if any. */
  planTask: StudyPlanDay | null | undefined;
  /** "My mistakes" corrections whose review date has arrived. */
  mistakesDue: number;
  /** Minutes still missing for today's goal (0 when reached). */
  goalMinutesLeft: number;
  translate: (label: string) => string;
  placement: "mobile" | "desktop";
};

function DashboardNotifications({
  indicators,
  reviewCount,
  planTask,
  mistakesDue,
  goalMinutesLeft,
  translate,
  placement,
}: DashboardNotificationsProps) {
  // Everything the student still has to do, most immediate first: the plan's
  // day, today's goal, due reviews, then new content in each area.
  const items = [
    {
      id: "plan",
      to: "/study-plan",
      label: planTask
        ? `${translate(planTask.status === "missed" ? "Catch up" : "Today in your plan")}: ${planTask.title}`
        : "",
      icon: CalendarCheck2,
      visible: !!planTask && (planTask.status === "today" || planTask.status === "missed"),
    },
    {
      id: "goal",
      to: "/study-plan",
      label: `${translate("Minutes left for today's goal")}: ${goalMinutesLeft}`,
      icon: Clock,
      visible: goalMinutesLeft > 0,
    },
    {
      id: "mistakes",
      to: "/mistakes",
      label: `${translate("Mistakes to review")}: ${mistakesDue}`,
      icon: SpellCheck,
      visible: mistakesDue > 0,
    },
    {
      id: "review",
      to: "/vocabulary",
      label: `${translate("Words to review")}: ${reviewCount}`,
      icon: RotateCcw,
      visible: reviewCount > 0,
    },
    {
      id: "listening",
      to: "/listening",
      label: "New listening activity",
      icon: Headphones,
      visible: indicators.listening,
    },
    {
      id: "writing",
      to: "/writing",
      label: "New writing activity",
      icon: PenLine,
      visible: indicators.writing,
    },
    {
      id: "vocabulary",
      to: "/vocabulary",
      label: "New vocabulary activity",
      icon: BookOpen,
      visible: indicators.vocabulary,
    },
  ] as const;
  const activeItems = items.filter((item) => item.visible);
  const hasNotifications = activeItems.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={translate("Open notifications")}
          className={
            placement === "mobile"
              ? `relative size-8 shrink-0 rounded-full ${graphiteIconButtonClass}`
              : "relative size-7 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
          }
        >
          <Bell className={placement === "mobile" ? "size-[1.15rem]" : "size-4"} />
          {hasNotifications && (
            <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-brand-green ring-2 ring-background">
              <span className="sr-only">{translate("New activities available")}</span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={placement === "mobile" ? "end" : "start"}
        sideOffset={8}
        className={`dashboard-shell dark w-[min(20rem,calc(100vw-1.5rem))] p-2 ${graphitePanelClass}`}
      >
        <p className="px-2 py-1.5 font-display text-sm font-semibold">
          {translate("Notifications")}
        </p>
        {hasNotifications ? (
          <div className="grid gap-1">
            {activeItems.map((item) => (
              <Link
                key={item.id}
                to={item.to}
                className="grid min-h-11 grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 rounded-md px-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <span className="grid size-8 place-items-center rounded-full bg-brand-green/15 text-brand-green">
                  <item.icon className="size-4" aria-hidden="true" />
                </span>
                <span>{translate(item.label)}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            {translate("No new activities right now")}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

const PLAN_SKILL_LABELS: Record<string, string> = {
  grammar: "Grammar",
  listening: "Listening",
  speaking: "Speaking",
  vocabulary: "Vocabulary",
  writing: "Writing",
  reading: "Reading",
};

/** Header cell: the study plan's day to do now (today, catch up or next). */
function PlanTodaySummary({
  next,
  weekDone,
  translate,
}: {
  next: StudyPlanDay | null | undefined;
  weekDone: boolean;
  translate: (label: string) => string;
}) {
  const label = weekDone
    ? translate("Week plan complete")
    : !next
      ? translate("Your study plan")
      : next.status === "today"
        ? translate("Today in your plan")
        : next.status === "missed"
          ? translate("Catch up")
          : translate("Next in your plan");
  return (
    <DashboardHeaderStat
      icon={<CalendarCheck2 className="size-6" strokeWidth={2.2} />}
      tone="green"
      label={label}
      value={
        weekDone
          ? translate("Every planned day is done")
          : (next?.title ?? translate("See your week"))
      }
      detail={
        next && !weekDone
          ? `${translate(PLAN_SKILL_LABELS[next.skill] ?? next.skill)} · ${translate(next.day)}`
          : null
      }
      to="/study-plan"
    />
  );
}

function Dashboard() {
  const { data: profile, isLoading } = useProfile();
  const navigate = useNavigate();
  const { data: snapshot } = useStudySnapshot();
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const indicators = useActivityIndicators();
  const reviewCount = useDueReviewCount(profile?.id);
  const { data: mistakesDue = 0 } = useQuery({
    queryKey: ["mistakes-due", profile?.id],
    enabled: !!profile?.id,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { count } = await supabase
        .from("learning_errors")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile!.id)
        .lt("review_step", MISTAKE_MASTERED_STEP)
        .lte("next_review_at", new Date().toISOString());
      return count ?? 0;
    },
  });
  // Same query as the Study Plan page, so opening the plan reuses it.
  const { data: studyPlan } = useQuery({
    queryKey: ["study-plan", profile?.id],
    queryFn: () => loadStudyPlan(),
    enabled: !!profile?.id,
    staleTime: 5 * 60 * 1000,
  });
  const planNext =
    studyPlan?.plan.nextIndex != null ? studyPlan.plan.days[studyPlan.plan.nextIndex] : null;
  const streakDays = profile ? effectiveStreak(profile) : 0;
  const nextLeague = profile ? getNextLeague(streakDays) : null;
  const { data: minutesToday = 0 } = useMinutesToday(profile?.id);

  useEffect(() => {
    if (profile && !profile.onboarding_completed) navigate({ to: "/onboarding", replace: true });
  }, [profile, navigate]);

  const quickAccess = [
    {
      to: "/learning",
      label: "Learning Center",
      subtitle: "Continue your lessons",
      icon: GraduationCap,
      mobileOrder: "order-1 lg:order-1",
    },
    {
      to: "/teacher",
      label: "AI Teacher",
      subtitle: "Ask questions anytime",
      icon: Sparkles,
      mobileOrder: "order-2 lg:order-2",
    },
    {
      to: "/coach",
      label: "AI Speaking",
      subtitle: "Practice conversations",
      icon: MessageSquareText,
      mobileOrder: "order-3 lg:order-3",
    },
    {
      to: "/vocabulary",
      label: "Vocabulary",
      subtitle: "Build your vocabulary",
      icon: BookOpen,
      mobileOrder: "order-6 lg:order-4",
    },
    {
      to: "/listening",
      label: "Listening",
      subtitle: "Train your listening",
      icon: Headphones,
      mobileOrder: "order-5 lg:order-5",
    },
    {
      to: "/writing",
      label: "Writing",
      subtitle: "Get AI feedback",
      icon: PenLine,
      mobileOrder: "order-4 lg:order-6",
    },
  ] as const;

  // Accuracy at or above this percentage shows the "done" icon; below it (but above 0) shows "attention".
  const ACCURACY_DONE_THRESHOLD = 70;

  type ProgressState = "done" | "attention" | "empty";
  const accuracyToday = snapshot?.todayQuizAverage ?? 0;
  const learningCards: { label: string; value: string; state: ProgressState }[] = [
    {
      label: "Lessons completed",
      value: `${snapshot?.todayLessonsCompleted ?? 0}`,
      state: (snapshot?.todayLessonsCompleted ?? 0) > 0 ? "done" : "empty",
    },
    {
      label: "Videos watched",
      value: `${snapshot?.todayVideosWatched ?? 0}`,
      state: (snapshot?.todayVideosWatched ?? 0) > 0 ? "done" : "empty",
    },
    {
      label: "Words mastered",
      value: `${snapshot?.todayVocabularyMastered ?? 0}`,
      state: (snapshot?.todayVocabularyMastered ?? 0) > 0 ? "done" : "empty",
    },
    {
      label: "Accuracy",
      value: `${accuracyToday}%`,
      state:
        accuracyToday >= ACCURACY_DONE_THRESHOLD
          ? "done"
          : accuracyToday > 0
            ? "attention"
            : "empty",
    },
  ];
  const hasProgressToday = learningCards.some((card) => card.state !== "empty");
  const minutesToGoal = Math.max(profile?.daily_minutes ?? 0, 0) - minutesToday;

  return (
    <AppShell dashboardLayout>
      {isLoading || !profile ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : (
        <div className="dashboard-one-screen flex h-full flex-col gap-[5px] lg:h-auto lg:grid lg:gap-[7px] xl:grid-rows-[4rem_7.59rem_minmax(16.45rem,min-content)_minmax(min-content,1fr)_minmax(5.625rem,0.62fr)] xl:gap-5">
          <header className="animate-rise min-w-0 xl:h-16">
            <EvoDailyReflection
              userId={profile.id}
              name={profile.name}
              placement="dashboard-header"
              desktopSubtitleTrailing={
                <div className="flex items-center gap-1">
                  <DashboardNotifications
                    indicators={indicators}
                    reviewCount={reviewCount}
                    planTask={planNext}
                    mistakesDue={mistakesDue}
                    goalMinutesLeft={Math.max(0, (profile.daily_minutes ?? 0) - minutesToday)}
                    translate={t}
                    placement="desktop"
                  />
                  <WeatherTalk translate={t} placement="desktop" />
                  <FirstWeekGuide profile={profile} placement="desktop" />
                </div>
              }
              mobileTrailing={
                <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                  <FirstWeekGuide profile={profile} placement="mobile" />
                  <span className="flex items-center gap-1">
                    <Flame
                      className="size-5 shrink-0 fill-current text-current"
                      style={{ color: getLeague(streakDays).from }}
                      strokeWidth={2.4}
                      aria-hidden="true"
                    />
                    <span className="font-display text-sm font-bold">
                      {streakDays} {t("days")}
                    </span>
                  </span>
                  <WeatherTalk translate={t} placement="mobile" />
                  <DashboardNotifications
                    indicators={indicators}
                    reviewCount={reviewCount}
                    planTask={planNext}
                    mistakesDue={mistakesDue}
                    goalMinutesLeft={Math.max(0, (profile.daily_minutes ?? 0) - minutesToday)}
                    translate={t}
                    placement="mobile"
                  />
                </div>
              }
            />
          </header>

          <div className="order-1 hidden card-soft min-w-0 grid-cols-3 overflow-hidden lg:order-none lg:grid lg:grid-cols-4 xl:h-[7.59rem]">
            <div className="col-span-3 border-b border-border lg:col-span-1 lg:border-b-0 lg:border-r">
              <LevelCard level={profile.level} maxLevel={profile.max_level} compact />
            </div>

            <div className="hidden min-w-0 border-l border-border sm:block lg:border-l-0">
              {/* One badge per cell: the streak keeps its flame; the streak league
                  name moves to the supporting line instead of a second shield. */}
              <DashboardHeaderStat
                icon={<Flame className="size-6 fill-current" strokeWidth={2.2} />}
                tone="coral"
                label={t("Study streak")}
                value={`${streakDays} ${t("days")}`}
                detail={
                  nextLeague
                    ? lang === "pt"
                      ? `Próxima liga: ${nextLeague.namePt}`
                      : `Next league: ${nextLeague.name}`
                    : null
                }
                detailStyle={nextLeague ? { color: nextLeague.from } : undefined}
              />
            </div>

            <div className="hidden min-w-0 border-l border-border sm:block">
              {/* Minutes today already live in Today's Progress; this slot shows the
                  weekly league instead. */}
              <WeeklyLeagueSummary profile={profile} translate={t} />
            </div>
            <div className="hidden min-w-0 border-l border-border sm:block">
              {/* The week count already lives in "Your learning rhythm"; this slot
                  shows what to do now in the study plan instead. */}
              <PlanTodaySummary
                next={planNext}
                weekDone={!!studyPlan && studyPlan.plan.nextIndex === null}
                translate={t}
              />
            </div>
          </div>

          <div className="order-2 flex min-h-0 min-w-0 flex-1 flex-col gap-[5px] lg:order-none lg:grid lg:grid-cols-12 lg:gap-3 xl:[min-height:auto]">
            <section className="flex min-h-0 min-w-0 flex-1 flex-col lg:col-span-9 lg:block xl:h-full">
              <NextStepCard compact />
            </section>
            <section
              className="card-soft flex min-w-0 flex-col p-3 lg:col-span-3 xl:h-full xl:px-4 xl:py-3 2xl:p-4"
              aria-labelledby="today-progress-title"
            >
              <div className="flex items-center gap-2">
                <Flame className="size-[1.375rem] shrink-0 text-dashboard-cyan" strokeWidth={2.5} />
                <h2 id="today-progress-title" className="font-display text-sm font-semibold">
                  {t("Today's Progress")}
                </h2>
                {/* Mobile: My Progress left the bottom navigation; it opens from the
                    title line, so the card keeps its height. Desktop has its button below. */}
                <Link
                  to="/progress"
                  className="ml-auto inline-flex items-center gap-1 rounded-md text-[11px] font-semibold leading-none text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60 lg:hidden"
                >
                  <ChartLine className="size-3.5 shrink-0" aria-hidden="true" />
                  {t("My progress")}
                  <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
                </Link>
              </div>
              <div className="mt-1.5 grid flex-1 grid-cols-[5.25rem_minmax(0,1fr)_5.5rem] items-center gap-1.5 lg:mt-2 lg:grid-cols-1 lg:items-center lg:gap-2 xl:min-h-0 xl:mt-1 xl:grid-cols-[5.5rem_minmax(0,1fr)] xl:gap-4 2xl:mt-2 2xl:grid-cols-[7rem_minmax(0,1fr)]">
                <div className="ml-2 flex flex-col items-center lg:mx-auto lg:ml-0 xl:mx-0">
                  <div className="relative grid size-[5.25rem] place-items-center text-brand-green lg:size-24 2xl:size-30">
                    <svg
                      className="absolute inset-0 size-full -rotate-90"
                      viewBox="0 0 96 96"
                      aria-hidden="true"
                    >
                      <circle
                        cx="48"
                        cy="48"
                        r="39"
                        fill="none"
                        stroke="var(--secondary)"
                        strokeWidth="11"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r="39"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="11"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 39}
                        strokeDashoffset={
                          2 *
                          Math.PI *
                          39 *
                          (1 - Math.min(1, minutesToday / Math.max(profile.daily_minutes, 1)))
                        }
                      />
                    </svg>
                    <span className="relative text-center font-display text-sm font-bold leading-none text-foreground lg:text-lg">
                      <span className="block whitespace-nowrap">
                        {minutesToday}/{profile.daily_minutes}
                      </span>
                      <span className="mt-1 block text-[10px] font-medium text-muted-foreground">
                        min
                      </span>
                    </span>
                  </div>
                  {minutesToday >= profile.daily_minutes && (
                    <p className="mt-1 text-center text-[10px] font-semibold text-brand-green lg:text-[11px]">
                      {t("Goal OK")}
                    </p>
                  )}
                </div>
                <div className="grid min-w-0 gap-2 xl:gap-1 2xl:gap-2">
                  <p className="hidden text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:block xl:text-[10px] xl:leading-tight 2xl:text-[11px] 2xl:leading-normal">
                    {t("KEEPING LEARNING")}
                  </p>
                  {!hasProgressToday && (
                    <div className="flex min-h-[5.75rem] flex-col items-center justify-center gap-1 text-center text-muted-foreground">
                      <Clock
                        className="size-5 text-brand-green"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                      <p className="text-[11px] font-bold leading-tight">
                        {t("Nothing yet today")}
                      </p>
                      <p className="text-[11px] font-medium leading-tight">
                        {t("{minutes} min to hit your goal").replace(
                          "{minutes}",
                          String(Math.max(minutesToGoal, 0)),
                        )}
                      </p>
                    </div>
                  )}
                  <div
                    className={`${hasProgressToday ? "grid" : "hidden"} gap-2 xl:gap-1 2xl:gap-2`}
                  >
                    {learningCards.map((card) => {
                      const stateVisual = {
                        done: { Icon: Check, iconClass: "text-brand-green", sr: "Done today." },
                        attention: {
                          Icon: TriangleAlert,
                          iconClass: "text-warning",
                          sr: "Needs attention.",
                        },
                        empty: {
                          Icon: Minus,
                          iconClass: "text-muted-foreground/60",
                          sr: "Nothing yet.",
                        },
                      } as const;
                      const { Icon, iconClass, sr } = stateVisual[card.state];
                      const valueClass =
                        card.state === "attention"
                          ? "text-warning"
                          : card.state === "empty"
                            ? "text-muted-foreground/60"
                            : "text-foreground";
                      return (
                        <div
                          key={card.label}
                          className="grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-1 lg:grid-cols-[1.75rem_minmax(0,1fr)] lg:gap-2.5"
                        >
                          <Icon
                            className={`size-4 shrink-0 justify-self-end lg:justify-self-auto ${iconClass}`}
                            strokeWidth={3}
                            aria-hidden="true"
                          />
                          <p className="line-clamp-2 text-[11px] leading-normal text-muted-foreground xl:text-[10px] xl:leading-tight 2xl:text-[11px] 2xl:leading-normal">
                            <span className={`font-display text-sm font-bold ${valueClass}`}>
                              {card.value}
                            </span>{" "}
                            {t(card.label)}
                          </p>
                          <span className="sr-only">{sr}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="border-l border-border pl-1.5 lg:border-0 lg:pl-0">
                  <WeeklyFrequency
                    userId={profile.id}
                    daysPerWeek={profile.study_days_per_week ?? 7}
                    presentation="mobile-progress-summary"
                  />
                </div>
              </div>
              {/* Desktop-only secondary action to the Study Plan, styled like the
                  app's other buttons (not a status pill), above a quiet closing line. */}
              <div className="mt-auto hidden flex-col items-center gap-1.5 pt-3 lg:flex xl:gap-1 xl:pt-1.5 min-[1680px]:gap-1.5 min-[1680px]:pt-3">
                {/* The study plan has its own header slot; this button opens My Progress,
                    which left the sidebar. */}
                <Link
                  to="/progress"
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-border xl:h-8 min-[1680px]:h-9 bg-sidebar-foreground/[0.04] px-3.5 text-[13px] font-semibold text-sidebar-foreground transition-colors hover:border-brand-green/50 hover:bg-brand-green/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60"
                >
                  <ChartLine className="size-4 shrink-0 text-brand-green" aria-hidden="true" />
                  {t("My progress")}
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
                {/* The closing line only shows where the row has height to spare. */}
                <p className="text-center text-xs text-muted-foreground xl:max-[1679.98px]:hidden!">
                  {t("Small steps create progress.")}
                </p>
              </div>
              <WeeklyFrequency
                userId={profile.id}
                daysPerWeek={profile.study_days_per_week ?? 7}
                presentation="mobile-strip"
              />
            </section>
          </div>

          <div className="order-3 grid min-w-0 gap-[5px] lg:order-none lg:grid-cols-12 lg:gap-3 xl:min-h-0">
            <div className="min-w-0 lg:col-span-5 xl:h-full">
              <PathProgressCard compact />
            </div>
            <div className="hidden min-w-0 lg:col-span-4 lg:block xl:h-full">
              <SmartReviewCard streakDays={streakDays} compact />
            </div>
            <div className="hidden min-w-0 lg:col-span-3 lg:block xl:h-full">
              <WeeklyFrequency
                userId={profile.id}
                daysPerWeek={profile.study_days_per_week ?? 7}
                presentation="dashboard-panel"
              />
            </div>
          </div>

          <section
            className="order-4 hidden card-soft min-w-0 p-3 lg:order-none lg:block xl:flex xl:min-h-0 xl:flex-col xl:px-4 xl:py-3"
            aria-labelledby="quick-access-title"
          >
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="flex items-center gap-2">
                <Bolt
                  className="size-[1.925rem] shrink-0 text-warning"
                  strokeWidth={2.6}
                  aria-hidden="true"
                />
                <h2 id="quick-access-title" className="font-display text-sm font-semibold">
                  {t("Quick Access")}
                </h2>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:min-h-0 xl:flex-1 xl:grid-cols-6 xl:gap-3">
              {quickAccess.map((item) => {
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`dashboard-quick-link group relative grid min-h-7 min-w-0 grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md border-0 px-2 py-1 text-foreground transition-[filter,transform] hover:brightness-110 lg:hover:-translate-y-0.5 xl:h-full xl:min-h-12 xl:grid-cols-[3rem_minmax(0,1fr)_auto] xl:px-3.5 xl:py-2 ${item.mobileOrder}`}
                  >
                    <span className="dashboard-quick-icon grid shrink-0 place-items-center">
                      <item.icon className="size-4 xl:size-[1.65rem]" strokeWidth={2.4} />
                    </span>
                    <span className="flex min-w-0 flex-col justify-center gap-0.5">
                      <span className="truncate text-xs font-medium">{t(item.label)}</span>
                      <span className="hidden text-[10px] leading-tight text-foreground/65 xl:block">
                        {t(item.subtitle)}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
