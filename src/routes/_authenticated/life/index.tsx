import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";

import { CelebrationBurst } from "@/components/CelebrationBurst";
import { AppShell } from "@/components/AppShell";
import { CoachSection } from "@/components/life/CoachSection";
import { FocusSection } from "@/components/life/FocusSection";
import { GoalsSection } from "@/components/life/GoalsSection";
import { HabitsSection } from "@/components/life/HabitsSection";
import { MeditationSection } from "@/components/life/MeditationSection";
import { LifeHeader, LifePremiumGate, useLifeT } from "@/components/life/LifeNav";
import { RoutineSection } from "@/components/life/RoutineSection";
import { Skeleton } from "@/components/ui/skeleton";
import { useCelebrate } from "@/hooks/useCelebrate";
import { useFocusLog } from "@/hooks/useFocusLog";
import { useLife } from "@/hooks/useLife";
import { useProfile } from "@/hooks/useProfile";
import { FOCUS_DAILY_TARGET, focusSummary, lifeDayProgress } from "@/lib/life";
import { loadPlus } from "@/lib/plus.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/life/")({
  head: () => ({
    meta: [
      { title: "Life+ AI - Evoluir+ English AI" },
      {
        name: "description",
        content: "Your goals, routine and habits in one place. Evolve one day at a time.",
      },
    ],
  }),
  component: LifePage,
});

/**
 * Life+ AI on one page (user request: one page instead of tabs): the day on
 * top, then Goals, Routine with Habits, and the Life Coach
 * side by side on desktop, stacked on phones. Old tab addresses (/goals,
 * /life/routine, /life/habits, /life/coach) open this page at their section.
 */
function LifePage() {
  const { t, lang } = useLifeT();
  const { data: profile } = useProfile();
  const { data, isLoading } = useLife();
  const focusLog = useFocusLog();
  const loadSteps = useServerFn(loadPlus);
  // Same query as the Goals section, for the day ring's goal steps.
  const { data: plus } = useQuery({
    queryKey: ["plus", profile?.id ?? null, lang],
    enabled: !!profile,
    queryFn: () => loadSteps({ data: { lang } }),
    staleTime: 30 * 1000,
  });

  // Old tab addresses arrive with #goals, #routine, #habits or #coach: scroll
  // there once the sections exist (they render after the data loads).
  const ready = !!data;
  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [ready]);

  if (isLoading || !data) {
    return (
      <AppShell>
        <LifeHeader />
        {/* Same shapes as the page (user request: no spinner, no jump). */}
        <div className="space-y-4" aria-busy="true">
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-56 rounded-xl" />
            <Skeleton className="h-56 rounded-xl" />
            <Skeleton className="hidden h-56 rounded-xl xl:block" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="hidden h-80 rounded-xl xl:block" />
          </div>
        </div>
      </AppShell>
    );
  }

  const focusToday = focusSummary(focusLog, data.today).todayCount;
  const progress = lifeDayProgress({
    today: data.today,
    tasks: data.tasks,
    habits: data.habits,
    logs: data.logs,
    goalSteps: plus?.todaySteps ?? [],
  });

  return (
    <AppShell>
      <LifeHeader />
      {/* Four bands (user request, 2026-10-22): the measures on top (Your
          day, Evolution score, Focus), then the day's plan (goal steps,
          tasks and habits; the priority of the day was removed, user
          decision 2026-10-24), the meditations, and last the Life Coach.
          Phones stack everything in this order. */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3 xl:gap-5">
        <section
          className="card-soft relative overflow-hidden p-4 sm:p-5 xl:p-6"
          aria-label={t("Your day")}
        >
          <div
            className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-brand-green/10 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative flex items-center gap-5">
            <DayRing percent={progress.percent} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-green">
                {t("Your day")}
              </p>
              <h2 className="mt-0.5 font-display text-lg font-semibold leading-tight">
                {progress.percent === 100
                  ? t("Everything done today!")
                  : t("Keep going, one step at a time.")}
              </h2>
            </div>
          </div>
          <dl className="relative mt-4 grid gap-2">
            <DayStat
              label={t("Goal steps")}
              done={progress.stepsDone}
              total={progress.stepsTotal}
              tone="bg-brand-green"
            />
            {data.premium ? (
              <>
                <DayStat
                  label={t("Tasks")}
                  done={progress.tasksDone}
                  total={progress.tasksTotal}
                  tone="bg-sky-400"
                />
                <DayStat
                  label={t("Habits")}
                  done={progress.habitsDone}
                  total={progress.habitsDue}
                  tone="bg-violet-400"
                />
              </>
            ) : null}
            {/* Focus blocks of today (free): the bar fills at four. */}
            <DayStat
              label={t("Focus")}
              done={focusToday}
              total={FOCUS_DAILY_TARGET}
              tone="bg-pink-400"
            />
          </dl>
        </section>
        <div className="flex flex-col [&>div]:flex-1">
          <GoalsSection part="score" />
        </div>
        <div className="flex flex-col lg:col-span-2 xl:col-span-1 [&>section]:flex-1">
          <FocusSection />
        </div>
      </div>

      {/* The day's three lists side by side, from the most important (the
          goal steps, which count for the streak) to the lightest (user
          request, 2026-10-24: one place answers "what do I do today?").
          Free students get their free goal steps first, beside the Premium
          invitation. */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:mt-5 xl:grid-cols-3 xl:gap-5">
        <div className="flex flex-col [&>div]:flex-1">
          <GoalsSection part="steps" />
        </div>
        {data.premium ? (
          <>
            <div className="flex flex-col [&>section]:flex-1">
              <RoutineSection />
            </div>
            <div className="flex flex-col lg:col-span-2 xl:col-span-1 [&>section]:flex-1">
              <HabitsSection />
            </div>
          </>
        ) : (
          <div className="xl:col-span-2">
            <LifePremiumGate feature="Routine, habits and Life Coach" />
          </div>
        )}
      </div>

      <div className="mt-4 xl:mt-5">
        <MeditationSection />
      </div>

      {data.premium ? (
        <div className="mt-4 xl:mt-5">
          <CoachSection />
        </div>
      ) : null}
    </AppShell>
  );
}

function DayRing({ percent }: { percent: number | null }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  // The whole day done: the ring pops once today (user request).
  const celebrate = useCelebrate("life-day", percent === 100);
  return (
    <div
      className={cn(
        "relative grid size-24 shrink-0 place-items-center sm:size-28",
        celebrate && "animate-celebrate",
      )}
    >
      <CelebrationBurst active={celebrate} />
      <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth="7"
          className="stroke-white/[0.08]"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          className="stroke-brand-green transition-[stroke-dashoffset] duration-700"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - (percent ?? 0) / 100)}
        />
      </svg>
      <span className="font-display text-2xl font-bold tabular-nums">
        {percent === null ? "—" : `${percent}%`}
      </span>
    </div>
  );
}

/** One part of the day: its name, n/m and a thin bar in the part's colour. */
function DayStat({
  label,
  done,
  total,
  tone,
}: {
  label: string;
  done: number;
  total: number;
  tone: string;
}) {
  const share = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)_auto] items-center gap-3 text-xs">
      <dt className="truncate text-muted-foreground">{label}</dt>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden="true">
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", tone)}
          style={{ width: `${share}%` }}
        />
      </div>
      <dd className="font-semibold tabular-nums">
        {done}/{total}
      </dd>
    </div>
  );
}
