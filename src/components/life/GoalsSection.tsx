import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ChevronDown,
  Flame,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Target,
  X,
} from "lucide-react";
import { useState } from "react";

import { notifyLife } from "@/components/life/LifeNotification";
import { GoalPlan } from "@/components/life/GoalPlan";
import { LifeCheckMark, LifeSectionTitle } from "@/components/life/LifeNav";
import { EvoAvatar } from "@/components/EvoAvatar";
import { EvoGuide } from "@/components/EvoGuide";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useLife } from "@/hooks/useLife";
import { effectiveStreak, useProfile } from "@/hooks/useProfile";
import { loadNextStep } from "@/lib/pedagogy/nextStep.functions";
import { skillMeterRows } from "@/lib/pedagogy/skillMeter";
import {
  evolutionScore,
  evolutionScoreComposition,
  evolutionScoreSkillContribution,
  PLUS_GOAL_EXAMPLES,
  PLUS_MAX_GOALS,
  PLUS_SCORE_DAYS,
  plusDayComplete,
} from "@/lib/plus";
import {
  addPlusGoal,
  archivePlusGoal,
  loadPlus,
  renamePlusGoal,
  setPlusStepDone,
} from "@/lib/plus.functions";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/**
 * Goals inside the one-page Life+ AI (user request: one page instead of tabs):
 * the evolution score and each goal with EVO's step of the day, its deadline
 * and milestones. Goals stay free and keep counting toward the streak.
 */
/**
 * The Life+ AI goals: the Evolution score card and the Today's steps card.
 * /life shows them in different bands (user request, 2026-10-22), so `part`
 * picks one; both share the same data and actions.
 */
