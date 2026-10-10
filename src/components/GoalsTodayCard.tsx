import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronRight, Flame, Loader2, Plus, Target } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EvoAvatar } from "@/components/EvoAvatar";
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
        <ul className="mt-1.5 grid gap-2 sm:grid-cols-3 xl:min-h-0 xl:flex-1">
          {goals.map((goal) => {
            const step = steps.find((item) => item.goalId === goal.id) ?? null;
            return (
              <GoalTile
                key={goal.id}
                goalId={goal.id}
                title={goal.title}
                step={step}
                week={plusGoalWeek(recent, goal.id, data?.today ?? "")}
                featured={goals.length === 1}
                dayComplete={allDone}
                stepsLeft={steps.filter((item) => !item.doneAt).length}
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
                className="flex h-full min-w-0 flex-col justify-center gap-0.5 rounded-lg border border-dashed border-border px-3 py-1.5 transition-colors hover:border-brand-green/50 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60"
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  <span
                    className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-green/15 text-brand-green"
                    aria-hidden="true"
                  >
                    <Plus className="size-3" strokeWidth={3} />
                  </span>
                  {t("Add another goal")}
                </span>
                <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
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
 * One goal's step (user request: a step that encourages, not a cramped to-do).
 * No text is cut: the goal and its step wrap and the row grows. One goal uses
 * the wide tile with its actions column; two or three goals put the actions on
 * a row below the step.
 */
function GoalTile({
  goalId,
  title,
  step,
  week,
  featured,
  dayComplete,
  stepsLeft,
  celebrate,
  busy,
  onToggle,
  t,
}: {
  goalId: string;
  title: string;
  step: PlusStep | null;
  week: PlusGoalWeek;
  featured: boolean;
  dayComplete: boolean;
  stepsLeft: number;
  celebrate: boolean;
  busy: boolean;
  onToggle: (done: boolean) => void;
  t: (label: string) => string;
}) {
  const done = !!step?.doneAt;
  const dots = (
    <span
      className="flex shrink-0 items-center gap-1"
      title={`${t("Last 7 days")}: ${t("{n} of 7 days").replace("{n}", String(week.doneCount))}`}
    >
      {/* Narrow tiles on smaller screens keep the goal's name and only the 🔥 run. */}
      <span
        className={cn("flex gap-0.5", !featured && "hidden min-[1536px]:flex")}
        aria-hidden="true"
      >
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
      <span className={cn("text-[10px] font-medium text-muted-foreground", !featured && "sr-only")}>
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
  // Same text-link style as "Open goals" (user request).
  const completeButton = (
    <button
      type="button"
      disabled={!step || busy}
      onClick={() => onToggle(true)}
      className="inline-flex shrink-0 items-center gap-1 rounded-md text-[11px] font-semibold leading-none text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60 disabled:opacity-50"
    >
      {t("Complete step")}
      <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
    </button>
  );
  // The goal's English with EVO: a teal button with dark text (user request).
  const practiceLink = (
    <Link
      to="/coach"
      search={{ goal: goalId }}
      aria-label={t("Practise it in English with EVO")}
      title={t("Practise it in English with EVO")}
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full bg-brand-green px-2.5 text-[11px] font-semibold leading-none text-black transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60",
        featured ? "h-5 min-[1536px]:h-7 min-[1536px]:px-3" : "h-5",
      )}
    >
      {t("Practice now")}
      <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
    </Link>
  );
  const dayNote = dayComplete
    ? t("Your study day counts!")
    : stepsLeft === 1
      ? t("1 more step to count your day")
      : t("{n} more steps to count your day").replace("{n}", String(stepsLeft));
  const doneMark = (
    <>
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full bg-brand-green text-[oklch(0.2_0.04_160)]",
          celebrate && "animate-in zoom-in-50 fade-in-0 duration-500",
        )}
        title={t("Step done!")}
      >
        <Check className="size-4" strokeWidth={3} aria-hidden="true" />
        <span className="sr-only">{t("Step done!")}</span>
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={() => onToggle(false)}
        className="rounded text-[10px] leading-none text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60"
      >
        {t("Undo")}
      </button>
    </>
  );
  // No text is ever cut (user request): the goal and its step wrap, and the
  // row grows with them.
  const text = (
    <>
      <p className="text-[11px] font-semibold leading-tight text-muted-foreground">
        {featured ? (
          <>
            <span className="text-brand-green">{t("Your step today")}</span>
            <span aria-hidden="true"> · </span>
          </>
        ) : null}
        <span translate="no">{title}</span>
      </p>
      <p
        className={cn("mt-0.5 text-xs leading-snug", done && "text-muted-foreground")}
        translate="no"
      >
        {step?.text ?? "…"}
      </p>
      {done ? (
        <p
          className={cn(
            "text-[11px] font-semibold leading-snug",
            dayComplete ? "text-brand-green" : "text-muted-foreground",
            celebrate && "animate-in fade-in-0 slide-in-from-bottom-1 duration-500",
          )}
        >
          {dayNote}
        </p>
      ) : null}
    </>
  );
  const tileClass = cn(
    "min-w-0 rounded-lg px-2.5 py-1.5 transition-colors",
    done ? "bg-brand-green/10 ring-1 ring-brand-green/30" : "bg-secondary/60",
  );

  if (!featured) {
    // Two or three goals (user request): each tile is narrow, so the goal and
    // its step take the whole width and the actions sit on one row below them.
    return (
      <li className={cn(tileClass, "flex flex-col gap-1.5")}>
        <div className="min-w-0">{text}</div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {dots}
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {done ? (
              doneMark
            ) : (
              <>
                {completeButton}
                {practiceLink}
              </>
            )}
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className={cn(tileClass, "flex items-center gap-2.5 sm:col-span-2")}>
      <EvoAvatar decorative className="size-9 shrink-0" />
      {/* The step takes 3/5 of the tile and wraps before the actions column. */}
      <div className="min-w-0 flex-[3]">{text}</div>
      {/* After a divider (user request): the week above "Complete step" in one
          column and "Practice now" in a second one beside it; below 1536 px the
          tile is too narrow for two columns, so the three stack. */}
      <div className="flex flex-[2] flex-col items-center justify-center gap-1 self-stretch whitespace-nowrap border-l border-border/60 pl-3 min-[1536px]:flex-row min-[1536px]:gap-4">
        <div className="flex flex-col items-center gap-1 min-[1536px]:gap-1.5">
          {dots}
          {done ? <div className="flex items-center gap-2">{doneMark}</div> : completeButton}
        </div>
        {done ? null : practiceLink}
      </div>
    </li>
  );
}
