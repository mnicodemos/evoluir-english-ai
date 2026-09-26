import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Bolt,
  BookOpen,
  CalendarCheck,
  Check,
  ChevronRight,
  Flame,
  GraduationCap,
  Headphones,
  MessageSquareText,
  PenLine,
  Sparkles,
} from "lucide-react";
import { useEffect } from "react";

import { AppShell } from "@/components/AppShell";
import { DailyGoalCard, useMinutesToday } from "@/components/DailyGoalCard";
import { EvoDailyReflection } from "@/components/EvoDailyReflection";
import { LevelCard } from "@/components/LevelCard";
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
  const { data: minutesToday = 0 } = useMinutesToday(profile?.id);

  useEffect(() => {
    if (profile && !profile.onboarding_completed) navigate({ to: "/onboarding", replace: true });
  }, [profile, navigate]);

  const quickAccess = [
    {
      to: "/learning",
      label: "Learning Center",
      icon: GraduationCap,
    },
    { to: "/vocabulary", label: "Vocabulary", icon: BookOpen },
    { to: "/listening", label: "Listening", icon: Headphones },
    {
      to: "/coach",
      label: "AI Talking",
      icon: MessageSquareText,
    },
    { to: "/writing", label: "Writing", icon: PenLine },
    { to: "/teacher", label: "AI Teacher", icon: Sparkles },
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
        <div className="dashboard-one-screen grid gap-2.5 xl:h-[calc(100vh-1rem)] xl:grid-rows-[4rem_5.75rem_minmax(13.5rem,1.35fr)_minmax(12rem,1fr)_minmax(5.5rem,0.55fr)] xl:gap-2.5">
          <header className="animate-rise min-w-0 xl:h-16">
            <EvoDailyReflection
              userId={profile.id}
              name={profile.name}
              placement="dashboard-header"
            />
          </header>

          <div className="order-5 card-soft grid min-w-0 overflow-hidden sm:grid-cols-2 lg:order-none lg:grid-cols-4 xl:h-[5.75rem] [&>*+*]:border-border sm:[&>*+*]:border-l">
            <LevelCard level={profile.level} maxLevel={profile.max_level} compact />

            <div className="flex min-w-0 items-center gap-3 px-3 py-2">
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-dashboard-coral/10">
                 <Flame
                   className="size-7 fill-dashboard-coral text-dashboard-coral"
                   strokeWidth={2.1}
                 />
              </span>
              <div className="min-w-0 flex-1">
                 <p className="truncate font-display text-base font-bold">{streakDays} days</p>
                <p className="text-xs text-muted-foreground">{t("Study streak")}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </div>

            <DailyGoalCard userId={profile.id} goalMinutes={profile.daily_minutes} compact />
            <WeeklyFrequency
              userId={profile.id}
              daysPerWeek={profile.study_days_per_week ?? 7}
              presentation="summary"
            />
          </div>

          <div className="order-1 grid min-w-0 gap-3 lg:order-none lg:grid-cols-12 xl:min-h-0">
            <section className="min-w-0 lg:col-span-9 xl:h-full">
              <NextStepCard compact />
            </section>
            <section
              className="card-soft min-w-0 p-3 lg:col-span-3 xl:h-full xl:p-4"
              aria-labelledby="today-progress-title"
            >
              <div className="flex items-center gap-2">
                 <span className="grid size-9 place-items-center rounded-md bg-dashboard-blue/15 text-dashboard-cyan">
                   <Flame className="size-5" strokeWidth={2.5} />
                </span>
                 <h2 id="today-progress-title" className="font-display text-sm font-semibold">
                  {t("Today's Progress")}
                </h2>
                <ChevronRight className="ml-auto size-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="mt-3 grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3 lg:grid-cols-1 xl:h-[calc(100%-2rem)] xl:grid-cols-[7rem_minmax(0,1fr)] xl:gap-4">
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
                      className="grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-2.5"
                    >
                      <span className="grid size-6 place-items-center rounded-full bg-brand-green text-primary-foreground">
                        <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                      </span>
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

          <div className="order-2 grid min-w-0 gap-3 lg:order-none lg:grid-cols-12 xl:min-h-0">
            <div className="min-w-0 lg:col-span-5 xl:h-full">
              <PathProgressCard compact />
            </div>
            <div className="min-w-0 lg:col-span-4 xl:h-full">
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
            className="order-3 card-soft min-w-0 p-3 lg:order-none xl:flex xl:min-h-0 xl:flex-col xl:p-4"
            aria-labelledby="quick-access-title"
          >
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="flex items-center gap-2">
                 <span className="grid size-9 place-items-center text-warning">
                   <Bolt className="size-7 text-warning" strokeWidth={2.6} aria-hidden="true" />
                </span>
                 <h2 id="quick-access-title" className="font-display text-sm font-semibold">
                  {t("Quick Access")}
                </h2>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
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
                    className="dashboard-quick-link group relative grid min-h-14 min-w-0 grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-md border px-2.5 py-2 text-foreground shadow-sm transition-[filter,transform] hover:brightness-110 lg:hover:-translate-y-0.5 xl:h-full xl:grid-cols-[3rem_minmax(0,1fr)_auto] xl:px-3.5"
                  >
                    {hasNew && (
                      <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-success">
                        <span className="sr-only">{t("New activity available")}</span>
                      </span>
                    )}
                     <span className="dashboard-quick-icon grid size-9 shrink-0 place-items-center rounded-md xl:size-11">
                       <item.icon className="size-5 xl:size-6" strokeWidth={2.4} />
                    </span>
                    <span className="truncate text-xs font-medium">{t(item.label)}</span>
                    <ArrowRight className="size-3.5 text-foreground/65" aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          </section>

          <Link
            to="/study-plan"
            className="order-4 grid min-h-14 min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-card-foreground shadow-[var(--shadow-soft)] transition-colors hover:bg-accent lg:hidden"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary">
              <CalendarCheck className="size-5 text-primary" aria-hidden="true" />
            </span>
            <span className="min-w-0 truncate text-sm font-semibold">{t("My Study Plan")}</span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>

          <div className="order-6 lg:hidden">
            <EvoDailyReflection userId={profile.id} name={profile.name} placement="mobile-card" />
          </div>
        </div>
      )}
    </AppShell>
  );
}