export function GoalsSection({
  part = "both",
  embedded = false,
}: {
  part?: "both" | "score" | "steps";
  embedded?: boolean;
}) {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  // With goals already set, "+ New goal" opens the form (user request,
  // 2026-10-24); with none, the form and its examples show at once.
  const [adding, setAdding] = useState(false);
  const [showScoreDetails, setShowScoreDetails] = useState(false);

  const load = useServerFn(loadPlus);
  const add = useServerFn(addPlusGoal);
  const archive = useServerFn(archivePlusGoal);
  const setDone = useServerFn(setPlusStepDone);
  const rename = useServerFn(renamePlusGoal);
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);

  const { data: life, refresh: refreshLife } = useLife();
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
      setAdding(false);
      refresh();
    },
    onError: (error) =>
      notifyLife(
        t(error instanceof Error ? error.message : "The goal could not be saved."),
        "error",
      ),
  });
  const removeGoal = useMutation({
    mutationFn: (id: string) => archive({ data: { id } }),
    onSuccess: refresh,
    onError: () => notifyLife(t("The goal could not be removed."), "error"),
  });
  const renameGoal = useMutation({
    mutationFn: (input: { id: string; title: string }) => rename({ data: input }),
    onSuccess: () => {
      setEditing(null);
      refresh();
      refreshLife();
    },
    onError: () => notifyLife(t("The goal could not be saved."), "error"),
  });
  const toggleStep = useMutation({
    mutationFn: (input: { id: string; done: boolean }) => setDone({ data: input }),
    onMutate: (input) => {
      if (input.done) haptic("tap");
    },
    onSuccess: refresh,
    onError: () => notifyLife(t("The step could not be saved."), "error"),
  });

  const goals = data?.goals ?? [];
  const todaySteps = data?.todaySteps ?? [];
  const allDone = plusDayComplete(todaySteps);
  const skillRows = skillMeterRows(nextStep?.skills, null);
  const measuredSkillCount = skillRows.filter((row) => row.value !== null).length;
  const stepsGiven = data?.stepsGiven ?? 0;
  const stepsDone = data?.stepsDone ?? 0;
  const score = evolutionScore({
    englishSkills: skillRows.map((row) => row.value),
    stepsGiven,
    stepsDone,
  });
  const composition = evolutionScoreComposition(score);
  const priorityReasonLabels = {
    recent_errors: "Recent learning errors",
    low_confidence: "More evidence is needed",
    lowest_score: "This is the lowest measured skill",
    not_practised_recently: "Not practised in the last 7 days",
    not_measured_yet: "Not measured yet",
    no_data: "Start building your learning evidence",
  } as const;
  const nextStepHref = nextStep?.activity.params?.lessonId
    ? `/learning/${encodeURIComponent(nextStep.activity.params.lessonId)}`
    : nextStep?.activity.to;
  const canAdd = goals.length < PLUS_MAX_GOALS;
  const submit = (goal: string) => {
    const clean = goal.trim();
    if (clean.length >= 3 && !addGoal.isPending) addGoal.mutate(clean);
  };

  return (
    <div
      id={part === "score" ? undefined : "goals"}
      className={cn(
        "grid h-full scroll-mt-4 gap-4",
        part === "both" ? "grid-rows-[auto_1fr]" : "grid-rows-[minmax(0,1fr)]",
      )}
    >
      {part === "steps" ? null : (
        <section
          className={cn(embedded ? "p-0" : "card-soft p-4 sm:p-5")}
          aria-labelledby="evolution-score-title"
        >
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
                {profile ? effectiveStreak(profile) : 0}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("Finishing all of today's steps also counts for your streak.")}
          </p>
          <button
            type="button"
            aria-expanded={showScoreDetails}
            aria-controls="evolution-score-details"
            onClick={() => setShowScoreDetails((open) => !open)}
            className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            {t("How your score is calculated")}
            <ChevronDown
              className={cn("size-4 transition-transform", showScoreDetails && "rotate-180")}
              aria-hidden="true"
            />
          </button>
          {showScoreDetails ? (
            <div
              id="evolution-score-details"
              className="mt-2 space-y-3 rounded-xl border border-border bg-secondary/30 p-3"
            >
              <p className="text-xs text-muted-foreground">
                {t(
                  "English reflects your measured skill profile. Goals count active-goal steps over the last",
                )}{" "}
                {PLUS_SCORE_DAYS} {t("days, ending today.")}
              </p>
              <div className="space-y-3">
                <ScoreExplanationRow
                  label={t("English")}
                  description={`${t("Measured English skills")}: ${measuredSkillCount}/5 · ${t("simple average")}`}
                  value={score.english}
                  weight={composition.englishWeight}
                  contribution={composition.englishContribution}
                  t={t}
                />
                <div className="space-y-2 rounded-lg bg-background/60 p-3">
                  <p className="text-xs font-semibold">{t("Evidence by skill")}</p>
                  {skillRows.map((row) => {
                    const snapshot = nextStep?.skills?.find((item) => item.skill === row.skill);
                    const level =
                      row.value !== null && snapshot?.cefrLevel ? ` · ${snapshot.cefrLevel}` : "";
                    return (
                      <div
                        key={row.skill}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="text-muted-foreground">
                          {t(row.skill.charAt(0).toUpperCase() + row.skill.slice(1))}
                        </span>
                        <span className="shrink-0 text-right tabular-nums">
                          {row.value === null ? t("Not measured") : `${row.value}%${level}`}
                          {" · "}
                          {row.evidenceCount} {t("evidence items")}
                        </span>
                        {evolutionScoreSkillContribution({
                          skillScore: row.value,
                          measuredSkillCount,
                          englishWeight: composition.englishWeight,
                        }) !== null ? (
                          <span className="block text-right text-[10px] text-muted-foreground">
                            {evolutionScoreSkillContribution({
                              skillScore: row.value,
                              measuredSkillCount,
                              englishWeight: composition.englishWeight,
                            })!.toFixed(1)}{" "}
                            {t("score points")}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                  <div className="space-y-1 border-t border-border pt-2 text-[11px] text-muted-foreground">
                    <p>
                      {t(
                        "A skill needs at least 2 valid evidence items and an effective weight of at least 0.5 to be measured.",
                      )}
                    </p>
                    <p>
                      {t(
                        "Effective weight is sample weight × evidence quality × source reliability. Evidence weight halves every 30 days for the skill score.",
                      )}
                    </p>
                    <p>
                      {t("Reading uses daily reading evidence only; lesson quizzes are excluded.")}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 rounded-lg border border-border bg-background/60 p-3">
                  <p className="text-xs font-semibold">{t("How activities affect your score")}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("An activity does not add points by itself. It can affect English when it creates valid assessment evidence; recent activity history also helps EVO choose what to practise next.")}
                  </p>
                  {nextStep && nextStepHref ? (
                    <div className="border-t border-border pt-2">
                      <p className="text-[11px] font-semibold">{t("Your next recommended action")}</p>
                      <p className="mt-1 text-xs">
                        {nextStep.prioritySkill
                          ? t(nextStep.prioritySkill.charAt(0).toUpperCase() + nextStep.prioritySkill.slice(1))
                          : t("Build your first learning evidence")}
                        {" · "}
                        {t(priorityReasonLabels[nextStep.reason])}
                      </p>
                      <a
                        href={nextStepHref}
                        className="mt-2 inline-flex min-h-8 items-center rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                      >
                        {t("Open recommended practice")}: {nextStep.activity.title}
                      </a>
                    </div>
                  ) : null}
                </div>
                <ScoreExplanationRow
                  label={t("Goals")}
                  description={`${t("Completed steps in active goals")}: ${stepsDone}/${stepsGiven}`}
                  value={score.goals}
                  weight={composition.goalsWeight}
                  contribution={composition.goalsContribution}
                  t={t}
                />
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    "Only steps from active goals dated within this 14-day window count. Future steps and archived goals are excluded.",
                  )}
                </p>
              </div>
              <p className="border-t border-border pt-2 text-xs font-medium">
                {composition.mode === "balanced"
                  ? t("Both dimensions count equally: English × 50% + Goals × 50%.")
                  : composition.mode === "english_only" || composition.mode === "goals_only"
                    ? t("Only the measured dimension counts: 100% of the score.")
                    : t("Your score appears when at least one dimension has valid data.")}
              </p>
            </div>
          ) : null}
        </section>
      )}

      {part === "score" ? null : (
        <section className="card-soft p-4 sm:p-5 xl:p-6" aria-labelledby="today-steps-title">
          <LifeSectionTitle
            id="today-steps-title"
            icon={Target}
            accent="green"
            title={t("Your goals")}
            subtitle={t("EVO's step of the day, deadline and milestones")}
            meta={
              goals.length
                ? `${todaySteps.filter((step) => step.doneAt).length}/${todaySteps.length}`
                : undefined
            }
          />

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
                    {editing?.id === goal.id ? (
                      // The goal's name edited in place (user request: edit goals).
                      <form
                        className="flex flex-wrap gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const clean = editing.title.trim();
                          if (clean.length >= 3 && !renameGoal.isPending)
                            renameGoal.mutate({ id: goal.id, title: clean });
                        }}
                      >
                        <Input
                          value={editing.title}
                          maxLength={120}
                          autoFocus
                          onChange={(event) =>
                            setEditing({ id: goal.id, title: event.target.value })
                          }
                          aria-label={t("Edit goal")}
                          className="w-full"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          className="ml-auto"
                          onClick={() => setEditing(null)}
                        >
                          {t("Cancel")}
                        </Button>
                        <Button
                          type="submit"
                          disabled={editing.title.trim().length < 3 || renameGoal.isPending}
                          className="gap-1.5"
                        >
                          {renameGoal.isPending ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Check className="size-4" aria-hidden="true" />
                          )}
                          {t("Save")}
                        </Button>
                      </form>
                    ) : (
                      <div className="flex items-start gap-2">
                        <p className="min-w-0 flex-1 text-sm font-semibold" translate="no">
                          {goal.title}
                        </p>
                        {/* Managing the goal sits behind one "⋯" (user request,
                            2026-10-24: the card is for today's step). */}
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label={t("Goal options")}
                            title={t("Goal options")}
                            className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                          >
                            <MoreHorizontal className="size-4" aria-hidden="true" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => setEditing({ id: goal.id, title: goal.title })}
                            >
                              <Pencil className="size-4" aria-hidden="true" />
                              {t("Edit goal")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={removeGoal.isPending}
                              onSelect={() => {
                                if (window.confirm(t("Remove this goal?")))
                                  removeGoal.mutate(goal.id);
                              }}
                            >
                              <X className="size-4" aria-hidden="true" />
                              {t("Remove goal")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
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
                        <LifeCheckMark done={done} className="mt-0.5" />
                        <span
                          translate="no"
                          className={cn(done && "text-muted-foreground line-through")}
                        >
                          {step.text}
                        </span>
                      </button>
                    ) : null}
                    {life ? (
                      <GoalPlan
                        goal={
                          life.goals.find((item) => item.id === goal.id) ?? {
                            ...goal,
                            deadline: null,
                            description: null,
                          }
                        }
                        milestones={life.milestones.filter((item) => item.goalId === goal.id)}
                        today={life.today}
                        onChange={refreshLife}
                      />
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

          {canAdd && !isLoading && !isError && goals.length > 0 && !adding ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-brand-green/50 hover:text-foreground"
            >
              <Plus className="size-4" aria-hidden="true" />
              {t("New goal")}{" "}
              <span className="tabular-nums">
                ({goals.length}/{PLUS_MAX_GOALS})
              </span>
            </button>
          ) : null}
          {canAdd && !isLoading && !isError && (goals.length === 0 || adding) ? (
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
                {adding ? (
                  <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                    {t("Cancel")}
                  </Button>
                ) : null}
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
      )}
    </div>
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

function ScoreExplanationRow({
  label,
  description,
  value,
  weight,
  contribution,
  t,
}: {
  label: string;
  description: string;
  value: number | null;
  weight: number | null;
  contribution: number | null;
  t: (label: string) => string;
}) {
  const points = contribution === null ? "—" : Number(contribution.toFixed(1)).toString();
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <div className="min-w-0">
        <p className="font-semibold">{label}</p>
        <p className="mt-0.5 text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0 text-right tabular-nums">
        <p className="font-semibold">{value === null ? "—" : `${value}%`}</p>
        <p className="mt-0.5 text-muted-foreground">
          {weight === null ? t("Not measured") : `${weight}% ${t("weight")}`}
        </p>
        <p className="text-muted-foreground">
          {contribution === null ? "—" : `${points} ${t("points")}`}
        </p>
      </div>
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
