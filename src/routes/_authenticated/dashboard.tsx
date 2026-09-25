import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Bolt,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Crown,
  Flame,
  GraduationCap,
  Headphones,
  MessageSquareText,
  PenLine,
  Sparkles,
  WandSparkles,
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
        <div className="dashboard-one-screen grid gap-2.5 xl:gap-2">
          <header className="animate-rise grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.65fr)] lg:items-center xl:h-[4.5rem]">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{t("Welcome back")}</p>
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap">
                <h1 className="min-w-0 truncate text-2xl font-bold 2xl:text-3xl">
                  {t("Hello")}, {profile.name || t("student")}
                </h1>
                <div className="flex shrink-0 items-center gap-2">
                  <WandSparkles className="size-5 shrink-0 text-brand-green" aria-hidden="true" />
                  {profile.plan === "premium" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-warning px-2 py-1 text-xs font-bold text-warning-foreground shadow-sm">
                      <Crown className="size-3.5 text-warning" /> Premium
                    </span>
                  ) : (
                    <Link
                      to="/premium"
                      className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground/80 transition-colors hover:bg-accent"
                    >
                      <Crown className="size-3.5 text-warning" /> {t("Go Premium")}
                    </Link>
                  )}
                </div>
              </div>
            </div>
            <div className="card-soft hidden min-w-0 p-3 lg:block">
              <EvoDailyReflection
                userId={profile.id}
                name={profile.name}
                placement="dashboard-header"
              />
            </div>
          </header>

          <div className="order-5 card-soft grid min-w-0 overflow-hidden sm:grid-cols-2 lg:order-none lg:grid-cols-4 xl:h-[5.25rem] [&>*+*]:border-border sm:[&>*+*]:border-l">
            <LevelCard level={profile.level} maxLevel={profile.max_level} compact />

            <div className="flex min-w-0 flex-col justify-center px-3 py-2">
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-dashboard-coral/10">
                  <Flame className="size-5 text-dashboard-coral" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold">{streakDays} days</p>
                  <p className="text-xs text-muted-foreground">{t("Study streak")}</p>
                </div>
              </div>
            </div>

            <DailyGoalCard userId={profile.id} goalMinutes={profile.daily_minutes} compact />
            <WeeklyFrequency userId={profile.id} daysPerWeek={profile.study_days_per_week ?? 7} presentation="summary" />
          </div>

          <div className="order-1 grid min-w-0 gap-3 lg:order-none lg:grid-cols-12">
            <section className="min-w-0 lg:col-span-9">
              <NextStepCard compact />
            </section>
            <section
              className="card-soft min-w-0 p-3 lg:col-span-3"
              aria-labelledby="today-progress-title"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="size-4 text-dashboard-cyan" />
                <h2 id="today-progress-title" className="text-sm font-semibold">
                  {t("Today's Progress")}
                </h2>
              </div>
              <div className="mt-3 grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3 lg:grid-cols-1 xl:grid-cols-[6rem_minmax(0,1fr)]">
                <div className="relative grid size-24 place-items-center text-brand-green lg:mx-auto xl:mx-0">
                  <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 96 96" aria-hidden="true">
                    <circle cx="48" cy="48" r="39" fill="none" stroke="var(--secondary)" strokeWidth="10" />
                    <circle cx="48" cy="48" r="39" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeDasharray={2 * Math.PI * 39} strokeDashoffset={2 * Math.PI * 39 * (1 - Math.min(1, minutesToday / Math.max(profile.daily_minutes, 1)))} />
                  </svg>
                  <span className="relative text-center text-xl font-bold leading-none text-foreground">
                    {minutesToday}
                    <span className="mt-1 block text-[10px] font-medium text-muted-foreground">min</span>
                  </span>
                </div>
                <div className="grid gap-2">
                {learningCards.map((card) => (
                  <div
                    key={card.label}
                    className="grid min-w-0 grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-2"
                  >
                    <CheckCircle2 className="size-5 text-brand-green" aria-hidden="true" />
                    <p className="line-clamp-2 text-[10px] text-muted-foreground">
                      <span className="font-bold text-foreground">{card.value}</span> {t(card.label)}
                    </p>
                  </div>
                ))}
                </div>
              </div>
            </section>
          </div>

          <div className="order-2 grid min-w-0 gap-3 lg:order-none lg:grid-cols-12">
            <div className="min-w-0 lg:col-span-5">
              <PathProgressCard compact />
            </div>
            <div className="min-w-0 lg:col-span-4">
              <SmartReviewCard streakDays={streakDays} compact />
            </div>
            <div className="min-w-0 lg:col-span-3">
              <WeeklyFrequency userId={profile.id} daysPerWeek={profile.study_days_per_week ?? 7} presentation="dashboard-panel" />
            </div>
          </div>

          <section
            className="order-3 card-soft min-w-0 p-3 lg:order-none xl:p-2"
            aria-labelledby="quick-access-title"
          >
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="flex items-center gap-2">
                <Bolt className="size-5 fill-warning text-warning" aria-hidden="true" />
                <h2 id="quick-access-title" className="text-sm font-semibold">
                  {t("Quick Access")}
                </h2>
              </div>
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {quickAccess.map((item) => {
                const hasNew = Boolean(
                  (indicators as Record<string, boolean>)[item.to.replace("/", "")],
                );
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="dashboard-quick-link group relative grid min-h-12 min-w-0 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md border px-2 py-2 text-foreground shadow-sm transition-[filter,transform] hover:brightness-110 lg:hover:-translate-y-0.5"
                  >
                    {hasNew && (
                      <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-success">
                        <span className="sr-only">{t("New activity available")}</span>
                      </span>
                    )}
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-background/45">
                      <item.icon className="size-4 text-foreground" />
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
