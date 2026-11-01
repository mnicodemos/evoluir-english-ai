import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Check,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Scale,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MessageResponse } from "@/components/ai-elements/message";
import { AppShell } from "@/components/AppShell";
import { EvoAvatar } from "@/components/EvoAvatar";
import { LifeEmpty, LifePremiumGate, LifeSectionTitle, useLifeT } from "@/components/life/LifeNav";
import { PageHeader } from "@/components/PageHeader";
import { CopyButton } from "@/components/ShareActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/useProfile";
import {
  cleanRatings,
  DECISION_MAX_CRITERIA,
  DECISION_MAX_OPTIONS,
  DECISION_MIN_CRITERIA,
  DECISION_MIN_OPTIONS,
  DECISION_RATING_MAX,
  DECISION_RATING_MIN,
  DECISION_WEIGHT_MAX,
  DECISION_WEIGHT_MIN,
  decisionInputSchema,
  decisionResult,
  newItemId,
  ratingKey,
  starterDecision,
  type DecisionInput,
  type DecisionResult,
  type LifeDecision,
} from "@/lib/lifeDecisions";
import {
  analyzeLifeDecision,
  chooseLifeDecision,
  deleteLifeDecision,
  loadLifeDecisions,
  saveLifeDecision,
} from "@/lib/lifeDecisions.functions";
import { cn } from "@/lib/utils";

type T = (label: string) => string;
type View = { kind: "list" } | { kind: "edit"; id: string | null } | { kind: "detail"; id: string };

const WEIGHTS = Array.from(
  { length: DECISION_WEIGHT_MAX - DECISION_WEIGHT_MIN + 1 },
  (_, index) => DECISION_WEIGHT_MIN + index,
);
const RATINGS = Array.from(
  { length: DECISION_RATING_MAX - DECISION_RATING_MIN + 1 },
  (_, index) => DECISION_RATING_MIN + index,
);

/**
 * Decisions (Life+ AI phase 2, user request; the owner's Decision AI module):
 * a weighted matrix of options and criteria, the ranking it gives, a what-if
 * simulator for the weights, EVO's analysis and "turn into a goal". Premium,
 * like Routine and Habits; one page with a list, an editor and a detail view.
 */
export function DecisionsPage() {
  return (
    <AppShell>
      <DecisionsWorkspace variant="page" />
    </AppShell>
  );
}

/**
 * The decisions themselves: list, editor and detail. The /life/decisions page
 * shows them under its PageHeader; the /life page shows them in its Decisions
 * tab (owner request, 2026-11-01: students forgot the header capsule), under a
 * section title with the same New decision button.
 */
