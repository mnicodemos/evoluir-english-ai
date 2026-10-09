import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronRight, Flame, Loader2, Plus, Target } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EvoAvatar } from "@/components/EvoAvatar";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import {
  PLUS_GOAL_EXAMPLES,
  PLUS_MAX_GOALS,
  plusDayComplete,
  plusGoalWeek,
  type PlusGoalWeek,
  type PlusStep,
} from "@/lib/plus";
import { addPlusGoal, loadPlus, setPlusStepDone } from "@/lib/plus.functions";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { cn } from "@/lib/utils";

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
  const add = useServerFn(addPlusGoal);

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
  const addGoal = useMutation({
    mutationFn: (title: string) => add({ data: { title } }),
    onSuccess: refresh,
    onError: () => toast.error(t("The goal could not be saved.")),
  });
  // The step just ticked gets the short celebration; a page load does not.
  const [justDone, setJustDone] = useState<string | null>(null);
  const toggle = useMutation({
    mutationFn: (input: { id: string; done: boolean }) => setDone({ data: input }),
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

  return (
    <section
      className="card-soft min-w-0 p-3 xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:px-4 xl:py-3"
      aria-labelledby="goals-today-title"
    >
      <div className="flex items-center gap-2">
        <Target
          className="size-[1.65rem] shrink-0 text-brand-green"
          strokeWidth={2.4}
          aria-hidden="true"
        />
        <h2 id="goals-today-title" className="font-display text-sm font-semibold">
          {t("Goals today")}
        </h2>
        {allDone && goals.length > 0 ? (
          <span className="rounded-full bg-brand-green/15 px-2 py-0.5 text-[11px] font-semibold text-brand-green">
            {t("All done")}
          </span>
        ) : null}
        <Link
          to="/goals"
          className="ml-auto inline-flex items-center gap-1 rounded-md text-[11px] font-semibold leading-none text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60"
        >
          {t("Open goals")}
          <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
        </Link>
      </div>

      {isLoading ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t("EVO is preparing today's steps…")}
        </p>
      ) : isError ? (
        <p className="mt-2 text-xs text-muted-foreground">{t("Your goals could not be loaded.")}</p>
      ) : goals.length === 0 ? (
        // No goals yet: EVO's invitation beside the three example goals, each
        // one tap away, so the row is filled with something to do.
        <div className="mt-2 grid gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))]">
          <div className="flex min-w-0 items-center gap-3">
            <EvoAvatar decorative className="size-10 sm:size-11" />
            <p className="min-w-0 text-sm">
              {t("Choose 1 to 3 goals and I will give you one small step a day.")}
            </p>
          </div>
          {PLUS_GOAL_EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              disabled={addGoal.isPending}
              onClick={() => addGoal.mutate(t(example))}
              className="flex h-full min-h-11 min-w-0 items-center gap-2.5 rounded-lg bg-secondary/60 p-2 text-left text-xs font-medium transition-colors hover:bg-secondary"
            >
              <span
                className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-green/15 text-brand-green"
                aria-hidden="true"
              >
                <Plus className="size-3.5" strokeWidth={3} />
              </span>
              <span className="min-w-0">{t(example)}</span>
            </button>
          ))}
        </div>
      ) : (
        // Three slots (user request): with one goal, EVO's step takes two of them;
        // a free slot invites the next goal instead of sitting empty.
        <ul className="mt-2 grid gap-2 sm:grid-cols-3 xl:min-h-0 xl:flex-1">
          {goals.map((goal) => {
            const step = steps.find((item) => item.goalId === goal.id) ?? null;
            return (
              <GoalTile
                key={goal.id}
                title={goal.title}
                step={step}
                week={plusGoalWeek(recent, goal.id, data?.today ?? "")}
                featured={goals.length === 1}
                dayComplete={allDone}
                celebrate={!!step && justDone === step.id}
                busy={toggle.isPending}
                onToggle={(done) => step && toggle.mutate({ id: step.id, done })}
                t={t}
              />
            );
          })}
          {goals.length < PLUS_MAX_GOALS ? (
            <li className="min-w-0">
              <Link
                to="/goals"
                className="flex h-full min-h-20 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border p-3 text-center transition-colors hover:border-brand-green/50 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60"
              >
                <span
                  className="grid size-8 place-items-center rounded-full bg-brand-green/15 text-brand-green"
                  aria-hidden="true"
                >
                  <Plus className="size-4" strokeWidth={3} />
                </span>
                <span className="text-xs font-semibold">{t("Add another goal")}</span>
                <span className="text-[11px] leading-snug text-muted-foreground">
                  {t("Up to 3 goals, one small step a day.")}
                </span>
              </Link>
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

/**
 * One goal's step (user request: a step that encourages, not a cramped to-do):
 * the whole step, the goal's last 7 days, a clear button and a short
 * celebration that says what the tick is worth.
 */
function GoalTile({
  title,
  step,
  week,
  featured,
  dayComplete,
  celebrate,
  busy,
  onToggle,
  t,
}: {
  title: string;
  step: PlusStep | null;
  week: PlusGoalWeek;
  featured: boolean;
  dayComplete: boolean;
  celebrate: boolean;
  busy: boolean;
  onToggle: (done: boolean) => void;
  t: (label: string) => string;
}) {
  const done = !!step?.doneAt;
  return (
    <li
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-lg p-3 transition-colors",
        featured && "sm:col-span-2",
        done ? "bg-brand-green/10 ring-1 ring-brand-green/30" : "bg-secondary/60",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {featured ? <EvoAvatar decorative className="size-11 shrink-0" /> : null}
        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            <p className="min-w-0 break-words text-[11px] font-semibold leading-snug text-muted-foreground">
              {featured ? (
                <>
                  <span className="text-brand-green">{t("Your step today")}</span>
                  <span aria-hidden="true"> · </span>
                </>
              ) : null}
              <span translate="no">{title}</span>
            </p>
          </div>
          <p
            className={cn(
              "mt-1 leading-snug",
              featured ? "text-sm" : "text-xs",
              done && "text-muted-foreground",
            )}
            translate="no"
          >
            {step?.text ?? "…"}
          </p>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" title={t("Last 7 days")}>
          <span className="flex gap-1" aria-hidden="true">
            {week.days.map((item, index) => (
              <span
                key={item.day}
                className={cn(
                  "size-2 rounded-full",
                  item.done ? "bg-brand-green" : "bg-muted-foreground/25",
                  index === week.days.length - 1 && !item.done && "ring-1 ring-brand-green/60",
                )}
              />
            ))}
          </span>
          <span className="text-[10px] font-medium text-muted-foreground">
            {t("{n} of 7 days").replace("{n}", String(week.doneCount))}
          </span>
          {week.streak >= 2 ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
              <Flame className="size-3" aria-hidden="true" />
              {t("{n} days in a row").replace("{n}", String(week.streak))}
            </span>
          ) : null}
        </div>
        {done ? (
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-semibold text-brand-green",
                celebrate && "animate-in zoom-in-50 fade-in-0 duration-500",
              )}
            >
              <span className="grid size-5 place-items-center rounded-full bg-brand-green text-[oklch(0.2_0.04_160)]">
                <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
              </span>
              {t("Step done!")}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => onToggle(false)}
              className="rounded text-[10px] text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60"
            >
              {t("Undo")}
            </button>
          </span>
        ) : (
          <Button
            size="sm"
            className="h-8 gap-1 bg-brand-green px-3 text-xs font-semibold text-[oklch(0.2_0.04_160)] hover:bg-brand-green/90"
            disabled={!step || busy}
            onClick={() => onToggle(true)}
          >
            <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
            {t("Complete step")}
          </Button>
        )}
      </div>

      {done ? (
        <p
          className={cn(
            "text-[11px] leading-snug text-muted-foreground",
            celebrate && "animate-in fade-in-0 slide-in-from-bottom-1 duration-500",
          )}
        >
          {dayComplete ? (
            <span className="font-semibold text-brand-green">
              {t("Today's steps done: your study day counts.")}
            </span>
          ) : (
            t("Finish the other steps to count your day.")
          )}{" "}
          {t("Tomorrow EVO gives you a new step.")}
        </p>
      ) : null}
    </li>
  );
}
