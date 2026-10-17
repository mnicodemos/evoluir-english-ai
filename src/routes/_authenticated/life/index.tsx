import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CelebrationBurst } from "@/components/CelebrationBurst";
import { AppShell } from "@/components/AppShell";
import { CoachSection } from "@/components/life/CoachSection";
import { FocusSection } from "@/components/life/FocusSection";
import { GoalsSection } from "@/components/life/GoalsSection";
import { HabitsSection } from "@/components/life/HabitsSection";
import { MeditationSection } from "@/components/life/MeditationSection";
import { LifeHeader, LifePremiumGate, LifeSectionTitle, useLifeT } from "@/components/life/LifeNav";
import { RoutineSection } from "@/components/life/RoutineSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCelebrate } from "@/hooks/useCelebrate";
import { useFocusLog } from "@/hooks/useFocusLog";
import { useLife } from "@/hooks/useLife";
import { useProfile } from "@/hooks/useProfile";
import { FOCUS_DAILY_TARGET, focusSummary, lifeDayProgress } from "@/lib/life";
import { setLifePriority } from "@/lib/life.functions";
import { loadPlus } from "@/lib/plus.functions";
import { haptic } from "@/lib/haptics";
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
 * Life+ AI on one page (user request: one page instead of tabs): the day and
 * its priority on top, then Goals, Routine with Habits, and the Life Coach
 * side by side on desktop, stacked on phones. Old tab addresses (/goals,
 * /life/routine, /life/habits, /life/coach) open this page at their section.
 */
function LifePage() {
  const { t, lang } = useLifeT();
  const { data: profile } = useProfile();
  const { data, isLoading, refresh } = useLife();
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
          <Skeleton className="h-40 w-full rounded-xl" />
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-96 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
            <Skeleton className="hidden h-96 rounded-xl xl:block" />
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
      {/* The day at a glance (user request: modern, sophisticated): one hero
          card with the ring, a bar per part and, for Premium, the priority. */}
      <section
        className="card-soft relative overflow-hidden p-4 sm:p-5 xl:p-6"
        aria-label={t("Your day")}
      >
        <div
          className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-brand-green/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className={cn(
            "relative grid items-center gap-5",
            data.premium && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8",
          )}
        >
          <div className="flex items-center gap-5">
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
              <dl className="mt-3 grid gap-2">
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
            </div>
          </div>
          {data.premium ? (
            <div className="border-t border-white/10 pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <PriorityCard data={data} onChange={refresh} />
            </div>
          ) : null}
        </div>
      </section>

      {/* One page without holes (user request): Goals fill the first column;
          Routine over Habits in the second, with Habits stretching down to the
          end of the Life Coach in the third; the meditations take the row below,
          under both. Phones stack everything in this order. */}
      {data.premium ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3 xl:grid-rows-[auto_1fr_auto_auto] xl:gap-5">
          <div className="lg:row-span-2 xl:row-span-4">
            <GoalsSection />
          </div>
          <div className="lg:col-start-2 xl:row-start-1">
            <RoutineSection />
          </div>
          <div className="flex flex-col lg:col-start-2 xl:row-start-2 [&>section]:flex-1">
            <HabitsSection />
          </div>
          <div className="flex flex-col lg:col-span-2 xl:col-span-1 xl:col-start-3 xl:row-span-2 xl:row-start-1 [&>section]:flex-1">
            <CoachSection />
          </div>
          <div className="lg:col-span-2 xl:col-start-2 xl:row-start-3">
            <MeditationSection />
          </div>
          <div className="lg:col-span-2 xl:col-start-2 xl:row-start-4">
            <FocusSection />
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <div className="lg:row-span-2">
            <GoalsSection />
          </div>
          <div className="xl:col-span-2">
            <LifePremiumGate feature="Routine, habits and Life Coach" />
          </div>
          <div className="xl:col-span-2">
            <MeditationSection />
          </div>
          <div className="lg:col-span-2 xl:col-start-2">
            <FocusSection />
          </div>
        </div>
      )}
    </AppShell>
  );
}

function PriorityCard({
  data,
  onChange,
}: {
  data: NonNullable<ReturnType<typeof useLife>["data"]>;
  onChange: () => void;
}) {
  const { t } = useLifeT();
  const save = useServerFn(setLifePriority);
  const current = data.priority && data.priority.day === data.today ? data.priority : null;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const mutate = useMutation({
    mutationFn: (input: { text?: string; done?: boolean; clear?: boolean }) =>
      save({ data: input }),
    onMutate: (input) => {
      if (input.done) haptic("tap");
    },
    onSuccess: () => {
      setEditing(false);
      setText("");
      onChange();
    },
    onError: () => toast.error(t("The priority could not be saved.")),
  });

  return (
    <div aria-labelledby="life-priority-title">
      <LifeSectionTitle
        id="life-priority-title"
        icon={Star}
        accent="amber"
        title={t("Priority of the day")}
        subtitle={t("The one thing that makes today count")}
      />
      {current && !editing ? (
        <div className="mt-3 flex items-start gap-3">
          <button
            type="button"
            aria-pressed={!!current.doneAt}
            aria-label={current.doneAt ? t("Mark as not done") : t("Mark as done")}
            disabled={mutate.isPending}
            onClick={() => mutate.mutate({ done: !current.doneAt })}
            className={cn(
              "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2",
              current.doneAt
                ? "border-brand-green bg-brand-green text-[oklch(0.2_0.04_160)]"
                : "border-muted-foreground/60 hover:border-brand-green",
            )}
          >
            {current.doneAt ? (
              <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
            ) : null}
          </button>
          <p
            translate="no"
            className={cn(
              "min-w-0 flex-1 text-sm",
              current.doneAt && "text-muted-foreground line-through",
            )}
          >
            {current.text}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setText(current.text);
              setEditing(true);
            }}
          >
            {t("Edit")}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            aria-label={t("Delete priority")}
            title={t("Delete priority")}
            disabled={mutate.isPending}
            onClick={() => {
              if (window.confirm(t("Delete today's priority?"))) mutate.mutate({ clear: true });
            }}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (text.trim() && !mutate.isPending) mutate.mutate({ text: text.trim() });
          }}
        >
          <Input
            value={text}
            maxLength={200}
            onChange={(event) => setText(event.target.value)}
            placeholder={t("What matters most today?")}
            aria-label={t("Priority of the day")}
          />
          {editing ? (
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              {t("Cancel")}
            </Button>
          ) : null}
          <Button type="submit" disabled={!text.trim() || mutate.isPending}>
            {t("Save")}
          </Button>
        </form>
      )}
    </div>
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
