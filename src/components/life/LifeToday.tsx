import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarCheck,
  Crown,
  Flame,
  ListChecks,
  Loader2,
  Plus,
  Repeat,
  Target,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EvoAvatar } from "@/components/EvoAvatar";
import { LifeHabitForm } from "@/components/life/LifeHabits";
import { LifeAddPanel, LifeCheckMark, LifeSectionTitle, useLifeT } from "@/components/life/LifeNav";
import { LifeTaskForm, PRIORITY_DOT, PRIORITY_LABEL } from "@/components/life/LifeTasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useLife } from "@/hooks/useLife";
import { useProfile } from "@/hooks/useProfile";
import { haptic } from "@/lib/haptics";
import { habitsDueToday, habitStreak, type LifePriorityLevel } from "@/lib/life";
import { setLifeHabitDone, setLifeTaskDone } from "@/lib/life.functions";
import { PLUS_GOAL_EXAMPLES } from "@/lib/plus";
import { addPlusGoal, loadPlus, setPlusStepDone } from "@/lib/plus.functions";
import { cn } from "@/lib/utils";

const PRIORITY_ORDER: Record<LifePriorityLevel, number> = { high: 0, medium: 1, low: 2 };
const KIND_ORDER = { step: 0, task: 1, habit: 2 } as const;

type TodayItem = {
  key: string;
  kind: keyof typeof KIND_ORDER;
  text: string;
  done: boolean;
  /** The line under the text: the goal, the task's urgency or the habit's run. */
  detail: React.ReactNode;
  /** A habit ticked by the English study day cannot be ticked by hand. */
  locked?: boolean;
  order: number;
  toggle: () => void;
};

/**
 * Life+ AI's "Today" (user request, 2026-10-24: one list answers "what do I
 * do today?", like the Today view of planners): the goal steps EVO wrote,
 * today's tasks and the habits due today in one list, open ones first (goal
 * steps, which count for the streak, then tasks by urgency, then habits),
 * each with the same check. Planning lives in the Plan tab. A new student
 * sees EVO inviting the first goal with one-tap examples instead of empty
 * boxes; tasks and habits come as suggestions.
 */
