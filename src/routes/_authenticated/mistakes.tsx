import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Dumbbell, Loader2, RotateCcw, Target, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { EvoAvatar } from "@/components/EvoAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { isMistakeDue, MISTAKE_MASTERED_STEP } from "@/lib/mistakeReview";
import { practiceMistake, reviewMistake } from "@/lib/mistakes.functions";
import type { MistakePractice } from "@/lib/mistakePractice";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mistakes")({
  head: () => ({
    meta: [
      { title: "My mistakes - Evoluir+ English AI" },
      {
        name: "description",
        content: "Review the mistakes from your corrections until they stick.",
      },
    ],
  }),
  component: Mistakes,
});

type MistakeRow = {
  id: string;
  original_text: string;
  corrected_text: string;
  explanation: string;
  category: string;
  frequency: number;
  review_step: number;
  next_review_at: string;
};

type Outcome = { correct: boolean; corrected: string; explanation: string };

function Mistakes() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const review = useServerFn(reviewMistake);
  const [answer, setAnswer] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [checking, setChecking] = useState(false);
  // Ids answered in this visit, so the queue moves on even before the refetch.
  const [answered, setAnswered] = useState<string[]>([]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mistakes", profile?.id],
    enabled: !!profile?.id,
    queryFn: async (): Promise<MistakeRow[]> => {
      const { data, error } = await supabase
        .from("learning_errors")
        .select(
          "id, original_text, corrected_text, explanation, category, frequency, review_step, next_review_at",
        )
        .eq("user_id", profile!.id)
        .order("last_detected", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const due = useMemo(
    () => rows.filter((row) => isMistakeDue(row) && !answered.includes(row.id)),
    [rows, answered],
  );
  const current = outcome ? rows.find((row) => row.id === answered.at(-1)) : due[0];
  const mastered = rows.filter((row) => row.review_step >= MISTAKE_MASTERED_STEP).length;

  async function check() {
    if (!current || !answer.trim()) return;
    setChecking(true);
    try {
      const result = await review({ data: { id: current.id, answer } });
      setAnswered((ids) => [...ids, current.id]);
      setOutcome(result);
    } catch {
      toast.error("Could not check your answer. Try again.");
    } finally {
      setChecking(false);
    }
  }

  function next() {
    setOutcome(null);
    setAnswer("");
    void queryClient.invalidateQueries({ queryKey: ["mistakes"] });
  }

  return (
    <AppShell mobileOneScreen>
      <div className="space-y-3 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,1fr)] lg:items-start lg:gap-4 lg:space-y-0">
        <header className="animate-rise lg:col-span-2">
          <h1 className="text-lg font-bold lg:text-3xl">My mistakes</h1>
          <p className="mt-0.5 hidden max-w-2xl text-sm text-muted-foreground sm:block">
            Mistakes from your Writing corrections come back for review until you get them right
            five times in a row.
          </p>
        </header>

        <section className="card-soft space-y-3 p-3 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
              <Target className="size-4 text-primary sm:size-5" />
              Review now
            </h2>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {due.length + (outcome ? 1 : 0)}
            </span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : !current ? (
            <div className="space-y-3 py-4 text-center">
              {rows.length === 0 ? (
                <EvoAvatar decorative className="mx-auto size-14" />
              ) : (
                <CheckCircle2 className="mx-auto size-8 text-primary" />
              )}
              <p className="font-medium">
                {rows.length === 0 ? "No mistakes saved yet." : "All caught up for today!"}
              </p>
              <p className="text-sm text-muted-foreground">
                {rows.length === 0
                  ? "Correct a text in Writing and your mistakes will appear here."
                  : "Come back tomorrow for the next reviews."}
              </p>
              {rows.length === 0 && (
                <Button asChild variant="outline">
                  <Link to="/writing">Go to Writing</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Correct this sentence:</p>
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 font-medium">
                {current.original_text}
              </p>
              {outcome ? (
                <div className="space-y-2">
                  <p
                    className={cn(
                      "flex items-center gap-2 font-semibold",
                      outcome.correct ? "text-primary" : "text-destructive",
                    )}
                  >
                    {outcome.correct ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <XCircle className="size-4" />
                    )}
                    {outcome.correct ? "Correct!" : "Not quite."}
                  </p>
                  <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 font-medium">
                    {outcome.corrected}
                  </p>
                  {outcome.explanation && (
                    <p className="text-sm text-muted-foreground">{outcome.explanation}</p>
                  )}
                  <RulePractice key={current.id} mistakeId={current.id} />
                  <Button onClick={next} className="w-full sm:w-auto">
                    Next
                  </Button>
                </div>
              ) : (
                <form
                  className="flex flex-col gap-2 sm:flex-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void check();
                  }}
                >
                  <Input
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder="Type the corrected sentence"
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                  <Button type="submit" disabled={checking || !answer.trim()}>
                    {checking ? <Loader2 className="size-4 animate-spin" /> : "Check"}
                  </Button>
                </form>
              )}
            </div>
          )}
        </section>

        <aside className="card-soft space-y-2 p-3 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <RotateCcw className="size-4 text-primary" />
              All mistakes
            </h2>
            <span className="text-xs text-muted-foreground">
              {mastered}/{rows.length}
            </span>
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing here yet.</p>
          ) : (
            <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1 lg:max-h-[60vh]">
              {rows.map((row) => (
                <li key={row.id} className="rounded-lg border border-border/60 p-2 text-sm">
                  <p className="text-muted-foreground line-through">{row.original_text}</p>
                  <p className="font-medium">{row.corrected_text}</p>
                  <div className="mt-1 flex gap-1" aria-hidden>
                    {Array.from({ length: MISTAKE_MASTERED_STEP }, (_, step) => (
                      <span
                        key={step}
                        className={cn(
                          "h-1 flex-1 rounded-full",
                          step < row.review_step ? "bg-primary" : "bg-muted",
                        )}
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </AppShell>
  );
}

/**
 * "Practise the rule": after a review, one new multiple-choice question on the
 * same rule in a different sentence. Practice only; the review step is kept.
 */
function RulePractice({ mistakeId }: { mistakeId: string }) {
  const load = useServerFn(practiceMistake);
  const [practice, setPractice] = useState<MistakePractice | null>(null);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);

  async function start() {
    setLoading(true);
    try {
      setPractice(await load({ data: { id: mistakeId } }));
    } catch {
      toast.error("Could not prepare a practice question. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!practice) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => void start()}
        disabled={loading}
        className="w-full gap-2 sm:w-auto"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Dumbbell className="size-4" aria-hidden="true" />
        )}
        Practise the rule
      </Button>
    );
  }

  const answered = picked !== null;
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Practise the rule
      </p>
      <p className="font-medium" lang="en">
        {practice.question}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {practice.options.map((option, index) => {
          const isAnswer = index === practice.answerIndex;
          return (
            <button
              key={option}
              type="button"
              lang="en"
              disabled={answered}
              onClick={() => setPicked(index)}
              className={cn(
                "rounded-lg border p-2.5 text-left text-sm transition-colors",
                !answered && "border-border hover:bg-secondary",
                answered && isAnswer && "border-primary/60 bg-primary/10 text-primary",
                answered &&
                  !isAnswer &&
                  index === picked &&
                  "border-destructive/50 bg-destructive/5 text-destructive",
                answered && !isAnswer && index !== picked && "border-border opacity-60",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="space-y-1">
          <p
            className={cn(
              "flex items-center gap-2 text-sm font-semibold",
              picked === practice.answerIndex ? "text-primary" : "text-destructive",
            )}
          >
            {picked === practice.answerIndex ? (
              <CheckCircle2 className="size-4" aria-hidden="true" />
            ) : (
              <XCircle className="size-4" aria-hidden="true" />
            )}
            {picked === practice.answerIndex ? "Correct!" : "Not quite."}
          </p>
          <p className="text-sm text-muted-foreground">{practice.explanation}</p>
        </div>
      )}
    </div>
  );
}
