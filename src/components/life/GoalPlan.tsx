import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Check, ChevronDown, Flag, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useLifeT } from "@/components/life/LifeNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { daysUntil, LIFE_MAX_MILESTONES, milestoneProgress, type LifeMilestone } from "@/lib/life";
import {
  addGoalMilestone,
  deleteGoalMilestone,
  setGoalMilestoneDone,
  updateGoalDetails,
  type LifeGoal,
} from "@/lib/life.functions";
import { cn } from "@/lib/utils";

/**
 * A goal's plan inside Life AI (from the owner's module): a deadline and
 * milestones with their progress, next to EVO's step of the day.
 */
export function GoalPlan({
  goal,
  milestones,
  today,
  onChange,
}: {
  goal: LifeGoal;
  milestones: LifeMilestone[];
  today: string;
  onChange: () => void;
}) {
  const { t } = useLifeT();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState(goal.deadline ?? "");
  const saveDetails = useServerFn(updateGoalDetails);
  const add = useServerFn(addGoalMilestone);
  const tick = useServerFn(setGoalMilestoneDone);
  const remove = useServerFn(deleteGoalMilestone);
  const onError = (fallback: string) => (error: unknown) =>
    toast.error(t(error instanceof Error ? error.message : fallback));

  const details = useMutation({
    mutationFn: (value: string) =>
      saveDetails({
        data: { id: goal.id, deadline: value || null, description: goal.description },
      }),
    onSuccess: onChange,
    onError: onError("The goal could not be saved."),
  });
  const addMilestone = useMutation({
    mutationFn: () => add({ data: { goalId: goal.id, title: title.trim() } }),
    onSuccess: () => {
      setTitle("");
      onChange();
    },
    onError: onError("The milestone could not be saved."),
  });
  const toggle = useMutation({
    mutationFn: (input: { id: string; done: boolean }) => tick({ data: input }),
    onSuccess: onChange,
    onError: onError("The milestone could not be saved."),
  });
  const drop = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: onChange,
    onError: onError("The milestone could not be removed."),
  });

  const progress = milestoneProgress(milestones);
  const left = daysUntil(goal.deadline, today);
  const deadlineText =
    left === null
      ? null
      : left < 0
        ? t("Deadline passed")
        : left === 0
          ? t("Deadline today")
          : t("{days} days left").replace("{days}", String(left));

  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-xs text-muted-foreground hover:text-foreground"
      >
        <Flag className="size-3.5 shrink-0" aria-hidden="true" />
        {progress === null ? (
          <span>{t("Add milestones and a deadline")}</span>
        ) : (
          <>
            <span
              className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary"
              aria-hidden="true"
            >
              <span className="block h-full bg-brand-green" style={{ width: `${progress}%` }} />
            </span>
            <span>
              {milestones.filter((m) => m.doneAt).length}/{milestones.length} {t("milestones")}
            </span>
          </>
        )}
        {deadlineText ? (
          <span
            className={cn(
              "inline-flex items-center gap-1",
              left !== null && left < 0 && "text-destructive",
            )}
          >
            <CalendarClock className="size-3.5" aria-hidden="true" />
            {deadlineText}
          </span>
        ) : null}
        <ChevronDown
          className={cn("ml-auto size-4 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="mt-2 space-y-3 rounded-lg border border-border p-3">
          <label className="flex flex-wrap items-center gap-2 text-xs">
            {t("Deadline")}
            <Input
              type="date"
              value={deadline}
              min={today}
              onChange={(event) => setDeadline(event.target.value)}
              onBlur={() => {
                if ((deadline || null) !== goal.deadline) details.mutate(deadline);
              }}
              className="h-8 w-40"
            />
            {details.isPending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : null}
          </label>

          {milestones.length ? (
            <ul className="space-y-1.5">
              {milestones.map((milestone) => {
                const done = !!milestone.doneAt;
                return (
                  <li key={milestone.id} className="flex items-center gap-2 text-sm">
                    <button
                      type="button"
                      aria-pressed={done}
                      aria-label={done ? t("Mark as not done") : t("Mark as done")}
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ id: milestone.id, done: !done })}
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full border-2",
                        done
                          ? "border-brand-green bg-brand-green text-[oklch(0.2_0.04_160)]"
                          : "border-muted-foreground/60 hover:border-brand-green",
                      )}
                    >
                      {done ? (
                        <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                      ) : null}
                    </button>
                    <span
                      translate="no"
                      className={cn("min-w-0 flex-1", done && "text-muted-foreground line-through")}
                    >
                      {milestone.title}
                    </span>
                    <button
                      type="button"
                      aria-label={t("Remove milestone")}
                      disabled={drop.isPending}
                      onClick={() => drop.mutate(milestone.id)}
                      className="grid size-6 place-items-center rounded text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {milestones.length < LIFE_MAX_MILESTONES ? (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (title.trim() && !addMilestone.isPending) addMilestone.mutate();
              }}
            >
              <Input
                value={title}
                maxLength={160}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("New milestone")}
                aria-label={t("New milestone")}
                className="h-8"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!title.trim() || addMilestone.isPending}
                className="h-8 gap-1"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                {t("Add")}
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