export function LifeToday() {
  const { t, lang } = useLifeT();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const { data: life, refresh } = useLife();
  const load = useServerFn(loadPlus);
  const { data: plus, isLoading: stepsLoading } = useQuery({
    queryKey: ["plus", profile?.id ?? null, lang],
    enabled: !!profile,
    queryFn: () => load({ data: { lang } }),
    staleTime: 30 * 1000,
  });

  const setStep = useServerFn(setPlusStepDone);
  const setTask = useServerFn(setLifeTaskDone);
  const setHabit = useServerFn(setLifeHabitDone);
  const add = useServerFn(addPlusGoal);
  const [goalTitle, setGoalTitle] = useState("");

  const onTick = (input: { done: boolean }) => {
    if (input.done) haptic("tap");
  };
  const step = useMutation({
    mutationFn: (input: { id: string; done: boolean }) => setStep({ data: input }),
    onMutate: onTick,
    onSuccess: refresh,
    onError: () => toast.error(t("The step could not be saved.")),
  });
  const task = useMutation({
    mutationFn: (input: { id: string; done: boolean }) => setTask({ data: input }),
    onMutate: onTick,
    onSuccess: refresh,
    onError: () => toast.error(t("The task could not be saved.")),
  });
  const habit = useMutation({
    mutationFn: (input: { habitId: string; day: string; done: boolean }) =>
      setHabit({ data: input }),
    onMutate: onTick,
    onSuccess: refresh,
    onError: () => toast.error(t("The habit could not be saved.")),
  });
  const addGoal = useMutation({
    mutationFn: (title: string) => add({ data: { title } }),
    onSuccess: () => {
      setGoalTitle("");
      void queryClient.invalidateQueries({ queryKey: ["plus"] });
      refresh();
    },
    onError: (error) =>
      toast.error(t(error instanceof Error ? error.message : "The goal could not be saved.")),
  });
  const submitGoal = (title: string) => {
    const clean = title.trim();
    if (clean.length >= 3 && !addGoal.isPending) addGoal.mutate(clean);
  };

  if (!life) return null;
  const premium = life.premium;
  const today = life.today;
  const goals = plus?.goals ?? [];
  const pending = step.isPending || task.isPending || habit.isPending;

  const items: TodayItem[] = [
    ...(plus?.todaySteps ?? []).map((item, index) => ({
      key: `step:${item.id}`,
      kind: "step" as const,
      text: item.text,
      done: !!item.doneAt,
      detail: (
        <span translate="no" className="truncate">
          {goals.find((goal) => goal.id === item.goalId)?.title ?? ""}
        </span>
      ),
      order: index,
      toggle: () => step.mutate({ id: item.id, done: !item.doneAt }),
    })),
    ...(premium ? life.tasks.filter((item) => item.day === today) : []).map((item) => ({
      key: `task:${item.id}`,
      kind: "task" as const,
      text: item.title,
      done: !!item.doneAt,
      detail: (
        <>
          <span className={cn("size-1.5 rounded-full", PRIORITY_DOT[item.priority])} />
          {t(PRIORITY_LABEL[item.priority])}
        </>
      ),
      order: PRIORITY_ORDER[item.priority],
      toggle: () => task.mutate({ id: item.id, done: !item.doneAt }),
    })),
    ...(premium ? habitsDueToday(life.habits, life.logs, today) : []).map((item) => {
      const done = life.logs.some((log) => log.habitId === item.id && log.day === today);
      const streak = habitStreak(item, life.logs, today);
      const auto = item.linked === "study_day";
      return {
        key: `habit:${item.id}`,
        kind: "habit" as const,
        text: item.title,
        done,
        locked: auto,
        detail: auto ? (
          t("Automatic: English study days")
        ) : streak > 0 ? (
          <span className="inline-flex items-center gap-0.5 text-dashboard-cyan">
            <Flame className="size-3" aria-hidden="true" />
            {streak}
          </span>
        ) : (
          t("One check-in a day")
        ),
        order: 0,
        toggle: () => habit.mutate({ habitId: item.id, day: today, done: !done }),
      };
    }),
  ].sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.order - b.order,
  );

  const doneCount = items.filter((item) => item.done).length;
  const allDone = items.length > 0 && doneCount === items.length;
  const dateLine = new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${today}T00:00:00Z`));

  return (
    <section className="card-soft p-4 sm:p-5 xl:p-6" aria-labelledby="life-today-title">
      <LifeSectionTitle
        id="life-today-title"
        icon={CalendarCheck}
        accent="green"
        title={t("Today")}
        subtitle={<span className="capitalize">{dateLine}</span>}
        meta={items.length ? `${doneCount}/${items.length}` : undefined}
      />

      {stepsLoading ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      ) : goals.length === 0 ? (
        // A new student: EVO invites the first goal, one tap away.
        <div className="mt-4 rounded-xl border border-brand-green/25 bg-brand-green/[0.06] p-4">
          <div className="flex items-start gap-3">
            <EvoAvatar decorative className="size-11 shrink-0" />
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold">
                {t("Let's start with one goal.")}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("Tell me what you want and I will give you one small step every day.")}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {PLUS_GOAL_EXAMPLES.map((example) => (
              <Button
                key={example}
                type="button"
                variant="outline"
                size="sm"
                disabled={addGoal.isPending}
                onClick={() => submitGoal(t(example))}
              >
                {t(example)}
              </Button>
            ))}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              submitGoal(goalTitle);
            }}
          >
            <Input
              value={goalTitle}
              maxLength={120}
              onChange={(event) => setGoalTitle(event.target.value)}
              placeholder={t("Or write your own goal")}
              aria-label={t("New goal")}
            />
            <Button
              type="submit"
              disabled={goalTitle.trim().length < 3 || addGoal.isPending}
              className="shrink-0 gap-1.5"
            >
              {addGoal.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              {t("Add")}
            </Button>
          </form>
        </div>
      ) : null}

      {items.length ? (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                aria-pressed={item.done}
                disabled={pending || item.locked}
                title={
                  item.locked ? t("Ticked automatically on your English study days") : undefined
                }
                onClick={item.toggle}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl p-3 text-left text-sm transition-colors disabled:cursor-default",
                  item.done ? "bg-brand-green/10" : "bg-secondary/60 hover:bg-secondary",
                )}
              >
                <LifeCheckMark done={item.done} className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span
                    translate="no"
                    className={cn("block", item.done && "text-muted-foreground line-through")}
                  >
                    {item.text}
                  </span>
                  <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                    <KindChip kind={item.kind} />
                    {item.detail}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {allDone ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-brand-green/10 p-3 text-sm">
          <EvoAvatar decorative className="size-10" />
          <p className="font-medium">{t("Everything done today!")}</p>
        </div>
      ) : null}

      {premium ? (
        <div className="mt-3 space-y-2">
          <LifeAddPanel label={t("Add a task for today")}>
            {(close) => (
              <LifeTaskForm
                day={today}
                goals={life.goals}
                onChange={() => {
                  close();
                  refresh();
                }}
                onCancel={close}
              />
            )}
          </LifeAddPanel>
          {life.habits.length === 0 ? (
            <LifeAddPanel label={t("Start a habit, e.g. Read 10 pages")}>
              {(close) => (
                <LifeHabitForm
                  onChange={() => {
                    close();
                    refresh();
                  }}
                  onCancel={close}
                />
              )}
            </LifeAddPanel>
          ) : null}
        </div>
      ) : goals.length > 0 ? (
        <Link
          to="/premium"
          className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <Crown className="size-4 shrink-0 text-amber-300" aria-hidden="true" />
          {t("Plan tasks and habits for your day with Premium")}
        </Link>
      ) : null}
    </section>
  );
}

const KIND = {
  step: { icon: Target, label: "Goal step", className: "text-brand-green" },
  task: { icon: ListChecks, label: "Task", className: "text-sky-300" },
  habit: { icon: Repeat, label: "Habit", className: "text-violet-300" },
} as const;

function KindChip({ kind }: { kind: keyof typeof KIND }) {
  const { t } = useLifeT();
  const { icon: Icon, label, className } = KIND[kind];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 font-medium", className)}>
      <Icon className="size-3" aria-hidden="true" />
      {t(label)}
      <span className="text-muted-foreground" aria-hidden="true">
        ·
      </span>
    </span>
  );
}