export function DecisionsWorkspace({ variant }: { variant: "page" | "tab" }) {
  const { t } = useLifeT();
  const { data: profile } = useProfile();
  const load = useServerFn(loadLifeDecisions);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["life-decisions", profile?.id ?? null],
    enabled: !!profile,
    queryFn: () => load(),
    staleTime: 30 * 1000,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["life-decisions"] });
  const [view, setView] = useState<View>({ kind: "list" });

  const newButton =
    data?.premium && data.available && view.kind === "list" ? (
      <Button
        size="sm"
        className="gap-1.5 bg-brand-green text-sidebar hover:bg-brand-green/90"
        onClick={() => setView({ kind: "edit", id: null })}
      >
        <Plus className="size-4" aria-hidden="true" />
        {t("New decision")}
      </Button>
    ) : null;
  const header =
    variant === "tab" ? (
      <LifeSectionTitle
        id="decisions-title"
        icon={Scale}
        accent="violet"
        title={t("Decisions")}
        subtitle={t("Compare your options with clear criteria and decide with more confidence.")}
      >
        {newButton ? <div className="ml-auto">{newButton}</div> : null}
      </LifeSectionTitle>
    ) : (
      <PageHeader
        icon={Scale}
        accent="violet"
        eyebrow="Life+ AI"
        title={t("Decisions")}
        description={t("Compare your options with clear criteria and decide with more confidence.")}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/life" aria-label={t("Back to Life+ AI")}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t("Life+ AI")}</span>
              </Link>
            </Button>
            {newButton}
          </div>
        }
      />
    );

  if (isLoading || !data) {
    return (
      <>
        {header}
        <div className="mt-4 grid gap-4 lg:grid-cols-2" aria-busy="true">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </>
    );
  }

  const current =
    view.kind === "list" || (view.kind === "edit" && view.id === null)
      ? null
      : (data.decisions.find((decision) => decision.id === view.id) ?? null);

  return (
    <>
      {header}
      <div className="mt-4">
        {!data.premium ? (
          <LifePremiumGate feature="Decisions" />
        ) : !data.available ? (
          <section className="card-soft p-5">
            <LifeEmpty>{t("Decisions will be available soon. Please come back later.")}</LifeEmpty>
          </section>
        ) : view.kind === "edit" ? (
          <DecisionEditor
            key={view.id ?? "new"}
            t={t}
            initial={current}
            onCancel={() =>
              setView(current ? { kind: "detail", id: current.id } : { kind: "list" })
            }
            onSaved={async (id) => {
              // Open the saved decision once the list has it, so the page
              // never flashes the list in between.
              await refresh();
              setView({ kind: "detail", id });
            }}
          />
        ) : view.kind === "detail" && current ? (
          <DecisionDetail
            key={current.id}
            t={t}
            decision={current}
            onBack={() => setView({ kind: "list" })}
            onEdit={() => setView({ kind: "edit", id: current.id })}
            onChanged={() => void refresh()}
            onDeleted={() => {
              void refresh();
              setView({ kind: "list" });
            }}
          />
        ) : (
          <DecisionList
            t={t}
            decisions={data.decisions}
            onOpen={(id) => setView({ kind: "detail", id })}
            onNew={() => setView({ kind: "edit", id: null })}
          />
        )}
      </div>
    </>
  );
}

function DecisionList({
  t,
  decisions,
  onOpen,
  onNew,
}: {
  t: T;
  decisions: LifeDecision[];
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  if (!decisions.length) {
    return (
      <section className="card-soft space-y-4 p-5 sm:p-6">
        <LifeEmpty>
          {t(
            "Stuck between options? List them, choose what matters to you and EVO helps you see the best path.",
          )}
        </LifeEmpty>
        <ol className="grid gap-2 text-sm sm:grid-cols-3">
          {[
            "Write the decision and your options.",
            "Add the criteria that matter, each with a weight.",
            "Score each option and see the result.",
          ].map((step, index) => (
            <li key={step} className="flex gap-2 rounded-lg bg-secondary/40 px-3 py-2">
              <span className="font-display font-semibold text-violet-300 tabular-nums">
                {index + 1}
              </span>
              <span>{t(step)}</span>
            </li>
          ))}
        </ol>
        <Button
          className="gap-1.5 bg-brand-green text-sidebar hover:bg-brand-green/90"
          onClick={onNew}
        >
          <Plus className="size-4" aria-hidden="true" />
          {t("New decision")}
        </Button>
      </section>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {decisions.map((decision) => {
        const result = decisionResult(decision);
        const chosen = decision.options.find((option) => option.id === decision.chosenOptionId);
        return (
          <button
            key={decision.id}
            type="button"
            onClick={() => onOpen(decision.id)}
            className="card-soft group flex flex-col gap-3 p-4 text-left transition-colors hover:bg-white/[0.03] sm:p-5"
          >
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  decision.status === "decided"
                    ? "bg-brand-green/15 text-brand-green"
                    : "bg-violet-400/15 text-violet-300",
                )}
              >
                {decision.status === "decided" ? t("Decided") : t("In progress")}
              </span>
              <ChevronRight
                className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </div>
            <h2 className="font-display text-base font-semibold leading-snug">{decision.title}</h2>
            <p className="text-xs text-muted-foreground">
              {chosen ? (
                <>
                  <span>{t("Your choice:")}</span>{" "}
                  <span className="font-semibold text-foreground">{chosen.name}</span>
                </>
              ) : result.winner ? (
                <>
                  <span>{t("Leading:")}</span>{" "}
                  <span className="font-semibold text-foreground">{result.winner.name}</span>{" "}
                  <span className="tabular-nums">{`${result.winner.score.toFixed(1)}/10`}</span>
                </>
              ) : (
                t("Score the options to see the result.")
              )}
            </p>
            <p className="mt-auto text-[11px] text-muted-foreground">
              <span className="tabular-nums">{decision.options.length}</span>{" "}
              <span>{t("options")}</span>
              {" · "}
              <span className="tabular-nums">{decision.criteria.length}</span>{" "}
              <span>{t("criteria")}</span>
            </p>
          </button>
        );
      })}
    </div>
  );
}

