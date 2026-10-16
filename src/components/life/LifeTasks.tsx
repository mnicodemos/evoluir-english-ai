import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useLifeT } from "@/components/life/LifeNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteLifeTask, saveLifeTask, setLifeTaskDone } from "@/lib/life.functions";
import type { LifeGoal } from "@/lib/life.functions";
import { LIFE_PRIORITIES, type LifePriorityLevel, type LifeTask } from "@/lib/life";
import { cn } from "@/lib/utils";

const PRIORITY_LABEL: Record<LifePriorityLevel, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const PRIORITY_DOT: Record<LifePriorityLevel, string> = {
  high: "bg-destructive",
  medium: "bg-amber-400",
  low: "bg-sky-400",
};

const PRIORITY_ORDER: Record<LifePriorityLevel, number> = { high: 0, medium: 1, low: 2 };

/** One day's tasks, open ones first by priority; each can be ticked or removed. */
export function LifeTaskList({
  tasks,
  goals,
  onChange,
  emptyText,
}: {
  tasks: LifeTask[];
  goals: LifeGoal[];
  onChange: () => void;
  emptyText: string;
}) {
  const { t } = useLifeT();
  const setDone = useServerFn(setLifeTaskDone);
  const remove = useServerFn(deleteLifeTask);
  const toggle = useMutation({
    mutationFn: (input: { id: string; done: boolean }) => setDone({ data: input }),
    onSuccess: onChange,
    onError: () => toast.error(t("The task could not be saved.")),
  });
  const drop = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: onChange,
    onError: () => toast.error(t("The task could not be removed.")),
  });

  const sorted = [...tasks].sort(
    (a, b) =>
      Number(!!a.doneAt) - Number(!!b.doneAt) ||
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  );
  if (!sorted.length) return <p className="text-sm text-muted-foreground">{t(emptyText)}</p>;

  return (
    <ul className="space-y-2">
      {sorted.map((task) => {
        const done = !!task.doneAt;
        const goal = goals.find((item) => item.id === task.goalId);
        return (
          <li
            key={task.id}
            className={cn(
              "flex items-start gap-3 rounded-lg p-2 text-sm",
              done ? "bg-brand-green/10" : "bg-secondary/60",
            )}
          >
            <button
              type="button"
              aria-pressed={done}
              aria-label={done ? t("Mark as not done") : t("Mark as done")}
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ id: task.id, done: !done })}
              className={cn(
                "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2",
                done
                  ? "border-brand-green bg-brand-green text-[oklch(0.2_0.04_160)]"
                  : "border-muted-foreground/60 hover:border-brand-green",
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : null}
            </button>
            <div className="min-w-0 flex-1">
              <p translate="no" className={cn(done && "text-muted-foreground line-through")}>
                {task.title}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span
                  className={cn("size-1.5 rounded-full", PRIORITY_DOT[task.priority])}
                  aria-hidden="true"
                />
                {t(PRIORITY_LABEL[task.priority])}
                {goal ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span translate="no" className="truncate">
                      {goal.title}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
            <button
              type="button"
              aria-label={t("Remove task")}
              title={t("Remove task")}
              disabled={drop.isPending}
              onClick={() => drop.mutate(task.id)}
              className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-destructive"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Adds a task to a day, with a priority and, optionally, the goal it serves. */
export function LifeTaskForm({
  day,
  goals,
  onChange,
  initialTitle = "",
}: {
  day: string;
  goals: LifeGoal[];
  onChange: () => void;
  initialTitle?: string;
}) {
  const { t } = useLifeT();
  const save = useServerFn(saveLifeTask);
  const [title, setTitle] = useState(initialTitle);
  const [priority, setPriority] = useState<LifePriorityLevel>("medium");
  const [goalId, setGoalId] = useState("");
  const add = useMutation({
    mutationFn: () =>
      save({ data: { title: title.trim(), day, priority, goalId: goalId || null } }),
    onSuccess: () => {
      setTitle("");
      onChange();
    },
    onError: () => toast.error(t("The task could not be saved.")),
  });

  return (
    <form
      // The task's text takes its own full line (user report: squeezed beside
      // the selects it showed no placeholder); priority, goal and Add below.
      className="flex flex-wrap gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim() && !add.isPending) add.mutate();
      }}
    >
      <Input
        value={title}
        maxLength={160}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={t("What will you do? e.g. Call the bank")}
        aria-label={t("New task")}
        className="w-full"
      />
      <select
        value={priority}
        onChange={(event) => setPriority(event.target.value as LifePriorityLevel)}
        aria-label={t("Priority")}
        className="h-9 shrink-0 rounded-md border border-input bg-transparent px-2 text-sm"
      >
        {LIFE_PRIORITIES.map((item) => (
          <option key={item} value={item}>
            {t(PRIORITY_LABEL[item])}
          </option>
        ))}
      </select>
      {goals.length ? (
        <select
          value={goalId}
          onChange={(event) => setGoalId(event.target.value)}
          aria-label={t("Goal")}
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          <option value="">{t("No goal")}</option>
          {goals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.title}
            </option>
          ))}
        </select>
      ) : null}
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
