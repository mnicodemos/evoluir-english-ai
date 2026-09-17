import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Crown,
  GraduationCap,
  Headphones,
  LineChart,
  MessageSquareText,
  PenLine,
} from "lucide-react";
import { useEffect } from "react";

import { AppShell } from "@/components/AppShell";
import { DailyGoalCard } from "@/components/DailyGoalCard";
import { getLeague, LeagueBadge } from "@/components/LeagueBadge";
import { LeagueReportButton } from "@/components/LeagueReportButton";

import { LevelCard } from "@/components/LevelCard";
import { PathProgressCard } from "@/components/LearningPathCard";

import { Skeleton } from "@/components/ui/skeleton";
import { WeeklyFrequency } from "@/components/WeeklyFrequency";

import { effectiveStreak, useProfile } from "@/hooks/useProfile";
import { useStudySnapshot } from "@/hooks/useStudyContext";
import { supabase } from "@/integrations/supabase/client";
import { getLevelState } from "@/lib/level";
import { useUiLang } from "@/lib/uiLang";



export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · Dashboard" },
      { name: "description", content: "Your daily English plan, streak and skill scores in one place." },
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
    return <p className="mt-1 text-xs font-semibold text-foreground/80">{lang === "pt" ? "Liga máxima alcançada" : "Top league reached"}</p>;
  }

  const nextLeagueInfo = getLeague(streakDays + league.nextIn);
  const nextLeague = nextLeagueInfo.name;
  const translatedLeague = lang === "pt"
    ? ({ Silver: "Prata", Gold: "Ouro", Sapphire: "Safira", Ruby: "Rubi", Emerald: "Esmeralda", Amethyst: "Ametista", Pearl: "Pérola", Obsidian: "Obsidiana", Diamond: "Diamante" }[nextLeague] ?? nextLeague)
    : nextLeague;

  return (
    <p
      className="mt-1 whitespace-nowrap text-xs font-semibold"
      style={{ color: nextLeagueInfo.to }}
    >
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
  const streakDays = profile ? effectiveStreak(profile) : 0;

  useEffect(() => {
    if (profile && !profile.onboarding_completed) navigate({ to: "/onboarding", replace: true });
  }, [profile, navigate]);

  const { data: recent } = useQuery({
    queryKey: ["activities-recent", profile?.id, profile?.level],
    enabled: !!profile,
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select("*")
        .eq("level", profile!.level)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });


  const trainingCards = [
    { to: "/learning", label: "Learning Center", text: "Lessons, videos, flashcards and quizzes", icon: GraduationCap, className: "sm:col-span-2" },
    { to: "/coach", label: "AI Talking", text: "Speak and get a scored report", icon: MessageSquareText, className: "xl:h-full" },
    { to: "/listening", label: "Listening Lab", text: "Train your ear with dictation drills", icon: Headphones, className: "xl:h-full" },
    { to: "/writing", label: "Writing", text: "Correct any text instantly", icon: PenLine, className: "xl:h-full" },
    { to: "/vocabulary", label: "Vocabulary", text: "Learn and review words", icon: BookOpen, className: "xl:h-full" },
  ] as const;

  const historyCard = { to: "/progress", label: "My history", text: "See how far you came", icon: LineChart, className: "sm:col-span-2" } as const;




  const learningCards = [
    { emoji: "📚", label: "Lessons completed", value: `${snapshot?.lessonsCompleted ?? 0}` },
    { emoji: "🎬", label: "Videos watched", value: `${snapshot?.videosWatched ?? 0}` },
    { emoji: "🧠", label: "Vocabulary mastered", value: `${snapshot?.vocabularyMastered ?? 0}` },
    { emoji: "🎯", label: "Quiz score", value: `${snapshot?.quizAverage ?? 0}%` },
  ];

  return (
    <AppShell>
      {isLoading || !profile ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : (
        <div className="space-y-5 lg:space-y-6">
          <header className="animate-rise">
            <p className="text-sm text-muted-foreground">Welcome back</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">
                <span>Hello</span>, {profile.name || "student"} 👋
              </h1>
              {profile.plan === "premium" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[oklch(0.95_0.06_85)] px-3 py-1 text-xs font-semibold text-[oklch(0.45_0.12_75)]">
                  <Crown className="size-3.5 text-[oklch(0.78_0.18_82)]" /> Premium
                </span>
              ) : (
                <Link
                  to="/premium"
                  className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground/80 transition-colors hover:bg-accent"
                >
                  <Crown className="size-3.5 text-[oklch(0.78_0.18_82)]" /> Go Premium
                </Link>
              )}
            </div>
          </header>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card-soft flex flex-col justify-center p-5">
              <div className="flex items-center gap-4">
                <span className="grid size-12 place-items-center rounded-xl bg-[oklch(0.96_0.05_75)]">
                  <Calendar className="size-6 text-[oklch(0.62_0.16_50)]" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="whitespace-nowrap text-lg font-bold sm:text-base md:text-lg">{streakDays} days</p>
                  <p className="text-base text-muted-foreground sm:text-sm">Study streak</p>
                  <NextLeagueStatus streakDays={streakDays} />
                </div>
                <LeagueBadge
                  streakDays={streakDays}
                  label={getLevelState(profile.level).current.value.toUpperCase()}
                />
              </div>
              <LeagueReportButton
                userId={profile.id}
                name={profile.name}
                level={profile.level}
                streakDays={streakDays}
              />
            </div>


            <DailyGoalCard userId={profile.id} goalMinutes={profile.daily_minutes} />

            <LevelCard level={profile.level} maxLevel={profile.max_level} />
          </div>

          <div className="grid gap-5 xl:grid-cols-2 xl:items-stretch">
            <PathProgressCard />

            <section className="min-w-0 xl:flex xl:flex-col">
              <h2 className="text-lg font-semibold">Keep training</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:flex-1 xl:grid-rows-[auto_auto_minmax(7rem,1fr)]">
                {trainingCards.map((c) => (
                  <Link
                    key={`link-${c.to}`}
                    to={c.to}
                    className={`card-soft group flex min-h-20 items-center gap-4 p-4 transition-shadow hover:shadow-[var(--shadow-lift)] ${c.className ?? ""}`}
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary">
                      <c.icon className="size-5 text-[oklch(0.45_0.11_255)]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{c.label}</span>
                      <span className="block text-sm text-muted-foreground">{c.text}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </Link>
                ))}
              </div>
            </section>

            <section className="min-w-0">
              <h2 className="text-lg font-semibold">Learning progress</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {learningCards.map((c) => (
                  <div key={c.label} className="card-soft p-4">
                    <span className="text-xl">{c.emoji}</span>
                    <p className="mt-1 text-xl font-bold">{c.value}</p>
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="flex min-w-0 flex-col xl:grid xl:grid-rows-[auto_1fr_auto]">
              <h2 className="text-lg font-semibold">Performance</h2>
              <Link
                to={historyCard.to}
                className="card-soft group mt-3 flex min-h-24 flex-1 items-center gap-4 p-5 transition-shadow hover:shadow-[var(--shadow-lift)] xl:w-full"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-secondary">
                  <historyCard.icon className="size-5 text-[oklch(0.45_0.11_255)]" />
                </span>
                <span className="flex-1">
                  <span className="block font-medium">{historyCard.label}</span>
                  <span className="block text-sm text-muted-foreground">{historyCard.text}</span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </Link>
              <div className="card-soft mt-3 w-full p-5">
                <WeeklyFrequency userId={profile.id} />
              </div>
            </section>

          </div>


          {recent && recent.length > 0 && (
            <section className="card-soft p-6">
              <h2 className="text-lg font-semibold">Recent activity</h2>
              <ul className="mt-4 divide-y divide-border">
                {recent.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-3 text-sm">
                    <span>
                      <span className="block font-medium">
                        {(a.title || a.activity_type || "").startsWith("Lesson: ") ? (
                          <>
                            <span>Lesson:</span> {(a.title as string).slice(8)}
                          </>
                        ) : (
                          a.title || a.activity_type
                        )}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString()} · {a.duration_minutes} min
                      </span>
                    </span>
                    {a.score != null && (
                      <span className="font-semibold text-[oklch(0.55_0.14_158)]">{a.score}%</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}