/** Creates or edits a decision: the question, its options, criteria with weights, and the scores. */
function DecisionEditor({
  t,
  initial,
  onCancel,
  onSaved,
}: {
  t: T;
  initial: LifeDecision | null;
  onCancel: () => void;
  onSaved: (id: string) => Promise<void>;
}) {
  const save = useServerFn(saveLifeDecision);
  const [draft, setDraft] = useState<DecisionInput>(() =>
    initial
      ? {
          title: initial.title,
          context: initial.context,
          options: initial.options,
          criteria: initial.criteria,
          ratings: initial.ratings,
        }
      : starterDecision(t),
  );
  const patch = (next: Partial<DecisionInput>) => setDraft((value) => ({ ...value, ...next }));
  const valid = decisionInputSchema.safeParse({ ...draft, ratings: cleanRatings(draft) }).success;
  const missing = decisionResult(draft).missing;

  const saving = useMutation({
    mutationFn: () =>
      save({
        data: {
          ...(initial ? { id: initial.id } : {}),
          decision: { ...draft, ratings: cleanRatings(draft) },
        },
      }),
    onSuccess: async ({ id }) => {
      toast.success(t("Decision saved."));
      await onSaved(id);
    },
    onError: (error) =>
      toast.error(t(error instanceof Error ? error.message : "The decision could not be saved.")),
  });

  const setRating = (optionId: string, criterionId: string, value: number | null) => {
    const ratings = { ...draft.ratings };
    if (value === null) delete ratings[ratingKey(optionId, criterionId)];
    else ratings[ratingKey(optionId, criterionId)] = value;
    patch({ ratings });
  };

  return (
    <form
      className="grid gap-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !saving.isPending) saving.mutate();
      }}
    >
      <div className="space-y-4">
        <section className="card-soft space-y-3 p-4 sm:p-5" aria-labelledby="decision-question">
          <LifeSectionTitle
            id="decision-question"
            icon={Scale}
            accent="violet"
            title={initial ? t("Edit decision") : t("New decision")}
          />
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t("What do you need to decide?")}
            </span>
            <Input
              value={draft.title}
              maxLength={140}
              placeholder={t("E.g. Which course should I take next year?")}
              onChange={(event) => patch({ title: event.target.value })}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t("Context (optional)")}
            </span>
            <Textarea
              value={draft.context}
              maxLength={600}
              rows={3}
              placeholder={t("Details or limits that matter for this decision")}
              onChange={(event) => patch({ context: event.target.value })}
            />
          </label>
        </section>

        <section className="card-soft space-y-3 p-4 sm:p-5" aria-labelledby="decision-options">
          <LifeSectionTitle
            id="decision-options"
            icon={Target}
            accent="sky"
            title={t("Options")}
            meta={`${draft.options.length}/${DECISION_MAX_OPTIONS}`}
          />
          {draft.options.map((option, index) => (
            <div key={option.id} className="flex items-center gap-2">
              <Input
                value={option.name}
                maxLength={80}
                aria-label={`${t("Option")} ${index + 1}`}
                onChange={(event) =>
                  patch({
                    options: draft.options.map((item) =>
                      item.id === option.id ? { ...item, name: event.target.value } : item,
                    ),
                  })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label={t("Remove")}
                disabled={draft.options.length <= DECISION_MIN_OPTIONS}
                onClick={() =>
                  patch({ options: draft.options.filter((item) => item.id !== option.id) })
                }
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={draft.options.length >= DECISION_MAX_OPTIONS}
            onClick={() =>
              patch({
                options: [
                  ...draft.options,
                  { id: newItemId(), name: `${t("Option")} ${draft.options.length + 1}` },
                ],
              })
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            {t("Add option")}
          </Button>
        </section>
      </div>

      <div className="space-y-4">
        <section className="card-soft space-y-3 p-4 sm:p-5" aria-labelledby="decision-criteria">
          <LifeSectionTitle
            id="decision-criteria"
            icon={SlidersHorizontal}
            accent="amber"
            title={t("Criteria and weights")}
            subtitle={t("Weight 1 = matters a little, 5 = matters a lot.")}
            meta={`${draft.criteria.length}/${DECISION_MAX_CRITERIA}`}
          />
          {draft.criteria.map((criterion, index) => (
            <div key={criterion.id} className="flex flex-wrap items-center gap-2">
              <Input
                className="min-w-[10rem] flex-1"
                value={criterion.name}
                maxLength={60}
                aria-label={`${t("Criterion")} ${index + 1}`}
                onChange={(event) =>
                  patch({
                    criteria: draft.criteria.map((item) =>
                      item.id === criterion.id ? { ...item, name: event.target.value } : item,
                    ),
                  })
                }
              />
              <div className="flex gap-1" role="group" aria-label={t("Weight")}>
                {WEIGHTS.map((weight) => (
                  <button
                    key={weight}
                    type="button"
                    aria-pressed={criterion.weight === weight}
                    onClick={() =>
                      patch({
                        criteria: draft.criteria.map((item) =>
                          item.id === criterion.id ? { ...item, weight } : item,
                        ),
                      })
                    }
                    className={cn(
                      "grid size-8 place-items-center rounded-full border text-xs font-semibold tabular-nums transition-colors",
                      criterion.weight === weight
                        ? "border-amber-400/60 bg-amber-400/15 text-amber-300"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {weight}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label={t("Remove")}
                disabled={draft.criteria.length <= DECISION_MIN_CRITERIA}
                onClick={() =>
                  patch({ criteria: draft.criteria.filter((item) => item.id !== criterion.id) })
                }
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={draft.criteria.length >= DECISION_MAX_CRITERIA}
            onClick={() =>
              patch({
                criteria: [
                  ...draft.criteria,
                  { id: newItemId(), name: t("New criterion"), weight: 3 },
                ],
              })
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            {t("Add criterion")}
          </Button>
        </section>

        <section className="card-soft space-y-3 p-4 sm:p-5" aria-labelledby="decision-scores">
          <LifeSectionTitle
            id="decision-scores"
            icon={Award}
            accent="green"
            title={t("Scores")}
            subtitle={t(
              "How well does each option meet each criterion? 1 = poorly, 10 = very well.",
            )}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2 font-medium">{t("Criterion")}</th>
                  {draft.options.map((option) => (
                    <th key={option.id} className="px-1 py-2 text-center font-medium">
                      <span className="line-clamp-2">{option.name || "—"}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draft.criteria.map((criterion) => (
                  <tr key={criterion.id} className="border-t border-border">
                    <td className="py-2 pr-2">
                      <span className="line-clamp-2">{criterion.name || "—"}</span>
                      <span className="text-[11px] text-muted-foreground">
                        <span>{t("Weight")}</span>{" "}
                        <span className="tabular-nums">{criterion.weight}</span>
                      </span>
                    </td>
                    {draft.options.map((option) => {
                      const value = draft.ratings[ratingKey(option.id, criterion.id)];
                      return (
                        <td key={option.id} className="px-1 py-2 text-center">
                          <select
                            aria-label={`${option.name} · ${criterion.name}`}
                            value={value ?? ""}
                            onChange={(event) =>
                              setRating(
                                option.id,
                                criterion.id,
                                event.target.value ? Number(event.target.value) : null,
                              )
                            }
                            className={cn(
                              "h-9 w-16 rounded-md border bg-background px-2 text-center tabular-nums",
                              value ? "border-border" : "border-dashed border-amber-400/50",
                            )}
                          >
                            <option value="">—</option>
                            {RATINGS.map((rating) => (
                              <option key={rating} value={rating}>
                                {rating}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {missing ? (
            <p className="text-xs text-amber-300">
              <span className="tabular-nums">{missing}</span>{" "}
              <span>{t("scores left: an empty score counts as 0.")}</span>
            </p>
          ) : null}
        </section>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("Cancel")}
          </Button>
          <Button
            type="submit"
            disabled={!valid || saving.isPending}
            className="gap-1.5 bg-brand-green text-sidebar hover:bg-brand-green/90"
          >
            {saving.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            {t("Save decision")}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Ranking({ t, result }: { t: T; result: DecisionResult }) {
  return (
    <ol className="space-y-2.5">
      {result.ranking.map((score, index) => (
        <li key={score.optionId}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span
              className={cn("min-w-0 truncate", index === 0 && result.winner && "font-semibold")}
            >
              <span className="mr-1.5 text-xs text-muted-foreground tabular-nums">{`${index + 1}.`}</span>
              {score.name}
            </span>
            <span className="shrink-0 font-display font-semibold tabular-nums">
              {`${score.score.toFixed(1)}/10`}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden="true">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                index === 0 && result.winner ? "bg-brand-green" : "bg-violet-400/70",
              )}
              style={{ width: `${score.percent}%` }}
            />
          </div>
        </li>
      ))}
      {!result.winner ? (
        <li className="text-xs text-muted-foreground">
          {t("Score the options to see the result.")}
        </li>
      ) : null}
    </ol>
  );
}

function DecisionDetail({
  t,
  decision,
  onBack,
  onEdit,
  onChanged,
  onDeleted,
}: {
  t: T;
  decision: LifeDecision;
  onBack: () => void;
  onEdit: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const { lang } = useLifeT();
  const analyze = useServerFn(analyzeLifeDecision);
  const choose = useServerFn(chooseLifeDecision);
  const remove = useServerFn(deleteLifeDecision);
  const queryClient = useQueryClient();
  // What-if weights (not saved): the result follows them while they differ.
  const [weights, setWeights] = useState<Record<string, number>>({});
  const simulating = Object.keys(weights).length > 0;
  const base = decisionResult(decision);
  const result = simulating ? decisionResult(decision, weights) : base;
  const chosen = decision.options.find((option) => option.id === decision.chosenOptionId) ?? null;
  const [pick, setPick] = useState<string>(
    chosen?.id ?? base.winner?.optionId ?? decision.options[0]?.id ?? "",
  );
  const pickName = decision.options.find((option) => option.id === pick)?.name ?? "";

  const analysis = useMutation({
    mutationFn: () => analyze({ data: { id: decision.id, lang } }),
    onSuccess: () => onChanged(),
    onError: (error) =>
      toast.error(
        t(
          error instanceof Error && /busy|running|wait/i.test(error.message)
            ? "Your previous message is still being answered. Wait a few seconds and send it again."
            : "EVO could not analyse this decision. Please try again.",
        ),
      ),
  });
  const choice = useMutation({
    mutationFn: (input: { optionId: string | null; goal: boolean }) =>
      choose({ data: { id: decision.id, ...input } }),
    onSuccess: (outcome, input) => {
      onChanged();
      if (outcome.goal === "created") {
        void queryClient.invalidateQueries({ queryKey: ["life"] });
        void queryClient.invalidateQueries({ queryKey: ["plus"] });
        toast.success(t("Goal created in Life+ AI. EVO will give you a step every day."));
      } else if (outcome.goal === "full") {
        toast(t("You already have 3 goals. Finish or archive one to add this choice as a goal."));
      } else if (input.optionId) toast.success(t("Choice saved."));
    },
    onError: (error) =>
      toast.error(t(error instanceof Error ? error.message : "The decision could not be saved.")),
  });
  const deletion = useMutation({
    mutationFn: () => remove({ data: { id: decision.id } }),
    onSuccess: () => {
      toast.success(t("Decision deleted."));
      onDeleted();
    },
    onError: () => toast.error(t("The decision could not be deleted.")),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-1" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("All decisions")}
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onEdit}>
            <Pencil className="size-4" aria-hidden="true" />
            {t("Edit")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-destructive"
            disabled={deletion.isPending}
            onClick={() => {
              if (window.confirm(t("Delete this decision?"))) deletion.mutate();
            }}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {t("Delete")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3 xl:gap-5">
        {/* The result: leader, close call, the ranking and the choice. */}
        <section
          className="card-soft relative space-y-4 overflow-hidden p-4 sm:p-5 xl:col-span-2 xl:p-6"
          aria-labelledby="decision-title"
        >
          <div
            className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-violet-400/10 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative">
            <h2 id="decision-title" className="font-display text-xl font-semibold leading-snug">
              {decision.title}
            </h2>
            {decision.context ? (
              <p className="mt-1 text-sm text-muted-foreground">{decision.context}</p>
            ) : null}
          </div>
          {result.winner ? (
            <div className="relative flex items-center gap-3 rounded-xl bg-brand-green/10 p-3">
              <Award className="size-6 shrink-0 text-brand-green" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-green">
                  {simulating ? t("Best option in this scenario") : t("Best option")}
                </p>
                <p className="font-display text-lg font-semibold">{result.winner.name}</p>
              </div>
              <span className="ml-auto font-display text-2xl font-bold tabular-nums">
                {result.winner.score.toFixed(1)}
              </span>
            </div>
          ) : null}
          {result.closeCall ? (
            <p className="relative flex gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              {t(
                "Close call: the first two options are less than 5% apart. Weigh the risks before choosing.",
              )}
            </p>
          ) : null}
          {result.missing ? (
            <p className="relative text-xs text-amber-300">
              <span className="tabular-nums">{result.missing}</span>{" "}
              <span>{t("scores left: an empty score counts as 0.")}</span>
            </p>
          ) : null}
          <div className="relative">
            <Ranking t={t} result={result} />
          </div>

          {/* The choice is the student's: mark it, and turn it into a goal. */}
          <div className="relative space-y-3 border-t border-border pt-4">
            {chosen ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm">
                  <span className="text-muted-foreground">{t("Your choice:")}</span>{" "}
                  <span className="font-semibold">{chosen.name}</span>
                </p>
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={choice.isPending}
                    onClick={() => choice.mutate({ optionId: chosen.id, goal: true })}
                  >
                    <Target className="size-4" aria-hidden="true" />
                    {t("Turn into a goal")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5"
                    disabled={choice.isPending}
                    onClick={() => choice.mutate({ optionId: null, goal: false })}
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    {t("Reopen")}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium">{t("What did you decide?")}</p>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Options")}>
                  {decision.options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={pick === option.id}
                      onClick={() => setPick(option.id)}
                      className={cn(
                        "h-8 rounded-full border px-3 text-xs font-medium transition-colors",
                        pick === option.id
                          ? "border-brand-green/60 bg-brand-green/12 text-brand-green"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {option.name}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="gap-1.5 bg-brand-green text-sidebar hover:bg-brand-green/90"
                    disabled={!pick || choice.isPending}
                    onClick={() => choice.mutate({ optionId: pick, goal: true })}
                  >
                    <Target className="size-4" aria-hidden="true" />
                    {t("Choose and create a goal")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={!pick || choice.isPending}
                    onClick={() => choice.mutate({ optionId: pick, goal: false })}
                  >
                    <Check className="size-4" aria-hidden="true" />
                    {t("Only mark my choice")}
                  </Button>
                </div>
                {pickName ? (
                  <p className="text-[11px] text-muted-foreground">
                    {t("The goal takes the option's name; EVO then gives you one step a day.")}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </section>

        {/* What-if: move the weights and watch the ranking change. */}
        <section className="card-soft space-y-4 p-4 sm:p-5 xl:p-6" aria-labelledby="decision-sim">
          <LifeSectionTitle
            id="decision-sim"
            icon={SlidersHorizontal}
            accent="amber"
            title={t("What if?")}
            subtitle={t("Change the weights to test other scenarios. Nothing is saved.")}
          >
            {simulating ? (
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => setWeights({})}>
                <RotateCcw className="size-3.5" aria-hidden="true" />
                {t("Reset")}
              </Button>
            ) : null}
          </LifeSectionTitle>
          <div className="space-y-3">
            {decision.criteria.map((criterion) => {
              const value = weights[criterion.id] ?? criterion.weight;
              return (
                <label key={criterion.id} className="block">
                  <span className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">{criterion.name}</span>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-semibold tabular-nums",
                        value !== criterion.weight ? "text-amber-300" : "text-muted-foreground",
                      )}
                    >
                      <span>{t("Weight")}</span> <span>{value}</span>
                    </span>
                  </span>
                  <input
                    type="range"
                    min={DECISION_WEIGHT_MIN}
                    max={DECISION_WEIGHT_MAX}
                    step={1}
                    value={value}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      setWeights((current) => {
                        const copy = { ...current };
                        if (next === criterion.weight) delete copy[criterion.id];
                        else copy[criterion.id] = next;
                        return copy;
                      });
                    }}
                    className="mt-1 w-full accent-amber-400"
                  />
                </label>
              );
            })}
          </div>
          {simulating && base.winner && result.winner?.optionId !== base.winner.optionId ? (
            <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
              <span>{t("In this scenario the best option changes to")}</span>{" "}
              <span className="font-semibold">{result.winner?.name ?? "—"}</span>
            </p>
          ) : null}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3 xl:gap-5">
        <MatrixTable t={t} decision={decision} result={base} />

        <section
          className="card-soft space-y-3 p-4 sm:p-5 xl:p-6"
          aria-labelledby="decision-analysis"
        >
          <LifeSectionTitle
            id="decision-analysis"
            icon={Sparkles}
            accent="green"
            title={t("EVO's analysis")}
            subtitle={t("An impartial reading of your matrix: risks and what would change it.")}
          />
          {decision.analysis ? (
            <>
              <div className="flex gap-3">
                <EvoAvatar decorative className="size-9 shrink-0" />
                <div className="min-w-0 text-sm leading-relaxed">
                  <MessageResponse>{decision.analysis}</MessageResponse>
                </div>
              </div>
              <div className="-ml-2 flex items-center gap-1">
                <CopyButton text={decision.analysis} />
              </div>
            </>
          ) : (
            <LifeEmpty>
              {t("Ask EVO for an analysis of this decision. It never decides for you.")}
            </LifeEmpty>
          )}
          <Button
            variant={decision.analysis ? "outline" : "default"}
            className={cn(
              "w-full gap-1.5",
              !decision.analysis && "bg-brand-green text-sidebar hover:bg-brand-green/90",
            )}
            disabled={analysis.isPending || !base.winner}
            onClick={() => analysis.mutate()}
          >
            {analysis.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
            {analysis.isPending
              ? t("EVO is analysing…")
              : decision.analysis
                ? t("Analyse again")
                : t("Analyse with EVO")}
          </Button>
        </section>
      </div>
    </div>
  );
}

/** The matrix as entered: each score, and the weighted result per option. */
function MatrixTable({
  t,
  decision,
  result,
}: {
  t: T;
  decision: LifeDecision;
  result: DecisionResult;
}) {
  return (
    <section
      className="card-soft space-y-3 p-4 sm:p-5 xl:col-span-2 xl:p-6"
      aria-labelledby="decision-matrix"
    >
      <LifeSectionTitle id="decision-matrix" icon={Scale} accent="violet" title={t("Matrix")} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-2 pr-2 font-medium">{t("Criterion")}</th>
              {decision.options.map((option) => (
                <th key={option.id} className="px-2 py-2 text-center font-medium">
                  <span className="line-clamp-2">{option.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {decision.criteria.map((criterion) => (
              <tr key={criterion.id} className="border-t border-border">
                <td className="py-2 pr-2">
                  {criterion.name}{" "}
                  <span className="text-[11px] text-muted-foreground tabular-nums">{`×${criterion.weight}`}</span>
                </td>
                {decision.options.map((option) => (
                  <td key={option.id} className="px-2 py-2 text-center tabular-nums">
                    {decision.ratings[ratingKey(option.id, criterion.id)] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-border font-semibold">
              <td className="py-2 pr-2 text-brand-green">{t("Weighted score")}</td>
              {decision.options.map((option) => (
                <td key={option.id} className="px-2 py-2 text-center tabular-nums">
                  {(
                    result.ranking.find((score) => score.optionId === option.id)?.score ?? 0
                  ).toFixed(1)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
