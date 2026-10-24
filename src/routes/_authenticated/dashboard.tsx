import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  BookA,
  BookOpen,
  BookOpenText,
  CalendarCheck2,
  CalendarDays,
  ChartLine,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Crown,
  Flame,
  Flower2,
  Gem,
  GraduationCap,
  Headphones,
  Layers,
  ListChecks,
  MessageCircle,
  Mic,
  PenLine,
  RotateCcw,
  Sparkles,
  SpellCheck,
  Repeat,
  Star,
  Target,
  Trophy,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { FocusHeaderButton } from "@/components/focus/FocusHeaderButton";
import { CelebrationBurst } from "@/components/CelebrationBurst";
import { AppShell } from "@/components/AppShell";
import { studyDayStartIso, studyToday } from "@/lib/today";
import { habitsDueToday } from "@/lib/life";
import { getLevelState } from "@/lib/level";
import { useLearningPath } from "@/hooks/useCurriculum";
import { useCelebrate } from "@/hooks/useCelebrate";
import { useLife } from "@/hooks/useLife";
import { useMinutesToday, useTodayActivities } from "@/components/DailyGoalCard";
import { EvoDailyReflection } from "@/components/EvoDailyReflection";
import { LevelCard } from "@/components/LevelCard";
import { getLeague, getNextLeague } from "@/components/LeagueBadge";
import { BusinessDashboardCard } from "@/components/BusinessDashboardCard";
import { GoalsTodayCard } from "@/components/GoalsTodayCard";
import { businessLevelAllowed } from "@/lib/businessCourse";
import { profileIsPremium } from "@/lib/billing/subscriptionView";
import { PathProgressCard } from "@/components/PathProgressCard";
import { NextStepCard } from "@/components/NextStepCard";
import { SmartReviewCard } from "@/components/SmartReviewCard";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ClockHands, DoneSeal } from "@/components/DoneSeal";
import { GaugeRing } from "@/components/GaugeRing";
import { WeeklyFrequency } from "@/components/WeeklyFrequency";

