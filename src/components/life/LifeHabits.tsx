import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Flame, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useLifeT } from "@/components/life/LifeNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addLifeHabit, archiveLifeHabit, setLifeHabitDone } from "@/lib/life.functions";
import {
  addDays,
  habitDueOn,
  habitStreak,
  habitWeekCount,
  LIFE_HABIT_FREQUENCIES,
  type LifeHabit,
  type LifeHabitFrequency,
  type LifeHabitLog,
} from "@/lib/life";
import { cn } from "@/lib/utils";

const FREQUENCY_LABEL: Record<LifeHabitFrequency, string> = {
  daily: "Every day",
  weekdays: "Weekdays",
  times_per_week: "Times a week",
};

function weekdayShort(day: string, lang: "pt" | "en") {
  return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", {
    weekday: "narrow",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

function useHabitToggle(onChange: () => void) {
  const { t } = useLifeT();
  const setDone = useServerFn(setLifeHabitDone);
  return useMutation({
    mutationFn: (input: { habitId: string; day: string; done: boolean }) =>
      setDone({ data: input }),
    onSuccess: onChange,
    onError: () => toast.error(t("The habit could not be saved.")),
  });
}

/** Today's check-in for each habit due today (the Life+ AI overview). */
export function LifeHabitsToday({
  habits,
  logs,
  today,
  onChange,
}: {
  habits: LifeHabit[];
  logs: LifeHabitLog[];
  today: string;
  onChange: () => void;
}) {
  const { t } = useLifeT();
  const toggle = useHabitToggle(onChange);
  if (!habits.length)
    return <p className="text-sm text-muted-foreground">{t("No habits due today.")}</p>;
  return (
    <ul className="space-y-2">
      {habits.map((habit) => {
        const done = logs.some((log) => log.habitId === habit.id && log.day === today);
        const streak = habitStreak(habit, logs, today);
        return (
          <li key={habit.id}>
            <button
              type="button"
              aria-pressed={done}
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ habitId: habit.id, day: today, done: !done })}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg p-2 text-left text-sm transition-colors",
                done ? "bg-brand-green/10" : "bg-secondary/60 hover:bg-secondary",
              )}
            >
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border-2",
                  done
                    ? "border-brand-green bg-brand-green text-[oklch(0.2_0.04_160)]"
                    : "border-muted-foreground/60",
                )}
                aria-hidden="true"
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : null}
              </span>
              <span
                translate="no"
                className={cn("min-w-0 flex-1", done && "text-muted-foreground")}
              >
                {habit.title}
              </span>
              {streak > 0 ? (
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-dashboard-cyan">
                  <Flame className="size-3.5" aria-hidden="true" />
                  {streak}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Every habit with its last 7 days, streak and weekly count (the Habits tab). */
export function LifeHabitBoard({
  habits,
  logs,
  today,
  onChange,
}: {
  habits: LifeHabit[];
  logs: LifeHabitLog[];
  today: string;
  onChange: () => void;
}) {
  const { t, lang } = useLifeT();
  const toggle = useHabitToggle(onChange);
  const archive = useServerFn(archiveLifeHabit);
  const remove = useMutation({
    mutationFn: (id: string) => archive({ data: { id } }),
    onSuccess: onChange,
    onError: () => toast.error(t("The habit could not be removed.")),
  });
  const days = Array.from({ length: 7 }, (_, index) => addDays(today, index - 6));

  if (!habits.length)
    return (
      <p className="text-sm text-muted-foreground">
        {t("No habits yet. Start with one small habit you can keep every day.")}
      </p>
    );

  return (
    <ul className="space-y-3">
      {habits.map((habit) => {
        const streak = habitStreak(habit, logs, today);
        const weekly = habit.frequency === "times_per_week";
        return (
          <li key={habit.id} className="rounded-xl border border-border p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p translate="no" className="text-sm font-semibold">
                  {habit.title}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {weekly
                    ? `${t("This week")}: ${habitWeekCount(habit.id, logs, today)}/${habit.timesPerWeek ?? 1}`
                    : t(FREQUENCY_LABEL[habit.frequency])}
                  {habit.category ? (
                    <>
                      {" · "}
                      <span translate="no">{habit.category}</span>
                    </>
                  ) : null}
                </p>
              </div>
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold text-dashboard-cyan"
                title={weekly ? t("Weeks in a row") : t("Days in a row")}
              >
                <Flame className="size-4" aria-hidden="true" />
                {streak}
              </span>
              <button
                type="button"
                aria-label={t("Remove habit")}
                title={t("Remove habit")}
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm(t("Remove this habit?"))) remove.mutate(habit.id);
                }}
                className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-destructive"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1.5">
              {days.map((day) => {
                const done = logs.some((log) => log.habitId === habit.id && log.day === day);
                const expected = habitDueOn(habit, day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={done}
                    aria-label={day}
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate({ habitId: habit.id, day, done: !done })}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] transition-colors",
                      day === today && "ring-1 ring-brand-green/50",
                      done
                        ? "bg-brand-green/15 text-brand-green"
                        : expected
                          ? "bg-secondary/60 text-muted-foreground hover:bg-secondary"
                          : "bg-transparent text-muted-foreground/40",
                    )}
                  >
                    {weekdayShort(day, lang)}
                    <span
                      className={cn(
                        "grid size-5 place-items-center rounded-full border-2",
                        done
                          ? "border-brand-green bg-brand-green text-[oklch(0.2_0.04_160)]"
                          : "border-muted-foreground/40",
                      )}
                      aria-hidden="true"
                    >
                      {done ? <Check className="size-3" strokeWidth={3} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function LifeHabitForm({
  onChange,
  initialTitle = "",
}: {
  onChange: () => void;
  initialTitle?: string;
}) {
  const { t } = useLifeT();
  const save = useServerFn(addLifeHabit);
  const [title, setTitle] = useState(initialTitle);
  const [frequency, setFrequency] = useState<LifeHabitFrequency>("daily");
  const [times, setTimes] = useState(3);
  const [category, setCategory] = useState("");
  const add = useMutation({
    mutationFn: () =>
      save({
        data: {
          title: title.trim(),
          frequency,
          timesPerWeek: frequency === "times_per_week" ? times : null,
          category: category.trim() || null,
        },
      }),
    onSuccess: () => {
      setTitle("");
      setCategory("");
      onChange();
    },
    onError: (error) =>
      toast.error(t(error instanceof Error ? error.message : "The habit could not be saved.")),
  });

  return (
    <form
      // Like the task form: the habit's text on its own full line.
      className="flex flex-wrap gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim() && !add.isPending) add.mutate();
      }}
    >
      <Input
        value={title}
        maxLength={120}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={t("Which habit? e.g. Read 10 pages")}
        aria-label={t("New habit")}
        className="w-full"
      />
      <div className="flex min-w-0 flex-1 gap-2">
        <select
          value={frequency}
          onChange={(event) => setFrequency(event.target.value as LifeHabitFrequency)}
          aria-label={t("Frequency")}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          {LIFE_HABIT_FREQUENCIES.map((item) => (
            <option key={item} value={item}>
              {t(FREQUENCY_LABEL[item])}
            </option>
          ))}
        </select>
        {frequency === "times_per_week" ? (
          <select
            value={times}
            onChange={(event) => setTimes(Number(event.target.value))}
            aria-label={t("Times a week")}
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}x
              </option>
            ))}
          </select>
        ) : null}
        <Input
          value={category}
          maxLength={40}
          onChange={(event) => setCategory(event.target.value)}
          placeholder={t("Category")}
          aria-label={t("Category")}
          className="min-w-0 flex-1"
        />
      </div>
      <Button
        type="submit"
        disabled={!title.trim() || add.isPending}
        className="ml-auto shrink-0 gap-1.5"
      >
        {add.isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Plus className="size-4" aria-hidden="true" />
        )}
        {t("Add")}
      </Button>
    </form>
  );
}
