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
import { openDecisionCount } from "@/lib/lifeDecisions";
import { loadLifeDecisions } from "@/lib/lifeDecisions.functions";
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

  // Decisions sit in their own tab (owner request, 2026-11-01: students
  // forgot the header capsule); the tab counts the decisions still open.
  const loadDecisions = useServerFn(loadLifeDecisions);
  const { data: decisions } = useQuery({
    queryKey: ["life-decisions", profile?.id ?? null],
    enabled: !!profile,
    queryFn: () => loadDecisions(),
    staleTime: 30 * 1000,
  });
  const openDecisions =
    decisions?.premium && decisions.available ? openDecisionCount(decisions.decisions) : 0;

  // The planning addresses (#goals, #routine, #habits) open the Plan tab,
  // #decisions the Decisions tab.
  const [tab, setTab] = useState<"today" | "plan" | "decisions">(() => {
    if (typeof window === "undefined") return "today";
    if (["#goals", "#routine", "#habits"].includes(window.location.hash)) return "plan";
    if (window.location.hash === "#decisions") return "decisions";
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
      <AppShell desktopOneScreen>
        {/* Same shapes as the page, one screen tall from xl like it (owner
            report, 2026-11-01: the old two rows of three boxes, with the
            footer under them, jumped into the real layout when it loaded). */}
        <div className="xl:flex xl:min-h-0 xl:flex-1 xl:flex-col" aria-busy="true">
          <LifeHeader />
          <div className="grid gap-4 lg:grid-cols-2 xl:shrink-0 xl:grid-cols-3 xl:gap-5">
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

  return (
    <AppShell desktopOneScreen>
      {/* One page on desktop (owner request, 2026-11-01): from xl the page is
          one screen tall, the header and the measures keep their height and
          the tab below takes the rest, its cards scrolling inside (the Life
          Coach scrolls its messages and keeps the field in view). Shorter
          screens than 44rem, lg and phones scroll the page as before. */}
      <div className="xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
        <LifeHeader />
        {/* Four bands (user request, 2026-10-22): the measures on top (Your
          day, Evolution score, Focus), then Today and Plan (the priority of
          the day was removed, user decision 2026-10-24), then the
          meditations. Phones stack everything in this order. */}
        <div className="grid gap-4 lg:grid-cols-2 xl:shrink-0 xl:grid-cols-3 xl:gap-5">
          <section
            className="card-soft relative overflow-hidden p-4 sm:p-5"
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

        {/* Today and Plan (user request, 2026-10-24: a new student should feel
          a professional app): Today is one list of what to do now (goal
          steps, tasks, habits) beside the Life Coach; Plan holds the three
          tools to set them up. Old #goals, #routine and #habits addresses
          open Plan. Free students get the goal steps and the Premium
          invitation. */}
        <Tabs
          value={tab}
          onValueChange={(value) =>
            setTab(value === "plan" || value === "decisions" ? value : "today")
          }
          className="mt-4 xl:mt-4 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:gap-0"
        >
          <TabsList className="h-10 shrink-0 self-start lg:h-10">
            <TabsTrigger value="today" className="min-h-8 px-4">
              {t("Today")}
            </TabsTrigger>
            <TabsTrigger value="plan" className="min-h-8 px-4">
              {t("Planning")}
            </TabsTrigger>
            <TabsTrigger value="decisions" className="min-h-8 gap-1.5 px-4">
              {t("Decisions")}
              {openDecisions > 0 ? (
                <span
                  className="grid min-w-5 place-items-center rounded-full bg-violet-400/20 px-1.5 text-[11px] font-semibold tabular-nums text-violet-200"
                  aria-label={`${openDecisions} ${t("open")}`}
                >
                  {openDecisions}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="today" className="mt-4 xl:min-h-0 xl:flex-1">
            <div className="grid gap-4 lg:grid-cols-5 xl:h-full xl:gap-5">
              <div className="flex flex-col lg:col-span-3 xl:min-h-0 [&>section]:flex-1 xl:[&>section]:min-h-0 xl:[&>section]:overflow-y-auto xl:[&>section]:scroll-quiet">
                <LifeToday />
              </div>
              <div className="flex flex-col lg:col-span-2 xl:min-h-0 [&>section]:flex-1 xl:[&>section]:min-h-0 xl:[&>section]:overflow-y-auto xl:[&>section]:scroll-quiet">
                {data.premium ? (
                  <CoachSection />
                ) : (
                  <LifePremiumGate feature="Routine, habits and Life Coach" />
                )}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="plan" className="mt-4 xl:min-h-0 xl:flex-1">
            <div className="grid gap-4 lg:grid-cols-2 xl:h-full xl:grid-cols-3 xl:gap-5">
              <div className="flex flex-col xl:min-h-0 [&>div]:flex-1 xl:[&>div]:min-h-0 xl:[&>div>section]:min-h-0 xl:[&>div>section]:overflow-y-auto xl:[&>div>section]:scroll-quiet xl:min-h-0">
                <GoalsSection part="steps" />
              </div>
              {data.premium ? (
                <>
                  <div className="flex flex-col xl:min-h-0 [&>section]:flex-1 xl:[&>section]:min-h-0 xl:[&>section]:overflow-y-auto xl:[&>section]:scroll-quiet">
                    <RoutineSection />
                  </div>
                  <div className="flex flex-col lg:col-span-2 xl:col-span-1 xl:min-h-0 [&>section]:flex-1 xl:[&>section]:min-h-0 xl:[&>section]:overflow-y-auto xl:[&>section]:scroll-quiet">
                    <HabitsSection />
                  </div>
                </>
              ) : (
                <div className="xl:col-span-2 xl:min-h-0 xl:overflow-y-auto xl:scroll-quiet">
                  <LifePremiumGate feature="Routine, habits and Life Coach" />
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent
            value="decisions"
            id="decisions"
            className="scroll-quiet mt-4 scroll-mt-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1"
          >
            <DecisionsWorkspace variant="tab" />
          </TabsContent>
        </Tabs>
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
