import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { CelebrationBurst } from "@/components/CelebrationBurst";
import { AppShell } from "@/components/AppShell";
import { CoachSection } from "@/components/life/CoachSection";
import { DecisionsWorkspace } from "@/components/life/Decisions";
import { FocusSection } from "@/components/life/FocusSection";
import { GoalsSection } from "@/components/life/GoalsSection";
import { HabitsSection } from "@/components/life/HabitsSection";
import { LifeHeader, LifePremiumGate, useLifeT } from "@/components/life/LifeNav";
import { RoutineSection } from "@/components/life/RoutineSection";
import { LifeToday } from "@/components/life/LifeToday";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  // Today and Planning stay together on the left; Decisions has a
  // dedicated right-hand column in the lower workspace.
  const [tab, setTab] = useState<"today" | "plan">(() => {
    if (typeof window === "undefined") return "today";
    if (["#goals", "#routine", "#habits"].includes(window.location.hash)) return "plan";
    return "today";
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
        {/* Same shapes as the page, one screen tall from xl like it (owner
            report, 2026-11-01: the old two rows of three boxes, with the
            footer under them, jumped into the real layout when it loaded). */}
        <div className="xl:flex xl:min-h-0 xl:flex-1 xl:flex-col" aria-busy="true">
          <LifeHeader />
          <div className="grid gap-3 lg:grid-cols-2 xl:shrink-0 xl:grid-cols-3 xl:gap-4">
            <Skeleton className="h-56 rounded-xl xl:h-[17.5rem]" />
            <Skeleton className="h-56 rounded-xl xl:h-[17.5rem]" />
            <Skeleton className="h-56 rounded-xl lg:col-span-2 xl:col-span-1 xl:h-[17.5rem]" />
          </div>
          <Skeleton className="mt-4 h-10 w-72 shrink-0 rounded-lg" />
          <div className="mt-4 grid gap-4 lg:grid-cols-5 xl:min-h-0 xl:flex-1 xl:gap-5">
            <Skeleton className="h-80 rounded-xl lg:col-span-3 xl:h-auto" />
            <Skeleton className="h-80 rounded-xl lg:col-span-2 xl:h-auto" />
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

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t("Good morning") : hour < 18 ? t("Good afternoon") : t("Good evening");
  const daySummary =
    progress.percent === 100
      ? t("You completed everything planned for today.")
      : t("You have {done} of {total} planned items completed.")
          .replace("{done}", String(progress.stepsDone + progress.tasksDone + progress.habitsDone))
          .replace(
            "{total}",
            String(progress.stepsTotal + progress.tasksTotal + progress.habitsDue),
          );

  return (
    <AppShell>
      {/* One page on desktop (owner request, 2026-11-01): from xl the page is
          one screen tall, the header and the measures keep their height and
          the tab below takes the rest, its cards scrolling inside (the Life
          Coach scrolls its messages and keeps the field in view). Shorter
          screens than 44rem, lg and phones scroll the page as before. */}
      <div className={cn("life-page-layout", tab === "plan" && "life-page-layout--planning")}>
        <LifeHeader
          briefing={{ greeting, summary: daySummary, focus: `${focusToday}/${FOCUS_DAILY_TARGET}` }}
        />
        {/* Compact one-page composition: Your day and Evolution score are
          stacked in one card; Focus and Life Coach share the same row.
          The Today, Planning and Decisions tabs remain available below. */}
        <div className="life-overview-grid grid gap-2 lg:grid-cols-2 xl:grid-cols-12 xl:items-stretch xl:gap-3">
          <section
            className="card-soft grid min-w-0 gap-2 p-2.5 sm:p-3 lg:col-span-2 xl:col-span-4 xl:grid-cols-1 xl:gap-2"
            aria-label={t("Daily overview")}
          >
            <div className="relative min-w-0 overflow-hidden">
              <div className="relative flex items-center gap-4">
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
              <dl className="relative mt-3 grid gap-1.5">
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
                <DayStat
                  label={t("Focus")}
                  done={focusToday}
                  total={FOCUS_DAILY_TARGET}
                  tone="bg-pink-400"
                />
              </dl>
            </div>
            <div className="min-w-0 border-t border-border/70 pt-2 xl:border-l-0 xl:border-t xl:pl-0 xl:pt-2">
              <GoalsSection part="score" embedded />
            </div>
          </section>
          <div className="min-w-0 lg:col-span-1 xl:col-span-3">
            <FocusSection />
          </div>
          <div className="min-w-0 lg:col-span-1 xl:col-span-5">
            {data.premium ? (
              <CoachSection />
            ) : (
              <LifePremiumGate feature="Routine, habits and Life Coach" />
            )}
          </div>
        </div>

        {/* Keep Today and Planning in the left column and place Decisions
          in the right column, matching the upper overview's two-sided layout. */}
        <div className="mt-2 grid min-w-0 items-start gap-2 xl:grid-cols-12 xl:gap-3">
          <section className="min-w-0 xl:col-span-7" aria-label={t("Today and Planning")}>
            <Tabs
              value={tab}
              onValueChange={(value) => setTab(value === "plan" ? "plan" : "today")}
              className="min-w-0"
            >
              <TabsList className="h-10 shrink-0 self-start lg:h-10">
                <TabsTrigger value="today" className="min-h-8 px-4">
                  {t("Today")}
                </TabsTrigger>
                <TabsTrigger value="plan" className="min-h-8 px-4">
                  {t("Planning")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="today" className="mt-4">
                <div className="min-w-0">
                  <LifeToday />
                </div>
              </TabsContent>
              <TabsContent value="plan" className="mt-4">
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-2 xl:gap-5">
                  <div className="flex flex-col [&>div]:flex-1">
                    <GoalsSection part="steps" />
                  </div>
                  {data.premium ? (
                    <>
                      <div className="flex flex-col [&>section]:flex-1">
                        <RoutineSection />
                      </div>
                      <div className="flex flex-col lg:col-span-2 xl:col-span-2 [&>section]:flex-1">
                        <HabitsSection />
                      </div>
                    </>
                  ) : (
                    <div className="lg:col-span-2">
                      <LifePremiumGate feature="Routine, habits and Life Coach" />
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </section>
          <section
            id="decisions"
            className="min-w-0 scroll-mt-4 xl:col-span-5"
            aria-label={t("Decisions")}
          >
            <DecisionsWorkspace variant="tab" />
          </section>
        </div>
      </div>
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
