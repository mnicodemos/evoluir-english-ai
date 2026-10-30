import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Dumbbell,
  ListChecks,
  Loader2,
  RotateCcw,
  SpellCheck,
  Trash2,
  Target,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/AppShell";
import { EvoAvatar } from "@/components/EvoAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/useProfile";
import { useLogTimeOnExit, useTimeSpent } from "@/hooks/useTimeSpent";
import { supabase } from "@/integrations/supabase/client";
import { isMistakeDue, MISTAKE_MASTERED_STEP } from "@/lib/mistakeReview";
import { findMistakeSentence, type MistakeSentence } from "@/lib/mistakeSentence";
import {
  deleteMistake,
  deleteMistakes,
  practiceMistake,
  reviewMistake,
} from "@/lib/mistakes.functions";
import type { MistakePractice } from "@/lib/mistakePractice";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { cn } from "@/lib/utils";
import {
  MISTAKE_TYPE_LABEL,
  MISTAKE_TYPES,
  mistakeTypeOf,
  type MistakeType,
} from "@/lib/mistakeType";
import { DoneSeal } from "@/components/DoneSeal";

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
  last_detected: string;
  /** The whole sentence of the student's text, when it can be found. */
  sentence: MistakeSentence | null;
};

type Outcome = { correct: boolean; corrected: string; explanation: string };

