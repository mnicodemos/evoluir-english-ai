import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bolt,
  BookOpen,
  Check,
  Flame,
  GraduationCap,
  Headphones,
  MessageSquareText,
  PenLine,
  Sparkles,
} from "lucide-react";
import { useEffect } from "react";

import { AppShell, MobileNavigationMenu } from "@/components/AppShell";
import { DailyGoalCard, useMinutesToday } from "@/components/DailyGoalCard";
import { EvoDailyReflection } from "@/components/EvoDailyReflection";
import { LevelCard } from "@/components/LevelCard";
import { getNextLeague, LeagueBadge } from "@/components/LeagueBadge";
import { PathProgressCard } from "@/components/LearningPathCard";
import { NextStepCard } from "@/components/NextStepCard";
import { SmartReviewCard } from "@/components/SmartReviewCard";

import { Skeleton } from "@/components/ui/skeleton";
import { WeeklyFrequency } from "@/components/WeeklyFrequency";

import { useActivityIndicators } from "@/hooks/useActivityIndicators";
import { effectiveStreak, useProfile } from "@/hooks/useProfile";
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

function Dashboard() {
  const { data: profile, isLoading } = useProfile();
  const navigate = useNavigate();
  const { data: snapshot } = useStudySnapshot();
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const indicators = useActivityIndicators();
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
      icon: GraduationCap,
      mobileOrder: "order-1 lg:order-none",
    },
    {
      to: "/teacher",
      label: "AI Teacher",
      icon: Sparkles,
      mobileOrder: "order-2 lg:order-none",
    },
    {
      to: "/coach",
      label: "AI Talking",
      icon: MessageSquareText,
      mobileOrder: "order-3 lg:order-none",
    },
    {
      to: "/writing",
      label: "Writing",
      icon: PenLine,
      mobileOrder: "order-4 lg:order-none",
    },
    {
      to: "/listening",
      label: "Listening",
      icon: Headphones,
      mobileOrder: "order-5 lg:order-none",
    },
    {
      to: "/vocabulary",
      label: "Vocabulary",
      icon: BookOpen,
      mobileOrder: "order-6 lg:order-none",
    },
  ] as const;

  const learningCards = [
    { emoji: "📚", label: "Lessons completed", value: `${snapshot?.lessonsCompleted ?? 0}` },
    { emoji: "🎬", label: "Videos watched", value: `${snapshot?.videosWatched ?? 0}` },
    { emoji: "🧠", label: "Vocabulary mastered", value: `${snapshot?.vocabularyMastered ?? 0}` },
    { emoji: "🎯", label: "Quiz score", value: `${snapshot?.quizAverage ?? 0}%` },
  ];

  return (
    <AppShell dashboardLayout>
      {isLoading || !profile ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : (
        <div className="dashboard-one-screen grid gap-[7px] xl:grid-rows-[4rem_7.59rem_16.45rem_minmax(9.5rem,1fr)_minmax(5.625rem,0.62fr)] xl:gap-5">
          <header className="animate-rise min-w-0 xl:h-16">
            <EvoDailyReflection
              userId={profile.id}
              name={profile.name}
              placement="dashboard-header"
              mobileLeading={<MobileNavigationMenu translate={t} />}
            />
          </header>

          <div className="order-1 card-soft grid min-w-0 grid-cols-3 overflow-hidden lg:order-none lg:grid-cols-4 xl:h-[7.59rem]">
            <div className="col-span-3 border-b border-border lg:col-span-1 lg:border-b-0 lg:border-r">
              <LevelCard level={profile.level} maxLevel={profile.max_level} compact />
            </div>

            <div className="flex min-w-0 flex-col items-center justify-center gap-1 px-1.5 py-2 text-center sm:flex-row sm:gap-3 sm:px-3 sm:text-left">
              <Flame
                className="size-6 shrink-0 fill-dashboard-coral text-dashboard-coral sm:size-[1.925rem]"
                strokeWidth={2.4}
              />
              <div className="min-w-0 flex-1">
                 <p className="font-display text-[13px] font-bold leading-tight sm:truncate sm:text-base">{streakDays} days</p>
                <p className="text-[10px] leading-tight text-muted-foreground sm:text-xs">{t("Study streak")}</p>
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
              <LeagueBadge
                streakDays={streakDays}
                size={53}
                className="hidden sm:grid"
              />
            </div>

            <div className="min-w-0 border-l border-border">
              <DailyGoalCard userId={profile.id} goalMinutes={profile.daily_minutes} compact mobileSummary />
            </div>
            <div className="min-w-0 border-l border-border">
              <WeeklyFrequency
                userId={profile.id}
                daysPerWeek={profile.study_days_per_week ?? 7}
                presentation="summary"
              />
            </div>
          </div>

          <div className="order-2 grid min-w-0 gap-2 lg:order-none lg:grid-cols-12 lg:gap-3 xl:min-h-0">
            <section className="min-w-0 lg:col-span-9 xl:h-full">
              <NextStepCard compact />
            </section>
            <div className="min-w-0 lg:hidden">
              <SmartReviewCard streakDays={streakDays} compact />
            </div>
            <section
              className="card-soft flex min-w-0 flex-col p-3 lg:col-span-3 xl:h-full xl:p-4"
              aria-labelledby="today-progress-title"
            >
              <div className="flex items-center gap-2">
                 <Flame className="size-[1.375rem] shrink-0 text-dashboard-cyan" strokeWidth={2.5} />
                 <h2 id="today-progress-title" className="font-display text-sm font-semibold">
                  {t("Today's Progress")}
                </h2>
              </div>
              <div className="mt-3 grid flex-1 grid-cols-[6rem_minmax(0,1fr)] items-center gap-3 lg:grid-cols-1 xl:min-h-0 xl:grid-cols-[7rem_minmax(0,1fr)] xl:gap-4">
                <div className="relative grid size-24 place-items-center text-brand-green lg:mx-auto xl:size-30 xl:mx-0">
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
                  <span className="relative text-center font-display text-2xl font-bold leading-none text-foreground">
                    {minutesToday}
                    <span className="mt-1 block text-[10px] font-medium text-muted-foreground">
                      min
                    </span>
                  </span>
                </div>
                <div className="grid gap-2.5">
                  {learningCards.map((card) => (
                    <div
                      key={card.label}
                      className="grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-2.5"
                    >
                      <Check className="size-4 shrink-0 text-brand-green" strokeWidth={3} aria-hidden="true" />
                      <p className="line-clamp-2 text-[11px] text-muted-foreground">
                        <span className="font-display text-sm font-bold text-foreground">{card.value}</span>{" "}
                        {t(card.label)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <div className="order-3 grid min-w-0 gap-2 lg:order-none lg:grid-cols-12 lg:gap-3 xl:min-h-0">
            <div className="min-w-0 lg:col-span-5 xl:h-full">
              <PathProgressCard compact />
            </div>
            <div className="hidden min-w-0 lg:col-span-4 lg:block xl:h-full">
              <SmartReviewCard streakDays={streakDays} compact />
            </div>
            <div className="min-w-0 lg:col-span-3 xl:h-full">
              <WeeklyFrequency
                userId={profile.id}
                daysPerWeek={profile.study_days_per_week ?? 7}
                presentation="dashboard-panel"
              />
            </div>
          </div>

          <section
            className="order-4 card-soft min-w-0 p-3 lg:order-none xl:flex xl:min-h-0 xl:flex-col xl:px-4 xl:py-3"
            aria-labelledby="quick-access-title"
          >
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="flex items-center gap-2">
                 <Bolt className="size-[1.925rem] shrink-0 text-warning" strokeWidth={2.6} aria-hidden="true" />
                 <h2 id="quick-access-title" className="font-display text-sm font-semibold">
                  {t("Quick Access")}
                </h2>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:min-h-0 xl:flex-1 xl:grid-cols-6 xl:gap-3">
              {quickAccess.map((item) => {
                const hasNew = Boolean(
                  (indicators as Record<string, boolean>)[item.to.replace("/", "")],
                );
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="dashboard-quick-link group relative grid min-h-7 min-w-0 grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md border-0 px-2 py-1 text-foreground transition-[filter,transform] hover:brightness-110 lg:hover:-translate-y-0.5 xl:h-full xl:min-h-12 xl:grid-cols-[3rem_minmax(0,1fr)_auto] xl:px-3.5 xl:py-2"
                  >
                    {hasNew && (
                      <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand-green">
                        <span className="sr-only">{t("New activity available")}</span>
                      </span>
                    )}
                     <span className="dashboard-quick-icon grid shrink-0 place-items-center">
                       <item.icon className="size-4 xl:size-[1.65rem]" strokeWidth={2.4} />
                    </span>
                    <span className="truncate text-xs font-medium">{t(item.label)}</span>
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
