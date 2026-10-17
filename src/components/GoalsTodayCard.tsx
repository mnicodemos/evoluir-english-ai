import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Flame, Loader2, Sprout, Timer } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  DoneCheck,
  EmptySlot,
  LifeSlot,
  SLOT_ICONS,
  SlotChooser,
  habitDoneToday,
  habitsToday,
  pick,
  tasksToday,
  useHomeChoice,
  useLifeActions,
} from "@/components/LifeHomeSlots";
import { useFocusTimer } from "@/hooks/useFocusTimer";
import { useLife } from "@/hooks/useLife";
import { useProfile } from "@/hooks/useProfile";
import { openFocusWidget } from "@/lib/focusTimer";
import { haptic } from "@/lib/haptics";
import { focusClock } from "@/lib/life";
import { plusDayComplete, plusGoalWeek, type PlusGoalWeek, type PlusStep } from "@/lib/plus";
import { loadPlus, setPlusStepDone } from "@/lib/plus.functions";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { PRIORITY_DOT } from "@/components/life/LifeTasks";
import { cn } from "@/lib/utils";

const PRIORITY_TEXT = { high: "High", medium: "Medium", low: "Low" } as const;

/**
 * Dashboard (desktop): today's goal steps, ticked right here. It took the row
 * of the old Quick Access, whose links were all in the sidebar already.
 * Shares the Goals page's query, so both stay in step.
 */
