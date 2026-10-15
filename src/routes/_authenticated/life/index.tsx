import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ChevronRight,
  ListChecks,
  Loader2,
  Repeat,
  Sparkles,
  Star,
  Target,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { LifeHabitsToday } from "@/components/life/LifeHabits";
import { LifeNav, LifePremiumGate, useLifeT } from "@/components/life/LifeNav";
import { LifeTaskForm, LifeTaskList } from "@/components/life/LifeTasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLife } from "@/hooks/useLife";
import { useProfile } from "@/hooks/useProfile";
import { habitsDueToday, lifeDayProgress } from "@/lib/life";
import { setLifePriority } from "@/lib/life.functions";
import { loadPlus, setPlusStepDone } from "@/lib/plus.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/life/")({
  head: () => ({
    meta: [
      { title: "Life AI - Evoluir+ English AI" },
      {
        name: "description",
        content: "Your goals, routine and habits in one place. Evolve one day at a time.",
      },
    ],
  }),
  component: LifeTodayPage,
});

/**
 * Life AI "Today": the priority of the day, the day's progress, today's goal
 * steps, tasks and habits, and a way into the Life Coach.
 */
function LifeTodayPage() {
  const { t, lang } = useLifeT();
  const { data: profile } = useProfile();
  const { data, isLoading, refresh } = useLife();
  const loadSteps = useServerFn(loadPlus);
  const tickStep = useServerFn(setPlusStepDone);
  const { data: plus } = useQuery({
    queryKey: ["plus", profile?.id ?? null, lang],
    enabled: !!profile,
    queryFn: () => loadSteps({ data: { lang } }),
    staleTime: 30 * 1000,
  });
  const toggleStep = useMutation({
    mutationFn: (input: { id: string; done: boolean }) => tickStep({ data: input }),
    onSuccess: refresh,
    onError: () => toast.error(t("The step could not be saved.")),
  });

  if (isLoading || !data) {
    return (
      <AppShell>
        <LifeNav active="overview" />
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </AppShell>
    );
  }

  const steps = plus?.todaySteps ?? [];
  const due = habitsDueToday(data.habits, data.logs, data.today);
  const progress = lifeDayProgress({
    today: data.today,
    tasks: data.tasks,
    habits: data.habits,
    logs: data.logs,
    goalSteps: steps,
  });
  const todayTasks = data.tasks.filter((task) => task.day === data.today);

  return (
    <AppShell>
      <LifeNav active="overview" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
        <div className="grid gap-4">
          <section
            className="card-soft flex items-center gap-4 p-4 sm:p-5"
            aria-label={t("Your day")}
          >
            <DayRing percent={progress.percent} />
            <div className="min-w-0 text-sm">
              <h2 className="text-base font-semibold">{t("Your day")}</h2>
              <p className="mt-1 text-muted-foreground">
                {t("Goal steps")}: {progress.stepsDone}/{progress.stepsTotal}
              </p>
              {data.premium ? (
                <>
                  <p className="text-muted-foreground">
                    {t("Tasks")}: {progress.tasksDone}/{progress.tasksTotal}
                  </p>
                  <p className="text-muted-foreground">
                    {t("Habits")}: {progress.habitsDone}/{progress.habitsDue}
                  </p>
                </>
              ) : null}
            </div>
          </section>

          {data.premium ? <PriorityCard data={data} onChange={refresh} /> : null}

          <section className="card-soft p-4 sm:p-5" aria-labelledby="life-steps-title">
            <h2 id="life-steps-title" className="flex items-center gap-2 text-base font-semibold">
              <Target className="size-5 text-brand-green" aria-hidden="true" />
              {t("Today's steps")}
              <Link
                to="/goals"
                className="ml-auto inline-flex items-center gap-0.5 text-xs font-semibold text-brand-green"
              >
                {t("Goals")}
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </Link>
            </h2>
            {plus && !plus.goals.length ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {t("Choose 1 to 3 goals and I will give you one small step a day.")}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {steps.map((step) => {
                  const done = !!step.doneAt;
                  const goal = plus?.goals.find((item) => item.id === step.goalId);
                  return (
                    <li key={step.id}>
                      <button
                        type="button"
                        aria-pressed={done}
                        disabled={toggleStep.isPending}
                        onClick={() => toggleStep.mutate({ id: step.id, done: !done })}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-lg p-2 text-left text-sm",
                          done ? "bg-brand-green/10" : "bg-secondary/60 hover:bg-secondary",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2",
                            done
                              ? "border-brand-green bg-brand-green text-[oklch(0.2_0.04_160)]"
                              : "border-muted-foreground/60",
                          )}
                          aria-hidden="true"
                        >
                          {done ? <Check className="size-3.5" strokeWidth={3} /> : null}
                        </span>
                        <span className="min-w-0">
                          <span translate="no" className="block text-[11px] text-muted-foreground">
                            {goal?.title}
                          </span>
                          <span
                            translate="no"
                            className={cn(done && "text-muted-foreground line-through")}
                          >
                            {step.text}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {data.premium ? (
          <div className="grid gap-4">
            <section className="card-soft p-4 sm:p-5" aria-labelledby="life-tasks-title">
              <h2 id="life-tasks-title" className="flex items-center gap-2 text-base font-semibold">
                <ListChecks className="size-5 text-brand-green" aria-hidden="true" />
                {t("Today's tasks")}
                <Link
                  to="/life/routine"
                  className="ml-auto inline-flex items-center gap-0.5 text-xs font-semibold text-brand-green"
                >
                  {t("Routine")}
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </Link>
              </h2>
              <div className="mt-3">
                <LifeTaskForm day={data.today} goals={data.goals} onChange={refresh} />
              </div>
              <div className="mt-3">
                <LifeTaskList
                  tasks={todayTasks}
                  goals={data.goals}
                  onChange={refresh}
                  emptyText="No tasks for today yet."
                />
              </div>
            </section>

            <section className="card-soft p-4 sm:p-5" aria-labelledby="life-habits-title">
              <h2
                id="life-habits-title"
                className="flex items-center gap-2 text-base font-semibold"
              >
                <Repeat className="size-5 text-brand-green" aria-hidden="true" />
                {t("Habits today")}
                <Link
                  to="/life/habits"
                  className="ml-auto inline-flex items-center gap-0.5 text-xs font-semibold text-brand-green"
                >
                  {t("Habits")}
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </Link>
              </h2>
              <div className="mt-3">
                <LifeHabitsToday
                  habits={due}
                  logs={data.logs}
                  today={data.today}
                  onChange={refresh}
                />
              </div>
            </section>

            <Link
              to="/life/coach"
              className="card-soft flex items-center gap-3 p-4 transition-colors hover:bg-secondary/40 sm:p-5"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-green/12 text-brand-green">
                <Sparkles className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{t("Life Coach")}</span>
                <span className="block text-xs text-muted-foreground">
                  {t("Plan a goal, choose your priorities or start a habit with EVO.")}
                </span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <LifePremiumGate feature="Routine, habits and Life Coach" />
        )}
      </div>
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
    mutationFn: (input: { text?: string; done?: boolean }) => save({ data: input }),
    onSuccess: () => {
      setEditing(false);
      setText("");
      onChange();
    },
    onError: () => toast.error(t("The priority could not be saved.")),
  });

  return (
    <section className="card-soft p-4 sm:p-5" aria-labelledby="life-priority-title">
      <h2 id="life-priority-title" className="flex items-center gap-2 text-base font-semibold">
        <Star className="size-5 text-amber-400" aria-hidden="true" />
        {t("Priority of the day")}
      </h2>
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
          <Button type="submit" disabled={!text.trim() || mutate.isPending}>
            {t("Save")}
          </Button>
        </form>
      )}
    </section>
  );
}

function DayRing({ percent }: { percent: number | null }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative grid size-24 shrink-0 place-items-center">
      <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth="7"
          className="stroke-secondary"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          className="stroke-brand-green transition-[stroke-dashoffset]"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - (percent ?? 0) / 100)}
        />
      </svg>
      <span className="text-xl font-bold">{percent === null ? "—" : `${percent}%`}</span>
    </div>
  );
}