function Mistakes() {
  const { lang } = useUiLang();
  const t = (text: string) => (lang === "pt" ? (uiPt[text] ?? text) : text);
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const { data: learning } = useQuery({
    queryKey: ["learning-profile", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data } = await supabase
        .from("learning_profile")
        .select("*")
        .eq("user_id", profile!.id)
        .maybeSingle();
      return data;
    },
  });
  const review = useServerFn(reviewMistake);
  const removeMistake = useServerFn(deleteMistake);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Delete several at once (owner request, 2026-10-31): a select mode with a
  // checkbox on each phrase, "Select all" for the tab on screen.
  const removeMistakes = useServerFn(deleteMistakes);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [deletingMany, setDeletingMany] = useState(false);
  const [answer, setAnswer] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [checking, setChecking] = useState(false);
  const [showAllMistakes, setShowAllMistakes] = useState(false);
  // Ids answered in this visit, so the queue moves on even before the refetch.
  const [answered, setAnswered] = useState<string[]>([]);
  // Reviewing mistakes counts toward today's minutes once something was answered.
  const minutesSpent = useTimeSpent();
  useLogTimeOnExit({
    timer: minutesSpent,
    profile: answered.length > 0 ? profile : null,
    type: "mistakes_review",
    title: "My mistakes review",
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mistakes", profile?.id],
    enabled: !!profile?.id,
    queryFn: async (): Promise<MistakeRow[]> => {
      const { data, error } = await supabase
        .from("learning_errors")
        .select(
          "id, original_text, corrected_text, explanation, category, frequency, review_step, next_review_at, last_detected",
        )
        .eq("user_id", profile!.id)
        .order("last_detected", { ascending: false })
        .limit(200);
      if (error) throw error;
      // The student's own Writing texts give back the whole sentence of each
      // mistake; without them the saved phrase is shown on its own.
      const { data: texts } = await supabase
        .from("writing_submissions")
        .select("original_text")
        .eq("user_id", profile!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      // AI Teacher corrections come from the student's chat messages.
      const { data: chats } = await supabase
        .from("ai_conversations")
        .select("messages")
        .eq("user_id", profile!.id)
        .eq("scenario", "teacher")
        .order("updated_at", { ascending: false })
        .limit(30);
      const chatLines = (chats ?? []).flatMap((chat) =>
        (Array.isArray(chat.messages) ? chat.messages : [])
          .filter(
            (message): message is { role: string; content: string } =>
              !!message &&
              typeof message === "object" &&
              (message as { role?: unknown }).role === "user" &&
              typeof (message as { content?: unknown }).content === "string",
          )
          .reverse()
          .map((message) => message.content),
      );
      const sources = [...(texts ?? []).map((row) => row.original_text ?? ""), ...chatLines];
      return (data ?? []).map((row) => ({
        ...row,
        sentence: findMistakeSentence(row.original_text, sources),
      }));
    },
  });

  const due = useMemo(
    () =>
      rows.filter(
        (row) => row.review_step === 0 && isMistakeDue(row) && !answered.includes(row.id),
      ),
    [rows, answered],
  );
  const current = outcome ? rows.find((row) => row.id === answered.at(-1)) : due[0];
  const mastered = rows.filter((row) => row.review_step >= MISTAKE_MASTERED_STEP).length;
  // The saved phrases in tabs by type of mistake (user request); a tab shows
  // only when it has phrases.
  const [tab, setTab] = useState<MistakeType | "all">("all");
  const typeCounts = MISTAKE_TYPES.map((type) => ({
    type,
    count: rows.filter((row) => mistakeTypeOf(row.category) === type).length,
  })).filter((item) => item.count > 0);
  const listed = (tab === "all" ? rows : rows.filter((row) => mistakeTypeOf(row.category) === tab))
    .slice()
    .sort((a, b) => new Date(b.last_detected).getTime() - new Date(a.last_detected).getTime());

  async function check() {
    if (!current || !answer.trim()) return;
    setChecking(true);
    try {
      const result = await review({ data: { id: current.id, answer } });
      setAnswered((ids) => [...ids, current.id]);
      setOutcome(result);
      // The Dashboard's "Review n mistakes" and its bell read this count
      // (user report, 2026-10-23: it stayed until the page was reloaded).
      void queryClient.invalidateQueries({ queryKey: ["mistakes-due"] });
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

  async function deleteSavedMistake(id: string) {
    if (!window.confirm("Delete this saved mistake? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await removeMistake({ data: { id } });
      setAnswered((ids) => ids.filter((item) => item !== id));
      if (answered.includes(id)) {
        setOutcome(null);
        setAnswer("");
      }
      await queryClient.invalidateQueries({ queryKey: ["mistakes", profile?.id] });
      void queryClient.invalidateQueries({ queryKey: ["mistakes-due"] });
      toast.success("Mistake deleted.");
    } catch {
      toast.error("Could not delete this mistake. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  function toggleSelected(id: string) {
    setSelected((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));
  }

  function stopSelecting() {
    setSelecting(false);
    setSelected([]);
  }

  async function deleteSelected() {
    const ids = selected.filter((id) => rows.some((row) => row.id === id));
    if (!ids.length) return;
    const question =
      ids.length === 1
        ? t("Delete 1 saved mistake? This cannot be undone.")
        : t("Delete {n} saved mistakes? This cannot be undone.").replace("{n}", String(ids.length));
    if (!window.confirm(question)) return;
    setDeletingMany(true);
    try {
      const { deleted } = await removeMistakes({ data: { ids } });
      setAnswered((list) => list.filter((item) => !ids.includes(item)));
      if (answered.some((item) => ids.includes(item))) {
        setOutcome(null);
        setAnswer("");
      }
      stopSelecting();
      await queryClient.invalidateQueries({ queryKey: ["mistakes", profile?.id] });
      void queryClient.invalidateQueries({ queryKey: ["mistakes-due"] });
      toast.success(
        deleted === 1
          ? t("1 mistake deleted.")
          : t("{n} mistakes deleted.").replace("{n}", String(deleted)),
      );
    } catch {
      toast.error(t("Could not delete these mistakes. Please try again."));
    } finally {
      setDeletingMany(false);
    }
  }

  const allListedSelected = listed.length > 0 && listed.every((row) => selected.includes(row.id));

  return (
    <AppShell mobileOneScreen>
      <div className="space-y-3 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,1fr)] lg:items-start lg:gap-4 lg:space-y-0">
        <PageHeader
          icon={SpellCheck}
          accent="amber"
          className="lg:col-span-2"
          title={<>My mistakes</>}
          descriptionClassName="hidden sm:block"
          description={
            <>
              Mistakes from your Writing corrections and the AI Teacher come back for review until
              you get them right five times in a row.
            </>
          }
        />

        <div className="space-y-3 lg:col-start-1 lg:row-start-2">
          <section className="card-soft space-y-3 p-3 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display flex items-center gap-2 text-base font-semibold sm:text-lg">
                <Target className="size-4 text-primary sm:size-5" />
                Review now
              </h2>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {due.length + (outcome ? 1 : 0)}
              </span>
            </div>

            {isLoading ? (
              <div className="space-y-3 py-2" aria-busy="true">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ) : !current ? (
              <div className="space-y-3 py-4 text-center">
                {rows.length === 0 ? (
                  <EvoAvatar decorative className="mx-auto size-14" />
                ) : (
                  <DoneSeal className="mx-auto" />
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
                <p className="text-sm text-muted-foreground">
                  {current.sentence ? "Correct the marked part:" : "Correct this sentence:"}
                </p>
                <p
                  translate="no"
                  lang="en"
                  className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 font-medium"
                >
                  {current.sentence ? (
                    <>
                      {current.sentence.before}
                      <mark className="rounded bg-destructive/20 px-0.5 text-destructive underline decoration-wavy underline-offset-4">
                        {current.sentence.wrong}
                      </mark>
                      {current.sentence.after}
                    </>
                  ) : (
                    current.original_text
                  )}
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
                    <p
                      translate="no"
                      lang="en"
                      className="rounded-lg border border-primary/30 bg-primary/5 p-3 font-medium"
                    >
                      {current.sentence ? (
                        <>
                          {current.sentence.before}
                          <span className="rounded bg-primary/20 px-0.5 text-primary">
                            {outcome.corrected}
                          </span>
                          {current.sentence.after}
                        </>
                      ) : (
                        outcome.corrected
                      )}
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
                    {current.sentence ? (
                      // The whole sentence again, with a space only where the
                      // correction goes (user request).
                      <p
                        translate="no"
                        lang="en"
                        className="min-w-0 flex-1 rounded-lg border border-border p-3 font-medium leading-[2.1]"
                      >
                        {current.sentence.before}
                        <input
                          value={answer}
                          onChange={(event) => setAnswer(event.target.value)}
                          aria-label="Type the correction"
                          autoComplete="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          style={{
                            width: `${Math.min(Math.max(current.sentence.wrong.length, 6) + 3, 28)}ch`,
                          }}
                          // A written blank, not a box (user report: the tall box pushed the
                          // sentence's lines apart): a teal underline in the text's own line.
                          className="mx-1 inline-block h-7 max-w-full rounded-t-md border-0 border-b-2 border-primary/60 bg-primary/[0.06] px-1.5 py-0 align-baseline leading-normal text-primary outline-none focus:border-primary focus:bg-primary/10"
                        />
                        {current.sentence.after}
                      </p>
                    ) : (
                      <Input
                        value={answer}
                        onChange={(event) => setAnswer(event.target.value)}
                        placeholder="Type the corrected sentence"
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck={false}
                      />
                    )}
                    <Button type="submit" disabled={checking || !answer.trim()}>
                      {checking ? <Loader2 className="size-4 animate-spin" /> : "Check"}
                    </Button>
                  </form>
                )}
              </div>
            )}
          </section>
          {learning?.common_errors && learning.common_errors.length > 0 && (
            <section className="card-soft p-3 sm:p-5">
              <h2 className="font-display text-base font-semibold sm:text-lg">Frequent mistakes</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground sm:mt-3 sm:text-sm">
                {(showAllMistakes
                  ? learning.common_errors
                  : learning.common_errors.slice(0, 5)
                ).map((error: string, i: number) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
              {learning.common_errors.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllMistakes((value) => !value)}
                  aria-expanded={showAllMistakes}
                  className="mt-2 min-h-11 text-xs font-medium text-brand-green hover:underline sm:text-sm"
                >
                  {showAllMistakes ? "Show less" : `Show all (${learning.common_errors.length})`}
                </button>
              )}
            </section>
          )}
        </div>

        <aside className="card-soft space-y-2 p-3 sm:p-5 lg:col-start-2 lg:row-start-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display flex items-center gap-2 text-base font-semibold">
              <RotateCcw className="size-4 text-primary" />
              All mistakes
            </h2>
            {/* Labelled (user report: a bare "0/56" read as a mistake count). */}
            <span
              className="text-xs text-muted-foreground"
              title="Mastered: answered right 5 times in a row"
            >
              <span>
                {mastered}/{rows.length}
              </span>{" "}
              <span>mastered</span>
            </span>
          </div>
          {typeCounts.length > 1 ? (
            <div role="tablist" aria-label="Type of mistake" className="flex flex-wrap gap-1.5">
              {[{ type: "all" as const, count: rows.length }, ...typeCounts].map((item) => (
                <button
                  key={item.type}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.type}
                  onClick={() => setTab(item.type)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
                    tab === item.type
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span>{item.type === "all" ? "All types" : MISTAKE_TYPE_LABEL[item.type]}</span>
                  <span>{` ${item.count}`}</span>
                </button>
              ))}
            </div>
          ) : null}
          {rows.length > 0 &&
            (selecting ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-white/[0.03] p-2 text-xs">
                <button
                  type="button"
                  className="min-h-9 font-semibold text-primary hover:underline"
                  onClick={() =>
                    setSelected(
                      allListedSelected
                        ? selected.filter((id) => !listed.some((row) => row.id === id))
                        : [...new Set([...selected, ...listed.map((row) => row.id)])],
                    )
                  }
                >
                  {allListedSelected ? (
                    t("Clear selection")
                  ) : (
                    <>
                      <span>{t("Select all")}</span> <span>({listed.length})</span>
                    </>
                  )}
                </button>
                <span className="ml-auto flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={stopSelecting}
                  >
                    {t("Cancel")}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="h-8 gap-1.5 px-2.5 text-xs"
                    disabled={selected.length === 0 || deletingMany}
                    onClick={() => void deleteSelected()}
                  >
                    {deletingMany ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    )}
                    <span>{t("Delete")}</span> <span>({selected.length})</span>
                  </Button>
                </span>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setSelecting(true)}
                >
                  <ListChecks className="size-3.5" aria-hidden="true" />
                  {t("Select to delete")}
                </Button>
              </div>
            ))}
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing here yet.</p>
          ) : (
            <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1 lg:max-h-[60vh]">
              {listed.map((row) => (
                <li
                  key={row.id}
                  className={cn(
                    "rounded-lg border p-2 text-sm",
                    selecting && selected.includes(row.id)
                      ? "border-destructive/50 bg-destructive/[0.06]"
                      : "border-border/60",
                  )}
                >
                  <p className="mb-1 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                    {selecting && (
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--destructive)]"
                        checked={selected.includes(row.id)}
                        onChange={() => toggleSelected(row.id)}
                        aria-label={`${t("Select")}: ${row.corrected_text}`}
                      />
                    )}
                    <span>
                      {(() => {
                        const detectedAt = new Date(row.last_detected);
                        const today = new Date();
                        detectedAt.setHours(0, 0, 0, 0);
                        today.setHours(0, 0, 0, 0);
                        const days = Math.max(
                          0,
                          Math.floor((today.getTime() - detectedAt.getTime()) / 86_400_000),
                        );
                        return days === 0 ? "Today" : days === 1 ? "1 day ago" : `${days} days ago`;
                      })()}
                    </span>
                  </p>
                  {row.sentence ? (
                    <p translate="no" lang="en">
                      {row.sentence.before}
                      <del className="text-destructive">{row.sentence.wrong}</del>{" "}
                      <ins className="font-medium text-primary no-underline">
                        {row.corrected_text}
                      </ins>
                      {row.sentence.after}
                    </p>
                  ) : (
                    <>
                      <p translate="no" className="text-muted-foreground line-through">
                        {row.original_text}
                      </p>
                      <p translate="no" className="font-medium">
                        {row.corrected_text}
                      </p>
                    </>
                  )}
                  {row.review_step > 0 && (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      Corrected
                    </span>
                  )}
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
                  <div className={cn("mt-2 flex justify-end", selecting && "hidden")}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 px-2 text-xs text-destructive hover:text-destructive"
                      disabled={deletingId === row.id}
                      onClick={() => void deleteSavedMistake(row.id)}
                      aria-label={`Delete mistake: ${row.corrected_text}`}
                    >
                      {deletingId === row.id ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      )}
                      Delete
                    </Button>
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