export function GoalsTodayCard() {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const load = useServerFn(loadPlus);
  const setDone = useServerFn(setPlusStepDone);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["plus", profile?.id ?? null, lang],
    enabled: !!profile,
    queryFn: () => load({ data: { lang } }),
    staleTime: 30 * 1000,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["plus"] });
    void queryClient.invalidateQueries({ queryKey: ["profile"] });
    void queryClient.invalidateQueries({ queryKey: ["qualified-study-days"] });
  };
  // The step just ticked gets the short celebration; a page load does not.
  const [justDone, setJustDone] = useState<string | null>(null);
  const toggle = useMutation({
    mutationFn: (input: { id: string; done: boolean }) => setDone({ data: input }),
    onMutate: (input) => {
      if (input.done) haptic("tap");
    },
    onSuccess: (_result, input) => {
      setJustDone(input.done ? input.id : null);
      refresh();
    },
    onError: () => toast.error(t("The step could not be saved.")),
  });

  const goals = data?.goals ?? [];
  const steps = data?.todaySteps ?? [];
  const recent = data?.recentSteps ?? [];
  const allDone = plusDayComplete(steps);
  const { data: life } = useLife();
  const actions = useLifeActions(t);
  const { choice, choose } = useHomeChoice(profile?.id);
  const todayTasks = life ? tasksToday(life) : [];
  const dueHabits = life ? habitsToday(life) : [];
  const shownGoal = pick(goals, choice.goal);
  const shownStep = shownGoal ? (steps.find((item) => item.goalId === shownGoal.id) ?? null) : null;
  const shownTask = pick(todayTasks, choice.task);
  const shownHabit = pick(dueHabits, choice.habit);

  return (
    <section
      className="card-soft min-w-0 p-3 xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:px-4 xl:py-3"
      aria-labelledby="goals-today-title"
    >
      <div className="flex items-center gap-2">
        {/* Life+ AI holds the goals (user decision): the title opens it, and
            Premium students also see today's tasks and habits at a glance. */}
        <Sprout
          className="size-[1.65rem] shrink-0 text-brand-green"
          strokeWidth={2.4}
          aria-hidden="true"
        />
        <h2 id="goals-today-title" className="font-display text-sm font-semibold">
          <Link to="/life" className="hover:text-brand-green">
            Life+ AI
          </Link>
        </h2>
        {/* No goal checks pill (user request: the card holds tasks and habits
            too, so three goal checks read as the whole card). */}
        <FocusButton />
      </div>

      {isLoading ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t("EVO is preparing today's steps…")}
        </p>
      ) : isError ? (
        <p className="mt-2 text-xs text-muted-foreground">{t("Your goals could not be loaded.")}</p>
      ) : (
        // One goal, one task and one habit (user request); when there are more,
        // the student picks which one shows here.
        <ul className="mt-1.5 grid gap-2 sm:grid-cols-3 xl:min-h-0 xl:flex-1">
          {shownGoal ? (
            <GoalTile
              key={shownGoal.id}
              title={shownGoal.title}
              step={shownStep}
              week={plusGoalWeek(recent, shownGoal.id, data?.today ?? "")}
              dayComplete={allDone}
              stepsLeft={steps.filter((item) => !item.doneAt).length}
              celebrate={!!shownStep && justDone === shownStep.id}
              busy={toggle.isPending}
              onToggle={(done) => shownStep && toggle.mutate({ id: shownStep.id, done })}
              chooser={
                <SlotChooser
                  items={goals}
                  current={shownGoal.id}
                  onChoose={(id) => choose("goal", id)}
                  t={t}
                />
              }
              t={t}
            />
          ) : (
            <EmptySlot
              kind={t("Add a goal")}
              text={t("Choose 1 to 3 goals and I will give you one small step a day.")}
              to="/life"
              hash="goals"
            />
          )}
          {!life ? (
            <li className="rounded-lg bg-secondary/40" aria-hidden="true" />
          ) : !life.premium ? (
            <EmptySlot
              kind={t("Routine")}
              text={t("Plan the tasks of your day with Premium.")}
              to="/premium"
              premium
            />
          ) : shownTask ? (
            <LifeSlot
              kind={t("Task today")}
              icon={SLOT_ICONS.task}
              title={shownTask.title}
              done={!!shownTask.doneAt}
              // The task's urgency right on the Home (user request), as on /life.
              badge={
                <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                  <span
                    className={cn("size-1.5 rounded-full", PRIORITY_DOT[shownTask.priority])}
                    aria-hidden="true"
                  />
                  {t(PRIORITY_TEXT[shownTask.priority])}
                </span>
              }
              details={
                <p className="text-sm text-muted-foreground">
                  {t("Priority")}: {t(PRIORITY_TEXT[shownTask.priority])}
                </p>
              }
              chooser={
                <SlotChooser
                  items={todayTasks}
                  current={shownTask.id}
                  onChoose={(id) => choose("task", id)}
                  t={t}
                />
              }
              action={
                <DoneCheck
                  done={!!shownTask.doneAt}
                  disabled={actions.task.isPending}
                  label={shownTask.doneAt ? t("Mark as not done") : t("Mark as done")}
                  onToggle={() =>
                    actions.task.mutate({ id: shownTask.id, done: !shownTask.doneAt })
                  }
                />
              }
            />
          ) : (
            <EmptySlot
              kind={t("Add a task")}
              text={t("No tasks for this day yet.")}
              to="/life"
              hash="routine"
            />
          )}
          {!life ? (
            <li className="rounded-lg bg-secondary/40" aria-hidden="true" />
          ) : !life.premium ? (
            <EmptySlot
              kind={t("Habits")}
              text={t("Build habits one check-in a day with Premium.")}
              to="/premium"
              premium
            />
          ) : shownHabit ? (
            <LifeSlot
              kind={t("Habit today")}
              icon={SLOT_ICONS.habit}
              title={shownHabit.title}
              done={habitDoneToday(life, shownHabit.id)}
              details={
                shownHabit.category ? (
                  <p className="text-sm text-muted-foreground" translate="no">
                    {shownHabit.category}
                  </p>
                ) : null
              }
              chooser={
                <SlotChooser
                  items={dueHabits}
                  current={shownHabit.id}
                  onChoose={(id) => choose("habit", id)}
                  t={t}
                />
              }
              action={
                <DoneCheck
                  done={habitDoneToday(life, shownHabit.id)}
                  disabled={actions.habit.isPending}
                  label={
                    habitDoneToday(life, shownHabit.id) ? t("Mark as not done") : t("Mark as done")
                  }
                  onToggle={() =>
                    actions.habit.mutate({
                      habitId: shownHabit.id,
                      day: life.today,
                      done: !habitDoneToday(life, shownHabit.id),
                    })
                  }
                />
              }
            />
          ) : (
            <EmptySlot
              kind={t("Add a habit")}
              text={t("No habits due today.")}
              to="/life"
              hash="habits"
            />
          )}
        </ul>
      )}
    </section>
  );
}

/**
 * One goal's step (user request: a step that encourages, not a cramped to-do).
 * Each goal takes one of the three slots of the same size; the step itself
 * opens in a popup from the magnifier, so no text is cut and the row keeps
 * its height.
 */
