import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Flame, Loader2, Plus, Target, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { EvoAvatar } from "@/components/EvoAvatar";
import { EvoGuide } from "@/components/EvoGuide";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/useProfile";
import { loadNextStep } from "@/lib/pedagogy/nextStep.functions";
import { skillMeterRows } from "@/lib/pedagogy/skillMeter";
import { evolutionScore, PLUS_GOAL_EXAMPLES, PLUS_MAX_GOALS, plusDayComplete } from "@/lib/plus";
import { addPlusGoal, archivePlusGoal, loadPlus, setPlusStepDone } from "@/lib/plus.functions";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({
    meta: [
      { title: "Goals - Evoluir+ English AI" },
      {
        name: "description",
        content: "Choose up to 3 goals and get one small step a day from EVO.",
      },
    ],
  }),
  component: GoalsPage,
});

function GoalsPage() {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");

  const load = useServerFn(loadPlus);
  const add = useServerFn(addPlusGoal);
  const archive = useServerFn(archivePlusGoal);
  const setDone = useServerFn(setPlusStepDone);

  const plusKey = ["plus", profile?.id ?? null, lang] as const;
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: plusKey,
    enabled: !!profile,
    queryFn: () => load({ data: { lang } }),
    staleTime: 30 * 1000,
  });
  // Same evidence-based skills as the Dashboard card (shared cache).
  const { data: nextStep } = useQuery({
    queryKey: ["next-step", profile?.level ?? null],
    queryFn: () => loadNextStep({ data: undefined }),
    staleTime: 60 * 1000,
    enabled: !!profile,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["plus"] });
    void queryClient.invalidateQueries({ queryKey: ["profile"] });
    void queryClient.invalidateQueries({ queryKey: ["qualified-study-days"] });
  };

  const addGoal = useMutation({
    mutationFn: (goal: string) => add({ data: { title: goal } }),
    onSuccess: () => {
      setTitle("");
      refresh();
    },
    onError: (error) =>
      toast.error(t(error instanceof Error ? error.message : "The goal could not be saved.")),
  });
  const removeGoal = useMutation({
    mutationFn: (id: string) => archive({ data: { id } }),
    onSuccess: refresh,
    onError: () => toast.error(t("The goal could not be removed.")),
  });
  const toggleStep = useMutation({
    mutationFn: (input: { id: string; done: boolean }) => setDone({ data: input }),
    onSuccess: refresh,
    onError: () => toast.error(t("The step could not be saved.")),
  });

  const goals = data?.goals ?? [];
  const todaySteps = data?.todaySteps ?? [];
  const allDone = plusDayComplete(todaySteps);
  const score = evolutionScore({
    englishSkills: skillMeterRows(nextStep?.skills, null).map((row) => row.value),
    stepsGiven: data?.stepsGiven ?? 0,
    stepsDone: data?.stepsDone ?? 0,
  });
  const canAdd = goals.length < PLUS_MAX_GOALS;
  const submit = (goal: string) => {
    const clean = goal.trim();
    if (clean.length >= 3 && !addGoal.isPending) addGoal.mutate(clean);
  };

  return (
    <AppShell>
      <h1 className="text-xl font-bold lg:text-3xl">{t("Evoluir+ Goals")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("Your goals, one small step a day.")}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
        <section className="card-soft p-4 sm:p-5" aria-labelledby="evolution-score-title">
          <div className="flex items-center gap-4">
            <ScoreRing value={score.score} />
            <div className="min-w-0">
              <h2 id="evolution-score-title" className="text-base font-semibold">
                {t("Evolution score")}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("Your English and your goals, together.")}
              </p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <ScorePart label={t("English")} value={score.english} suffix="%" />
            <ScorePart label={t("Goals")} value={score.goals} suffix="%" />
            <div className="rounded-xl bg-secondary/60 p-2">
              <dt className="text-[11px] text-muted-foreground">{t("Streak")}</dt>
              <dd className="mt-0.5 flex items-center justify-center gap-1 text-lg font-bold">
                <Flame className="size-4 text-dashboard-cyan" aria-hidden="true" />
                {profile?.streak_days ?? 0}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("Finishing all of today's steps also counts for your streak.")}
          </p>
        </section>

        <section className="card-soft p-4 sm:p-5" aria-labelledby="today-steps-title">
          <h2 id="today-steps-title" className="flex items-center gap-2 text-base font-semibold">
            <Target className="size-5 text-brand-green" aria-hidden="true" />
            {t("Today's steps")}
          </h2>

          {isLoading ? (
            <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
              <EvoAvatar decorative className="size-10" />
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t("EVO is preparing today's steps…")}
            </div>
          ) : isError ? (
            <div className="mt-4 space-y-3 text-sm">
              <p className="text-muted-foreground">{t("Your goals could not be loaded.")}</p>
              <Button variant="outline" onClick={() => void refetch()}>
                {t("Try again")}
              </Button>
            </div>
          ) : goals.length === 0 ? (
            <EvoGuide
              className="mt-4"
              image="avatar"
              title={t("Choose 1 to 3 goals and I will give you one small step a day.")}
            />
          ) : (
            <ul className="mt-4 space-y-3">
              {goals.map((goal) => {
                const step = todaySteps.find((item) => item.goalId === goal.id);
                const done = !!step?.doneAt;
                return (
                  <li key={goal.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 text-sm font-semibold" translate="no">
                        {goal.title}
                      </p>
                      <button
                        type="button"
                        aria-label={t("Remove goal")}
                        title={t("Remove goal")}
                        disabled={removeGoal.isPending}
                        onClick={() => {
                          if (window.confirm(t("Remove this goal?"))) removeGoal.mutate(goal.id);
                        }}
                        className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                    {step ? (
                      <button
                        type="button"
                        aria-pressed={done}
                        disabled={toggleStep.isPending}
                        onClick={() => toggleStep.mutate({ id: step.id, done: !done })}
                        className={cn(
                          "mt-2 flex w-full items-start gap-3 rounded-lg p-2 text-left text-sm transition-colors",
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
                        <span
                          translate="no"
                          className={cn(done && "text-muted-foreground line-through")}
                        >
                          {step.text}
                        </span>
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {allDone && goals.length > 0 ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-brand-green/10 p-3 text-sm">
              <EvoAvatar decorative className="size-10" />
              <p className="font-medium">
                {t("All of today's steps are done. Today counts for your streak!")}
              </p>
            </div>
          ) : null}

          {canAdd && !isLoading && !isError ? (
            <form
              className="mt-5 border-t border-border pt-4"
              onSubmit={(event) => {
                event.preventDefault();
                submit(title);
              }}
            >
              <label htmlFor="plus-goal" className="text-sm font-medium">
                {t("New goal")}{" "}
                <span className="text-muted-foreground">
                  ({goals.length}/{PLUS_MAX_GOALS})
                </span>
              </label>
              <div className="mt-2 flex gap-2">
                <Input
                  id="plus-goal"
                  value={title}
                  maxLength={120}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t("Your goal")}
                />
                <Button
                  type="submit"
                  disabled={title.trim().length < 3 || addGoal.isPending}
                  className="shrink-0 gap-1.5"
                >
                  {addGoal.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Plus className="size-4" aria-hidden="true" />
                  )}
                  {t("Add")}
                </Button>
              </div>
              {goals.length === 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {PLUS_GOAL_EXAMPLES.map((example) => (
                    <Button
                      key={example}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={addGoal.isPending}
                      onClick={() => submit(t(example))}
                    >
                      {t(example)}
                    </Button>
                  ))}
                </div>
              ) : null}
            </form>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

function ScoreRing({ value }: { value: number | null }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const shown = value ?? 0;
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
          strokeDashoffset={circumference * (1 - shown / 100)}
        />
      </svg>
      <span className="text-2xl font-bold">{value === null ? "—" : value}</span>
    </div>
  );
}

function ScorePart({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | null;
  suffix: string;
}) {
  return (
    <div className="rounded-xl bg-secondary/60 p-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold">{value === null ? "—" : `${value}${suffix}`}</dd>
    </div>
  );
}
