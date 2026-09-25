import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CalendarCheck,
  Crown,
  GraduationCap,
  Headphones,
  LineChart,
  MessageSquareText,
  PenLine,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useEffect } from "react";

import { AppShell } from "@/components/AppShell";
import { DailyGoalCard } from "@/components/DailyGoalCard";
import { EvoDailyReflection } from "@/components/EvoDailyReflection";
import { getLeague, LeagueBadge } from "@/components/LeagueBadge";

import { LevelCard } from "@/components/LevelCard";
import { PathProgressCard } from "@/components/LearningPathCard";
import { NextStepCard } from "@/components/NextStepCard";
import { SmartReviewCard } from "@/components/SmartReviewCard";

import { Skeleton } from "@/components/ui/skeleton";
import { WeeklyFrequency } from "@/components/WeeklyFrequency";

import { useActivityIndicators } from "@/hooks/useActivityIndicators";
import { effectiveStreak, useProfile } from "@/hooks/useProfile";
import { useStudySnapshot } from "@/hooks/useStudyContext";
import { getLevelState } from "@/lib/level";
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

function NextLeagueStatus({ streakDays }: { streakDays: number }) {
  const { lang } = useUiLang();
  const league = getLeague(streakDays);

  if (league.nextIn === 0) {
    return (
      <p className="mt-1 text-xs font-semibold text-foreground/80">
        {lang === "pt" ? "Liga máxima alcançada" : "Top league reached"}
      </p>
    );
  }

  const nextLeagueInfo = getLeague(streakDays + league.nextIn);
  const nextLeague = nextLeagueInfo.name;
  const translatedLeague =
    lang === "pt"
      ? ({
          Silver: "Prata",
          Gold: "Ouro",
          Sapphire: "Safira",
          Ruby: "Rubi",
          Emerald: "Esmeralda",
          Amethyst: "Ametista",
          Pearl: "Pérola",
          Obsidian: "Obsidiana",
          Diamond: "Diamante",
        }[nextLeague] ?? nextLeague)
      : nextLeague;

  return (
    <p className="mt-1 text-xs font-semibold" style={{ color: nextLeagueInfo.to }}>
      {lang === "pt"
        ? `${translatedLeague} em ${league.nextIn} ${league.nextIn === 1 ? "dia" : "dias"}`
        : `${translatedLeague} in ${league.nextIn} ${league.nextIn === 1 ? "day" : "days"}`}
    </p>
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
    { to: "/study-plan", label: "My Study Plan", icon: CalendarCheck },
    { to: "/progress", label: "Progress", icon: LineChart },
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
        <div className="dashboard-one-screen grid gap-3 lg:min-h-[calc(100vh-3rem)] lg:grid-rows-[auto_auto_minmax(15rem,1fr)_auto_auto] xl:min-h-[calc(100vh-1.5rem)]">
          <header className="animate-rise grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.65fr)] lg:items-center">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{t("Welcome back")}</p>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="min-w-0 break-words text-2xl font-bold 2xl:text-3xl">
                  {t("Hello")}, {profile.name || t("student")}
                </h1>
                <WandSparkles className="size-5 shrink-0 text-success" aria-hidden="true" />
                {profile.plan === "premium" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2 py-1 text-xs font-semibold text-warning-foreground">
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
            <div className="card-soft hidden min-w-0 p-3 lg:block">
              <EvoDailyReflection
                userId={profile.id}
                name={profile.name}
                placement="dashboard-header"
              />
            </div>
          </header>

          <div className="order-1 grid min-w-0 gap-3 sm:grid-cols-2 lg:order-none lg:grid-cols-4">
            <LevelCard level={profile.level} maxLevel={profile.max_level} compact />

            <div className="card-soft flex min-w-0 flex-col justify-center p-3">
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-success/15">
                  <Calendar className="size-4 text-success" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold">{streakDays} days</p>
                  <p className="text-xs text-muted-foreground">{t("Study streak")}</p>
                  <NextLeagueStatus streakDays={streakDays} />
                </div>
                <LeagueBadge
                  streakDays={streakDays}
                  label={getLevelState(profile.level).current.value.toUpperCase()}
                />
              </div>
            </div>

            <DailyGoalCard userId={profile.id} goalMinutes={profile.daily_minutes} compact />
            <div className="card-soft min-w-0 p-3">
              <WeeklyFrequency
                userId={profile.id}
                daysPerWeek={profile.study_days_per_week ?? 7}
                compact
              />
            </div>
          </div>

          <section className="order-2 min-h-[19rem] lg:order-none lg:min-h-[15rem] [@media(min-height:850px)]:lg:min-h-[19rem]">
            <NextStepCard compact />
          </section>

          <div className="order-3 grid min-w-0 gap-3 lg:order-none lg:grid-cols-12">
            <section
              className="card-soft min-w-0 p-3 lg:col-span-4"
              aria-labelledby="today-progress-title"
            >
              <h2 id="today-progress-title" className="text-sm font-semibold">
                {t("Today's Progress")}
              </h2>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {learningCards.map((card) => (
                  <div key={card.label} className="min-w-0 rounded-md bg-secondary p-2 text-center">
                    <span className="text-base" aria-hidden="true">
                      {card.emoji}
                    </span>
                    <p className="text-sm font-bold">{card.value}</p>
                    <p className="line-clamp-2 text-[10px] text-muted-foreground">
                      {t(card.label)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
            <div className="min-w-0 lg:col-span-4">
              <PathProgressCard compact />
            </div>
            <div className="min-w-0 lg:col-span-4">
              <SmartReviewCard streakDays={streakDays} compact />
            </div>
          </div>

          <section
            className="order-4 card-soft min-w-0 p-3 lg:order-none"
            aria-labelledby="quick-access-title"
          >
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <h2 id="quick-access-title" className="text-sm font-semibold">
                {t("Quick Access")}
              </h2>
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
              {quickAccess.map((item) => {
                const hasNew = Boolean(
                  (indicators as Record<string, boolean>)[item.to.replace("/", "")],
                );
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="group relative grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 rounded-md border border-border bg-background px-2 py-2 transition-colors hover:bg-accent"
                  >
                    {hasNew && (
                      <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-success">
                        <span className="sr-only">{t("New activity available")}</span>
                      </span>
                    )}
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary">
                      <item.icon className="size-4 text-primary" />
                    </span>
                    <span className="truncate text-xs font-medium">{t(item.label)}</span>
                  </Link>
                );
              })}
            </div>
          </section>

          <div className="order-5 lg:hidden">
            <EvoDailyReflection userId={profile.id} name={profile.name} placement="mobile-card" />
          </div>
        </div>
      )}
    </AppShell>
  );
}