function GoalTile({
  title,
  step,
  week,
  dayComplete,
  stepsLeft,
  celebrate,
  busy,
  onToggle,
  chooser,
  t,
}: {
  chooser?: ReactNode;
  title: string;
  step: PlusStep | null;
  week: PlusGoalWeek;
  dayComplete: boolean;
  stepsLeft: number;
  celebrate: boolean;
  busy: boolean;
  onToggle: (done: boolean) => void;
  t: (label: string) => string;
}) {
  const done = !!step?.doneAt;
  // The goal's last 7 days: dots in a slot wide enough for them (the count is
  // read out and shown on hover), dots and count in the popup.
  const week7 = (always: boolean) => (
    <span
      className={cn("shrink-0 items-center gap-1", always ? "flex" : "hidden @[18.5rem]:flex")}
      title={`${t("Last 7 days")}: ${t("{n} of 7 days").replace("{n}", String(week.doneCount))}`}
    >
      <span className="flex gap-0.5" aria-hidden="true">
        {week.days.map((item, index) => (
          <span
            key={item.day}
            className={cn(
              "size-1.5 rounded-full",
              item.done ? "bg-brand-green" : "bg-muted-foreground/25",
              index === week.days.length - 1 && !item.done && "ring-1 ring-brand-green/60",
            )}
          />
        ))}
      </span>
      <span className={cn("text-[10px] font-medium text-muted-foreground", !always && "sr-only")}>
        {t("{n} of 7 days").replace("{n}", String(week.doneCount))}
      </span>
      {week.streak >= 2 ? (
        <span
          className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-warning"
          title={t("{n} days in a row").replace("{n}", String(week.streak))}
        >
          <Flame className="size-3" aria-hidden="true" />
          {String(week.streak)}
        </span>
      ) : null}
    </span>
  );
  const dayNote = dayComplete
    ? t("Your study day counts!")
    : stepsLeft === 1
      ? t("1 more step to count your day")
      : t("{n} more steps to count your day").replace("{n}", String(stepsLeft));
  const dayNoteLine = done ? (
    <p
      className={cn(
        "text-[11px] font-semibold leading-snug",
        dayComplete ? "text-brand-green" : "text-muted-foreground",
        celebrate && "animate-in fade-in-0 slide-in-from-bottom-1 duration-500",
      )}
    >
      {dayNote}
    </p>
  ) : null;
  // The same two rows as the task and habit slots (user request: one pattern):
  // the kind "Step today" with the chooser and magnifier, then the goal's name
  // with its check; the step, its last 7 days and the day note in the popup.
  return (
    <LifeSlot
      kind={t("Step today")}
      icon={SLOT_ICONS.goal}
      title={title}
      done={done}
      chooser={chooser}
      details={
        <>
          <p className="text-sm leading-relaxed" translate="no">
            {step?.text ?? "…"}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">{t("Last 7 days")}</span>
            {week7(true)}
          </div>
          {dayNoteLine}
        </>
      }
      action={
        <span
          className={cn("shrink-0", celebrate && "animate-in zoom-in-50 fade-in-0 duration-500")}
        >
          <DoneCheck
            done={done}
            disabled={busy || !step}
            label={done ? t("Mark as not done") : t("Complete step")}
            onToggle={() => onToggle(!done)}
          />
        </span>
      }
    />
  );
}

/**
 * Opens the floating Focus timer (user request: start and stop the counter
 * from the Life+ AI card and keep studying); while a phase runs it shows the
 * time left.
 */
function FocusButton() {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const { state, view } = useFocusTimer();
  const active = state.phase !== "idle";
  return (
    <button
      type="button"
      onClick={openFocusWidget}
      aria-label={t("Floating timer")}
      title={t("Floating timer")}
      className={cn(
        "ml-auto inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition-colors",
        active
          ? "border-pink-400/40 bg-pink-400/10 text-pink-300 hover:bg-pink-400/15"
          : "border-white/10 bg-white/[0.04] text-muted-foreground hover:text-foreground",
      )}
    >
      <Timer className="size-3.5" aria-hidden="true" />
      <span className="tabular-nums">{active ? focusClock(view.leftMs) : t("Focus")}</span>
    </button>
  );
}
