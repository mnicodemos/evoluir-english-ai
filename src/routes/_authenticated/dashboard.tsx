import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bolt,
  BookOpen,
  Check,
  Clock,
  Flame,
  Snowflake,
  GraduationCap,
  Headphones,
  Map,
  MessageSquareText,
  Minus,
  PenLine,
  Sparkles,
  Star,
  TriangleAlert,
} from "lucide-react";
import { useEffect } from "react";

import { AppShell } from "@/components/AppShell";
import { DailyGoalCard, useMinutesToday } from "@/components/DailyGoalCard";
import { EvoDailyReflection } from "@/components/EvoDailyReflection";
import { WeatherTalk } from "@/components/WeatherTalk";
import { FirstWeekGuide } from "@/components/FirstWeekGuide";
import { LevelCard } from "@/components/LevelCard";
import { getLeague, getNextLeague, LeagueBadge } from "@/components/LeagueBadge";
import { PathProgressCard } from "@/components/LearningPathCard";
import { NextStepCard } from "@/components/NextStepCard";
import { SmartReviewCard } from "@/components/SmartReviewCard";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WeeklyFrequency } from "@/components/WeeklyFrequency";

import { useActivityIndicators } from "@/hooks/useActivityIndicators";
import { effectiveStreak, useProfile } from "@/hooks/useProfile";
import { streakAlive } from "@/lib/streakFreeze";
import { studyToday } from "@/lib/today";
import { useStudySnapshot } from "@/hooks/useStudyContext";
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
  translate: (label: string) => string;
  placement: "mobile" | "desktop";
};

function DashboardNotifications({ indicators, translate, placement }: DashboardNotificationsProps) {
  const items = [
    {
      to: "/listening",
      label: "New listening activity",
      icon: Headphones,
      visible: indicators.listening,
    },
    {
      to: "/writing",
      label: "New writing activity",
      icon: PenLine,
      visible: indicators.writing,
    },
    {
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
              ? "relative size-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
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
        className="dashboard-shell dark w-[min(20rem,calc(100vw-1.5rem))] border-notification-border bg-popover/80 p-2 text-popover-foreground backdrop-blur-md backdrop-saturate-150"
      >
        <p className="px-2 py-1.5 font-display text-sm font-semibold">
          {translate("Notifications")}
        </p>
        {hasNotifications ? (
          <div className="grid gap-1">
            {activeItems.map((item) => (
              <Link
                key={item.to}
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

function Dashboard() {
  const { data: profile, isLoading } = useProfile();
  const navigate = useNavigate();
  const { data: snapshot } = useStudySnapshot();
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const indicators = useActivityIndicators();
  const streakDays = profile ? effectiveStreak(profile) : 0;
  // A missed day this week covered by the streak protection (one per week).
  const protectedDay = profile
    ? streakAlive(profile.last_activity_date, profile.streak_freeze_used_on, studyToday())
        .protectedDay
    : null;
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
        <div className="dashboard-one-screen flex h-full flex-col gap-[5px] lg:h-auto lg:grid lg:gap-[7px] xl:grid-rows-[4rem_7.59rem_16.45rem_minmax(9.5rem,1fr)_minmax(5.625rem,0.62fr)] xl:gap-5">
          <header className="animate-rise min-w-0 xl:h-16">
            <EvoDailyReflection
              userId={profile.id}
              name={profile.name}
              placement="dashboard-header"
              desktopSubtitleTrailing={
                <div className="flex items-center gap-0.5">
                  <DashboardNotifications
                    indicators={indicators}
                    translate={t}
                    placement="desktop"
                  />
                  <WeatherTalk translate={t} placement="desktop" />
                  <FirstWeekGuide profile={profile} placement="desktop" />
                </div>
              }
              mobileTrailing={
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <DashboardNotifications
                    indicators={indicators}
                    translate={t}
                    placement="mobile"
                  />
                  <WeatherTalk translate={t} placement="mobile" />
                  <FirstWeekGuide profile={profile} placement="mobile" />
                  <span className="rounded-full border border-brand-green/40 bg-brand-green/15 px-2.5 py-1 font-display text-xs font-bold uppercase text-brand-green">
                    {profile.level}
                  </span>
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
                </div>
              }
            />
          </header>

          <div className="order-1 hidden card-soft min-w-0 grid-cols-3 overflow-hidden lg:order-none lg:grid lg:grid-cols-4 xl:h-[7.59rem]">
            <div className="col-span-3 border-b border-border lg:col-span-1 lg:border-b-0 lg:border-r">
              <LevelCard level={profile.level} maxLevel={profile.max_level} compact />
            </div>

            <div
              className="hidden min-w-0 flex-col items-center justify-center gap-1 px-1.5 py-2 text-center sm:flex sm:flex-row sm:gap-3 sm:px-3 sm:text-left"
              title={t("Streak protection: missing one day per week does not break your streak.")}
            >
              <Flame
                className="size-6 shrink-0 fill-current text-current sm:hidden"
                style={{ color: getLeague(streakDays).from }}
                strokeWidth={2.4}
              />
              <Flame
                className="hidden size-[1.925rem] shrink-0 fill-dashboard-coral text-dashboard-coral sm:block"
                strokeWidth={2.4}
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 font-display text-[13px] font-bold leading-tight sm:text-base">
                  <span className="sm:truncate">{streakDays} days</span>
                  {protectedDay && (
                    <Snowflake
                      className="size-4 shrink-0 text-sky-400"
                      aria-label={t("Streak protected this week")}
                    />
                  )}
                </p>
                <p className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
                  {t("Study streak")}
                </p>
                {nextLeague && (
                  <p
                    className="mt-0.5 hidden truncate text-[10px] font-semibold leading-tight sm:block sm:text-xs"
                    style={{ color: nextLeague.from }}
                  >
                    {lang === "pt"
                      ? `Próxima liga: ${nextLeague.namePt}`
                      : `Next league: ${nextLeague.name}`}
                  </p>
                )}
              </div>
              <LeagueBadge streakDays={streakDays} size={53} className="hidden sm:grid" />
            </div>

            <div className="hidden min-w-0 border-l border-border sm:block">
              <DailyGoalCard
                userId={profile.id}
                goalMinutes={profile.daily_minutes}
                compact
                mobileSummary
              />
            </div>
            <div className="hidden min-w-0 border-l border-border sm:block">
              <WeeklyFrequency
                userId={profile.id}
                daysPerWeek={profile.study_days_per_week ?? 7}
                presentation="summary"
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
                  <p className="hidden text-[11px] font-semibold uppercase tracking-wide text-warning lg:block xl:text-[10px] xl:leading-tight 2xl:text-[11px] 2xl:leading-normal">
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
              {/* Desktop-only "Your trail" badge: same pill formatting as the
                  Priority label (Your English Skills), 20% larger, opening the
                  Study Plan page — above the closing line. */}
              <div className="mt-auto hidden flex-col items-center gap-1.5 pt-3 lg:flex xl:gap-1 xl:pt-2 2xl:gap-1.5 2xl:pt-3">
                <Link
                  to="/study-plan"
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/15 px-2.5 py-[5px] text-[12px] font-semibold text-brand-green transition-colors hover:bg-brand-green/25"
                >
                  <Map className="size-4 shrink-0" aria-hidden="true" />
                  {t("Your trail")}
                </Link>
                <p className="flex items-center justify-center gap-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-warning">
                  <Star className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="sr-only">Star.</span>
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
