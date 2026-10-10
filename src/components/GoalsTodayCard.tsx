import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronRight, Flame, Loader2, Plus, Search, Target } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EvoAvatar } from "@/components/EvoAvatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
        // Three slots (user request): one per goal, and every free slot invites
        // the next goal instead of sitting empty.
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
                dayComplete={allDone}
                stepsLeft={steps.filter((item) => !item.doneAt).length}
                celebrate={!!step && justDone === step.id}
                busy={toggle.isPending}
                onToggle={(done) => step && toggle.mutate({ id: step.id, done })}
                t={t}
              />
            );
          })}
          {Array.from({ length: PLUS_MAX_GOALS - goals.length }, (_, index) => (
            <li key={`free-${index}`} className="min-w-0">
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
          ))}
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
  goalId,
  title,
  step,
  week,
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
  dayComplete: boolean;
  stepsLeft: number;
  celebrate: boolean;
  busy: boolean;
  onToggle: (done: boolean) => void;
  t: (label: string) => string;
}) {
  const done = !!step?.doneAt;
  const [detailsOpen, setDetailsOpen] = useState(false);
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
  // Same text-link style as "Open goals" (user request).
  const completeButton = (
    <button
      type="button"
      disabled={!step || busy}
      onClick={() => onToggle(true)}
      aria-label={t("Complete step")}
      title={t("Complete step")}
      className="inline-flex shrink-0 items-center gap-1 rounded-md text-[11px] font-semibold leading-none text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60 disabled:opacity-50"
    >
      {/* A narrow slot (under 18.5rem) shows the same action as a round check. */}
      <span className="grid size-6 place-items-center rounded-full border-2 border-brand-green @[18.5rem]:hidden">
        <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
      </span>
      <span className="hidden items-center gap-1 @[18.5rem]:inline-flex">
        {t("Complete step")}
        <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
      </span>
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
        "h-6",
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
  const actions = done ? (
    <div className="flex items-center gap-2">{doneMark}</div>
  ) : (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {completeButton}
      {practiceLink}
    </div>
  );
  // Every goal has a slot of the same size (user request): the goal's name, a
  // magnifier that opens the step in a popup, and the week and actions on one
  // row, so the row keeps its height whatever the step's length.
  return (
    <li
      className={cn(
        "@container flex min-w-0 flex-col justify-between gap-1.5 rounded-lg px-2.5 py-2 transition-colors",
        done ? "bg-brand-green/10 ring-1 ring-brand-green/30" : "bg-secondary/60",
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <p className="min-w-0 flex-1 text-xs font-semibold leading-snug" translate="no">
          {title}
        </p>
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          aria-label={t("See today's step")}
          title={t("See today's step")}
          className="-m-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60"
        >
          <Search className="size-4" aria-hidden="true" />
        </button>
      </div>
      {/* One row (user request): the week on the left (or, once done, whether
          the study day counts) and the actions on the right. */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 whitespace-nowrap">
        {done ? dayNoteLine : week7(false)}
        {actions}
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="dashboard-shell dark max-w-md border-border shadow-[var(--shadow-soft)]">
          <DialogHeader>
            <DialogDescription className="text-xs font-semibold text-brand-green">
              {t("Your step today")}
            </DialogDescription>
            <DialogTitle className="text-base leading-snug" translate="no">
              {title}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed" translate="no">
            {step?.text ?? "…"}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">{t("Last 7 days")}</span>
            {week7(true)}
          </div>
          {dayNoteLine}
          {/* A container of its own, so "Complete step" shows its full label here. */}
          <div className="@container flex flex-wrap items-center justify-end gap-3 whitespace-nowrap">
            {actions}
          </div>
        </DialogContent>
      </Dialog>
    </li>
  );
}