import { CampaignJourneyChip } from "@/components/CampaignJourney";
import { useActivityIndicators } from "@/hooks/useActivityIndicators";
import { useCampaignJourney } from "@/hooks/useCampaignJourney";
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
import { graphitePanelClass } from "@/lib/surfaces";
import { todayProgressLines, type TodayLineIcon } from "@/lib/todayProgressLines";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Home - Evoluir+ English AI" },
      {
        name: "description",
        content: "Your daily English plan, streak and skill scores in one place.",
      },
      { property: "og:title", content: "Home - Evoluir+ English AI" },
      { property: "og:description", content: "Your daily English plan, streak and skill scores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

/** Icons of the Today's Progress lines (todayProgressLines). */
const TODAY_LINE_ICONS: Record<TodayLineIcon, typeof BookOpen> = {
  lesson: BookOpen,
  words: BookA,
  accuracy: Target,
  conversation: MessageCircle,
  writing: PenLine,
  listening: Headphones,
  mistakes: RotateCcw,
  teacher: Sparkles,
  flashcards: Layers,
  pronunciation: Mic,
  test: ClipboardCheck,
  meditation: Flower2,
  reading: BookOpenText,
  time: Clock,
};

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
  // Everything the student still has to do, most immediate first: the launch
  // campaign's mission of the day, the plan's day, today's goal, due reviews,
  // then new content in each area.
  const journey = useCampaignJourney();
  // Life+ AI's tasks of the day still open (user request: notify them).
  const { data: life } = useLife();
  const openLifeTasks = life
    ? life.tasks.filter((task) => task.day === life.today && !task.doneAt).length
    : 0;
  // Today's daily reading not finished yet (user request, 2026-10-23: remind
  // it). Finishing the reading refreshes every query, this one included.
  const { data: profile } = useProfile();
  const { data: readingDone } = useQuery({
    queryKey: ["daily-reading-done", profile?.id],
    enabled: !!profile?.id,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { count } = await supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile!.id)
        .eq("activity_type", "daily_reading")
        .gte("created_at", studyDayStartIso());
      return (count ?? 0) > 0;
    },
  });
  // Today's goal steps still open: finishing every one also closes the study
  // day (user request, 2026-10-23: activities without a reminder). Only steps
  // already written for today; the bell never asks the AI to write them.
  const { data: openGoalSteps = 0 } = useQuery({
    queryKey: ["plus", "steps-open", profile?.id],
    enabled: !!profile?.id,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { count } = await (
        supabase.from as unknown as (name: string) => {
          select: (
            columns: string,
            options: { count: "exact"; head: true },
          ) => {
            eq: (
              column: string,
              value: string,
            ) => {
              eq: (
                column: string,
                value: string,
              ) => { is: (column: string, value: null) => Promise<{ count: number | null }> };
            };
          };
        }
      )("plus_goal_steps")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile!.id)
        .eq("day", studyToday())
        .is("done_at", null);
      return count ?? 0;
    },
  });
  // Habits due today not ticked yet (Premium); a habit linked to the study
  // day ticks itself, so it is left out.
  const habitsOpen =
    life && life.premium
      ? habitsDueToday(
          life.habits.filter((habit) => habit.linked !== "study_day"),
          life.logs,
          life.today,
        ).filter(
          (habit) => !life.logs.some((log) => log.habitId === habit.id && log.day === life.today),
        ).length
      : 0;
  const priorityOpen =
    !!life?.premium && !!life.priority && life.priority.day === life.today && !life.priority.doneAt;
  // The Final Test opens with 21 of the 30 core lessons; until it is passed,
  // the bell says the student can move up.
  const path = useLearningPath();
  const finalTestReady = path.finalTest.unlocked && !path.finalTest.passed;
  const nextLevel = finalTestReady ? getLevelState(path.level).next?.value.toUpperCase() : null;
  const items = [
    {
      id: "final-test",
      to: "/learning",
      label: nextLevel
        ? `${translate("Final Test unlocked: move up to")} ${nextLevel}`
        : translate("Final Test unlocked"),
      icon: Trophy,
      visible: finalTestReady,
    },
    {
      id: "journey",
      to: journey?.message.to ?? "/coach",
      label: journey ? translate(journey.message.title) : "",
      icon: Crown,
      visible: !!journey,
    },
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
      id: "life-tasks",
      to: "/life",
      label: `${translate("Life+ AI tasks for today")}: ${openLifeTasks}`,
      icon: ListChecks,
      visible: openLifeTasks > 0,
    },
    {
      id: "goal-steps",
      to: "/life",
      label: `${translate("Goal steps for today")}: ${openGoalSteps}`,
      icon: Target,
      visible: openGoalSteps > 0,
    },
    {
      id: "habits",
      to: "/life",
      label: `${translate("Habits to check in today")}: ${habitsOpen}`,
      icon: Repeat,
      visible: habitsOpen > 0,
    },
    {
      id: "priority",
      to: "/life",
      label: `${translate("Priority of the day")}: ${life?.priority?.text ?? ""}`,
      icon: Star,
      visible: priorityOpen,
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
      id: "reading",
      to: "/reading",
      label: "Today's reading is waiting",
      icon: BookOpenText,
      visible: readingDone === false,
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
  // Every English activity of the day is done but the minutes goal is not
  // (user request, 2026-10-23): the bell says where to start something new.
  const englishPending = activeItems.some((item) =>
    [
      "final-test",
      "plan",
      "mistakes",
      "review",
      "reading",
      "listening",
      "writing",
      "vocabulary",
    ].includes(item.id),
  );
  const needsNewActivity = goalMinutesLeft > 0 && indicators.ready && !englishPending;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={translate("Open notifications")}
          className={
            placement === "mobile"
              ? // Borderless like the other icons of the phone header capsule (user request).
                "relative h-8 w-7 shrink-0 rounded-full text-slate-100 hover:bg-white/10 hover:text-white"
              : // A grey circle closing the Weather talk capsule (user request).
                "relative size-9 shrink-0 rounded-full bg-white/10 text-muted-foreground hover:bg-white/15 hover:text-foreground"
          }
        >
          <Bell className={placement === "mobile" ? "size-[1.15rem]" : "size-4"} />
          {hasNotifications && (
            <span
              className={`absolute size-2 rounded-full bg-brand-green ring-2 ring-background ${placement === "mobile" ? "right-0.5 top-1" : "right-2 top-2"}`}
            >
              <span className="sr-only">{translate("New activities available")}</span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
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
            {needsNewActivity ? (
              <div className="mt-1 rounded-md border border-brand-green/25 bg-brand-green/[0.06] p-2.5">
                <p className="flex gap-2 text-xs leading-snug text-muted-foreground">
                  <Sparkles
                    className="mt-0.5 size-3.5 shrink-0 text-brand-green"
                    aria-hidden="true"
                  />
                  <span>
                    {translate("Today's activities are done. To reach your goal, start a new one:")}
                  </span>
                </p>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {NEW_ACTIVITY_LINKS.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="flex min-h-9 items-center gap-1.5 rounded-md bg-white/[0.05] px-2 py-1.5 text-xs leading-tight font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      <link.icon
                        className="size-3.5 shrink-0 text-brand-green"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 text-balance">{translate(link.label)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
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

/**
 * Where a new activity can always be started once the day's ones are done:
 * each of these makes fresh practice on demand and counts toward the minutes.
 */
const NEW_ACTIVITY_LINKS = [
  { to: "/coach", label: "Talk to EVO", icon: Mic },
  { to: "/listening", label: "New Listening session", icon: Headphones },
  { to: "/reading", label: "Read another text", icon: BookOpenText },
  { to: "/learning", label: "Next lesson", icon: GraduationCap },
] as const;

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
  todayDone,
  translate,
}: {
  next: StudyPlanDay | null | undefined;
  weekDone: boolean;
  /** Today's plan day is already done. */
  todayDone: boolean;
  translate: (label: string) => string;
}) {
  // Show the green checked calendar only when every planned day is done.
  // Completing today's activity must not mark an unfinished week as complete.
  const ok = weekDone;
  const label = weekDone
    ? translate("Week plan complete")
    : !next
      ? translate("Your study plan")
      : next.status === "today"
        ? translate("Today in your plan")
        : next.status === "missed"
          ? translate("Catch up")
          : translate("Next in your plan");
  const detail = weekDone
    ? translate("Next plan on Monday")
    : next
      ? `${translate(PLAN_SKILL_LABELS[next.skill] ?? next.title)} - ${translate(next.day)}`
      : translate("Your week");
  return (
    <DashboardHeaderStat
      icon={
        ok ? (
          <CalendarCheck2 className="size-6" strokeWidth={2.2} />
        ) : (
          <CalendarDays className="size-6" strokeWidth={2.2} />
        )
      }
      tone={ok ? "green" : "pink"}
      label={label}
      value={weekDone ? translate("All days done") : translate("Your week")}
      // Always three lines, like the other header cells (user request).
      detail={detail}
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
  const {
    data: mistakesDue = 0,
    isSuccess: mistakesKnown,
    isError: mistakesFailed,
  } = useQuery({
    queryKey: ["mistakes-due", profile?.id],
    enabled: !!profile?.id,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { count } = await supabase
        .from("learning_errors")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile!.id)
        .eq("review_step", 0)
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
  // Business English: from B1 for Premium students; free students always see
  // the card, disabled with the Premium badge (user request).
  const showBusinessCard =
    !!profile &&
    (businessLevelAllowed(profile.max_level || profile.level) || !profileIsPremium(profile));
  const streakDays = profile ? effectiveStreak(profile) : 0;
  const nextLeague = profile ? getNextLeague(streakDays) : null;
  const jewelDaysLeft = getLeague(streakDays).nextIn;
  const { data: minutesToday = 0 } = useMinutesToday(profile?.id);
  const { data: todayActivities = [] } = useTodayActivities(profile?.id);

  useEffect(() => {
    if (profile && !profile.onboarding_completed) navigate({ to: "/onboarding", replace: true });
  }, [profile, navigate]);

  // The three lines follow what the student did today (todayProgressLines).
  const learningCards = todayProgressLines({
    lessonsCompleted: snapshot?.todayLessonsCompleted ?? 0,
    wordsMastered: snapshot?.todayVocabularyMastered ?? 0,
    accuracy: snapshot?.todayQuizAverage ?? 0,
    activities: todayActivities,
  });
  // Minutes in the ring always come with at least one line beside them.
  const hasProgressToday = minutesToday > 0 || learningCards.some((card) => card.state !== "empty");
  const minutesToGoal = Math.max(profile?.daily_minutes ?? 0, 0) - minutesToday;
  // The first time today the student sees the daily goal reached (user request).
  const celebrateGoal = useCelebrate(
    "daily-goal",
    !!profile && profile.daily_minutes > 0 && minutesToday >= profile.daily_minutes,
  );

  return (
    <AppShell dashboardLayout>
      {isLoading || !profile ? (
        <DashboardSkeleton />
      ) : (
        <div className="dashboard-one-screen flex h-full flex-col gap-[7px] lg:h-auto lg:grid lg:gap-[7px] xl:grid-rows-[4rem_7.59rem_minmax(16.45rem,min-content)_minmax(min-content,1fr)_minmax(7.59rem,auto)] xl:gap-5 xl:pb-3">
          <header className="animate-rise min-w-0 xl:h-16">
            <EvoDailyReflection
              userId={profile.id}
              name={profile.name}
              placement="dashboard-header"
              desktopSubtitleTrailing={
                <div className="flex items-center gap-1.5">
                  <CampaignJourneyChip translate={t} placement="desktop" />
                  {/* One capsule for Weather talk, the Focus timer and the bell, the
                      bell in its own grey circle at the end (user request). */}
                  <div className="flex h-11 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
                    <WeatherTalk translate={t} placement="desktop" />
                    <FocusHeaderButton translate={t} placement="desktop" />
                    <DashboardNotifications
                      indicators={indicators}
                      reviewCount={reviewCount}
                      planTask={planNext}
                      mistakesDue={mistakesDue}
                      goalMinutesLeft={Math.max(0, (profile.daily_minutes ?? 0) - minutesToday)}
                      translate={t}
                      placement="desktop"
                    />
                  </div>
                  <FirstWeekGuide profile={profile} placement="desktop" />
                </div>
              }
              mobileTrailing={
                <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                  <CampaignJourneyChip translate={t} placement="mobile" />
                  <FirstWeekGuide profile={profile} placement="mobile" />
                  {/* Gem + number only: the word "days" pushed the greeting's name
                      out of the row. Screen readers still hear "20 days". */}
                  {/* One glass capsule holds the streak, Weather talk and the bell,
                      like the desktop one (user request); the bell closes it in
                      its own grey circle. */}
                  <div className="flex h-10 items-center gap-0 rounded-full border border-white/10 bg-white/[0.04] p-1 backdrop-blur-xl">
                    <span
                      className="flex items-center gap-1 pl-1.5 pr-0.5"
                      role="img"
                      title={`${streakDays} ${t("days")}`}
                      aria-label={`${t("Study streak")}: ${streakDays} ${t("days")}`}
                    >
                      <Gem
                        className="size-5 shrink-0"
                        style={{ color: getLeague(streakDays).from }}
                        strokeWidth={2.4}
                        aria-hidden="true"
                      />
                      <span className="font-display text-sm font-bold" aria-hidden="true">
                        {streakDays}
                      </span>
                    </span>
                    {/* Tomato before the weather on phones (user request). */}
                    <FocusHeaderButton translate={t} placement="mobile" />
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
                </div>
              }
            />
          </header>

          {/* The level selector has its own card, apart from the three
              indicators (user request), with the same gap as the cards below. */}
          <div className="order-1 hidden min-w-0 gap-3 lg:order-none lg:grid lg:grid-cols-12 xl:h-[7.59rem]">
            {/* As wide as the Business English card (4 of 12 columns; user request). */}
            <div className="card-soft min-w-0 overflow-hidden lg:col-span-4">
              <LevelCard level={profile.level} maxLevel={profile.max_level} compact />
            </div>

            <div className="grid min-w-0 grid-cols-[5fr_5fr_6fr] gap-3 lg:col-span-8">
              <div className="card-soft min-w-0 overflow-hidden rounded-2xl">
                {/* The streak climbs a ladder of jewels (Bronze, Silver, Gold...); the
                  gem takes the current jewel's colour, so it is not mistaken for
                  the weekly league. */}
                <DashboardHeaderStat
                  icon={<Gem className="size-6" strokeWidth={2.2} />}
                  tone="coral"
                  iconColor={getLeague(streakDays).from}
                  label={t("Study streak")}
                  value={`${streakDays} ${t("days")}`}
                  // How many days in a row the next jewel needs, and the rule on
                  // hover (user request: make the rule clear, not change it).
                  detail={
                    nextLeague
                      ? lang === "pt"
                        ? `${nextLeague.namePt} em ${jewelDaysLeft} ${jewelDaysLeft === 1 ? "dia seguido" : "dias seguidos"}`
                        : `${nextLeague.name} in ${jewelDaysLeft} ${jewelDaysLeft === 1 ? "day" : "days"} in a row`
                      : null
                  }
                  hint={
                    lang === "pt"
                      ? "As joias sobem a cada 7 dias seguidos de estudo (1 falta por semana é protegida). Cumprir seu plano da semana vale as 3 estrelas douradas."
                      : "Jewels climb every 7 study days in a row (one missed day a week is protected). Meeting your weekly plan earns the 3 gold stars."
                  }
                  detailStyle={nextLeague ? { color: nextLeague.from } : undefined}
                />
              </div>

              <div className="card-soft min-w-0 overflow-hidden rounded-2xl">
                {/* Minutes today already live in Today's Progress; this slot shows the
                  weekly league instead. */}
                <WeeklyLeagueSummary profile={profile} translate={t} />
              </div>
              <div className="card-soft min-w-0 overflow-hidden rounded-2xl">
                {/* The week count already lives in "Your learning rhythm"; this slot
                  shows what to do now in the study plan instead. */}
                <PlanTodaySummary
                  next={planNext}
                  weekDone={!!studyPlan && studyPlan.plan.nextIndex === null}
                  todayDone={
                    !!studyPlan &&
                    studyPlan.plan.days.some(
                      (day) => day.date === studyToday() && day.status === "done",
                    )
                  }
                  translate={t}
                />
              </div>
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
              <div className="mb-2.5 mt-3 grid w-full flex-none grid-cols-[6.5rem_auto] items-center justify-center gap-x-0 gap-y-1.5 lg:mb-0 lg:mt-2 lg:justify-normal lg:gap-x-2 lg:pl-0 lg:grid-cols-1 lg:items-center lg:gap-2 xl:min-h-0 xl:mt-1 xl:grid-cols-[5.5rem_minmax(0,1fr)] xl:gap-4 xl:gap-x-4 2xl:mt-2 2xl:grid-cols-[7rem_minmax(0,1fr)]">
                <div className="flex flex-col items-center lg:mx-auto xl:mx-0">
                  <div
                    className={cn(
                      "relative grid size-[6.52rem] place-items-center justify-self-center text-brand-green lg:translate-y-5 lg:size-24 lg:justify-self-start 2xl:size-30",
                      celebrateGoal && "animate-celebrate",
                    )}
                  >
                    <CelebrationBurst active={celebrateGoal} />
                    {/* An open-bottom gauge (user request, 2026-10-24): the minutes
                        sit in its gap, the centre shows the check once the goal is
                        met and the share before. */}
                    <GaugeRing
                      progress={minutesToday / Math.max(profile.daily_minutes, 1)}
                      value={minutesToday}
                      goal={profile.daily_minutes}
                      unit="min"
                    >
                      {minutesToday >= profile.daily_minutes ? (
                        <Check
                          className="size-8 text-brand-green lg:size-9"
                          strokeWidth={3.25}
                          aria-label={`${minutesToday} of ${profile.daily_minutes} minutes, goal reached`}
                        />
                      ) : (
                        <span className="font-display text-lg font-bold leading-none text-foreground lg:text-xl">
                          {Math.round((minutesToday / Math.max(profile.daily_minutes, 1)) * 100)}%
                        </span>
                      )}
                    </GaugeRing>
                  </div>
                </div>
                <div className="grid min-w-0 gap-2 lg:self-start xl:gap-1 2xl:gap-2">
                  {!hasProgressToday && (
                    <div className="flex min-h-[5.75rem] translate-y-4 flex-col items-center justify-center gap-1 text-center text-muted-foreground">
                      <DoneSeal icon={ClockHands} />
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
                    className={cn(
                      `${hasProgressToday ? "grid" : "hidden"} gap-1 self-center lg:translate-y-[42px] xl:gap-1 2xl:gap-2`,
                    )}
                  >
                    {learningCards.map((card) => {
                      // Each line has its own activity icon: grey until done today,
                      // then lit in the ring's colour (accuracy from 70%).
                      const Icon = TODAY_LINE_ICONS[card.icon];
                      const iconClass =
                        card.state === "done" ? "text-brand-green/75" : "text-muted-foreground/50";
                      const sr =
                        card.state === "done"
                          ? "Done today."
                          : card.state === "attention"
                            ? "Needs attention."
                            : "Nothing yet.";
                      const valueClass =
                        card.state === "attention"
                          ? "text-warning"
                          : card.state === "empty"
                            ? "text-muted-foreground/60"
                            : "text-foreground";
                      return (
                        // Phones: the icon sits centred in its column, as far from the
                        // ring as from the number (user request, 2026-10-24).
                        <div
                          key={card.key}
                          className="grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-1 lg:grid-cols-[1.75rem_minmax(0,1fr)] lg:gap-2.5"
                        >
                          <Icon
                            className={`size-4 shrink-0 justify-self-center lg:justify-self-auto ${iconClass}`}
                            strokeWidth={2.4}
                            aria-hidden="true"
                          />
                          <p className="line-clamp-2 text-[11px] leading-normal text-muted-foreground xl:text-[10px] xl:leading-tight 2xl:text-[11px] 2xl:leading-normal">
                            <span
                              className={`font-display text-[13px] font-semibold lg:text-sm lg:font-bold ${valueClass}`}
                            >
                              {card.value}
                            </span>
                            {/* Margin, not a space character: the value and its label
                                never touch, whatever the font. */}
                            <span className="ml-1.5">{t(card.label)}</span>
                          </p>
                          <span className="sr-only">{sr}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              {/* Desktop-only secondary action to the Study Plan, styled like the
                  app's other buttons (not a status pill), above a quiet closing line. */}
              <div className="mt-auto hidden flex-col items-center gap-1.5 pt-3 lg:flex xl:gap-1 xl:pt-1.5 min-[1680px]:gap-1.5 min-[1680px]:pt-3">
                {/* The study plan has its own header slot; this button opens My Progress,
                    which left the sidebar. */}
                <Link
                  to="/progress"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-green px-5 text-sm font-bold text-sidebar [word-spacing:0.1em] transition-colors hover:bg-brand-green/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60"
                >
                  <ChartLine className="size-4 shrink-0" aria-hidden="true" />
                  {t("My progress")}
                  <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                </Link>
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
              <SmartReviewCard
                streakDays={streakDays}
                compact
                mistakesDue={mistakesDue}
                extrasReady={mistakesKnown || mistakesFailed}
              />
            </div>
            <div className="hidden min-w-0 lg:col-span-3 lg:block xl:h-full">
              <WeeklyFrequency
                userId={profile.id}
                daysPerWeek={profile.study_days_per_week ?? 7}
                presentation="dashboard-panel"
              />
            </div>
          </div>

          {/* Desktop: the Quick Access row repeated the sidebar; today's goal
              steps took its place. */}
          {/* Business English (Premium bonus from B1) sits beside today's
              goals; below B1 the goals keep the whole row. */}
          <div
            className={`order-4 hidden min-w-0 gap-3 lg:order-none xl:h-full xl:min-h-0 ${
              showBusinessCard ? "lg:grid lg:grid-cols-12" : "lg:block"
            }`}
          >
            <div className="min-w-0 lg:col-span-8 xl:h-full xl:min-h-0">
              <GoalsTodayCard />
            </div>
            {showBusinessCard && (
              <div className="min-w-0 lg:col-span-4 xl:h-full xl:min-h-0">
                <BusinessDashboardCard />
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

/**
 * The Dashboard while the profile loads, in the page's own shapes and grid
 * (user report, 2026-10-23: three loose bars with the footer under them
 * flashed on every load): it fills the screen like the real page, so the
 * footer stays below and nothing jumps when the cards arrive.
 */
function DashboardSkeleton() {
  return (
    <div
      className="dashboard-one-screen flex h-full flex-col gap-[7px] lg:h-auto lg:grid lg:gap-[7px] xl:grid-rows-[4rem_7.59rem_minmax(16.45rem,min-content)_minmax(min-content,1fr)_minmax(7.59rem,auto)] xl:gap-5 xl:pb-3"
      aria-busy="true"
    >
      <div className="flex min-w-0 items-center justify-between gap-3 xl:h-16">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-6 w-40 sm:w-56" />
          <Skeleton className="hidden h-4 w-72 lg:block" />
        </div>
        <Skeleton className="h-10 w-32 rounded-full lg:h-11 lg:w-72" />
      </div>
      <div className="hidden min-w-0 gap-3 lg:grid lg:grid-cols-12 xl:h-[7.59rem]">
        <Skeleton className="h-full min-h-[7.59rem] rounded-xl lg:col-span-4" />
        <Skeleton className="h-full min-h-[7.59rem] rounded-xl lg:col-span-8" />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[7px] lg:grid lg:grid-cols-12 lg:gap-3">
        <Skeleton className="min-h-[13rem] flex-1 rounded-xl lg:col-span-9 lg:min-h-[16.45rem]" />
        <Skeleton className="min-h-[9rem] rounded-xl lg:col-span-3 lg:min-h-[16.45rem]" />
      </div>
      <div className="grid min-w-0 gap-[7px] lg:grid-cols-12 lg:gap-3">
        <Skeleton className="min-h-[12rem] rounded-xl lg:col-span-5 xl:h-full" />
        <Skeleton className="hidden min-h-[12rem] rounded-xl lg:col-span-4 lg:block xl:h-full" />
        <Skeleton className="hidden min-h-[12rem] rounded-xl lg:col-span-3 lg:block xl:h-full" />
      </div>
      <div className="hidden min-w-0 gap-3 lg:grid lg:grid-cols-12">
        <Skeleton className="min-h-[7.59rem] rounded-xl lg:col-span-8" />
        <Skeleton className="min-h-[7.59rem] rounded-xl lg:col-span-4" />
      </div>
    </div>
  );
}
