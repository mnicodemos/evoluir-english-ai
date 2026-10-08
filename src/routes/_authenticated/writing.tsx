import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import {
  Check,
  CheckCircle2,
  ChevronRight,
  Loader2,
  PenLine,
  SpellCheck,
  Wand2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useLessonRound } from "@/hooks/useLessonRound";
import { useRoundStart, useSavedPractice } from "@/hooks/usePracticeSync";
import { useProfile } from "@/hooks/useProfile";
import { useLogTimeOnExit, useTimeSpent } from "@/hooks/useTimeSpent";
import { type WritingFeedback } from "@/lib/ai-prompts";
import { analyseAuthoritativeWriting } from "@/lib/pedagogy/dualWrite.functions";
import { persistWritingLegacy } from "@/lib/legacyActivity.functions";
import { refreshAfterActivity } from "@/lib/refreshKeys";
import {
  expectedLengthLabel,
  roundPrompts,
  WRITING_CATEGORIES,
  writingLevelConfig,
} from "@/lib/writingLevels";
import { studyDayStartIso, studyToday } from "@/lib/today";

export const Route = createFileRoute("/_authenticated/writing")({
  head: () => ({
    meta: [
      { title: "Writing corrector - Evoluir+ English AI" },
      {
        name: "description",
        content: "Get your English text corrected, rewritten naturally and scored.",
      },
      { property: "og:title", content: "Writing corrector - Evoluir+ English AI" },
      {
        property: "og:description",
        content: "Get your English text corrected and scored instantly.",
      },
    ],
  }),
  component: Writing,
});

const HISTORY_KEY = "writing-history";
const TASKS_PER_ROUND = WRITING_CATEGORIES.length;

function readList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

function writeList(key: string, value: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures
  }
}

/** Every task the student already corrected, on any day. */
function loadHistory(): string[] {
  return readList(HISTORY_KEY);
}

function rememberAnswered(prompt: string) {
  const history = loadHistory();
  if (!history.includes(prompt)) writeList(HISTORY_KEY, [...history, prompt]);
}

function loadDone(signature: string): string[] {
  return readList(`writing-done-round-${signature}`);
}

function saveDone(signature: string, done: string[]) {
  writeList(`writing-done-round-${signature}`, done);
}

function loadResults(signature: string): Record<string, WritingFeedback> {
  try {
    const raw = localStorage.getItem(`writing-results-round-${signature}`);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Tasks reopened with "Redo": the server record must not mark them checked again. */
function loadRedone(signature: string): string[] {
  return readList(`writing-redo-round-${signature}`);
}

function saveRedone(signature: string, redone: string[]) {
  writeList(`writing-redo-round-${signature}`, redone);
}

// Unsent text per task, so leaving the page or reloading never loses an answer.
const DRAFTS_KEY = "writing-drafts-v1";

function readDrafts(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function loadDraft(prompt: string): string {
  const draft = readDrafts()[prompt];
  return typeof draft === "string" ? draft : "";
}

function saveDraft(prompt: string, text: string) {
  if (!prompt) return;
  const drafts = readDrafts();
  if (text.trim()) drafts[prompt] = text;
  else delete drafts[prompt];
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // ignore storage failures
  }
}

function saveResults(signature: string, results: Record<string, WritingFeedback>) {
  try {
    localStorage.setItem(`writing-results-round-${signature}`, JSON.stringify(results));
  } catch {
    // ignore storage failures
  }
}

function Writing() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const minutesSpent = useTimeSpent();
  useLogTimeOnExit({
    timer: minutesSpent,
    profile,
    type: "writing_practice",
    title: "Writing practice",
  });

  const { data: startedLessons } = useLessonRound();
  // The CEFR level comes from the stored profile — the student cannot pick it here.
  const config = useMemo(() => writingLevelConfig(profile?.level), [profile?.level]);
  const rotation = startedLessons ?? 0;
  // A fresh set of tasks every day, and every time the student starts a new lesson.
  const signature = `${studyToday()}-${config.level}-${rotation}`;
  const roundStart = useRoundStart();
  const { data: saved } = useSavedPractice();
  const cutoff = [studyDayStartIso(), roundStart ?? ""].sort().at(-1)!;
  const serverBefore = useMemo(
    () => [...new Set((saved?.writing ?? []).filter((w) => w.at < cutoff).map((w) => w.prompt))],
    [saved, cutoff],
  );
  const serverDone = useMemo(
    () => (saved?.writing ?? []).filter((w) => w.at >= cutoff).map((w) => w.prompt),
    [saved, cutoff],
  );
  const ready = !!saved && roundStart !== undefined;
  const prompts = useMemo(
    () => (ready ? roundPrompts(config, rotation, serverBefore) : []),
    [ready, config, rotation, serverBefore],
  );
  const [done, setDone] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WritingFeedback | null>(null);
  const [results, setResults] = useState<Record<string, WritingFeedback>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const operationKey = useRef<string | null>(null);
  const analyseWriting = useServerFn(analyseAuthoritativeWriting);
  const saveLegacyWriting = useServerFn(persistWritingLegacy);

  useEffect(() => {
    const redone = loadRedone(signature);
    const finished = [...new Set([...loadDone(signature), ...serverDone])].filter(
      (p) => !redone.includes(p),
    );
    setDone(finished);
    const stored = loadResults(signature);
    setResults(stored);
    setAnswers(
      Object.fromEntries(
        Object.entries(stored).map(([k, v]) => [k, (v as { original?: string }).original ?? ""]),
      ),
    );
    const first = prompts.find((p) => !finished.includes(p)) ?? prompts[0] ?? "";
    setPrompt(first);
    setText(loadDraft(first));
    setResult(null);
    operationKey.current = null;
  }, [signature, prompts, serverDone]);

  const currentDone = done.includes(prompt);
  const allDone = prompts.every((p) => done.includes(p));

  function selectPrompt(p: string) {
    setPrompt(p);
    setText(loadDraft(p));
    setResult(null);
    operationKey.current = null;
  }

  /** Lets the student redo every task already checked today. */
  function redoToday() {
    setDone([]);
    saveDone(signature, []);
    saveRedone(signature, prompts);
    setResults({});
    saveResults(signature, {});
    setPrompt(prompts[0] ?? "");
    setText("");
    setResult(null);
    operationKey.current = null;
  }

  /** Lets the student redo an already checked task to improve the score. */
  function redoPrompt() {
    const nextDone = done.filter((p) => p !== prompt);
    setDone(nextDone);
    saveDone(signature, nextDone);
    saveRedone(signature, [...new Set([...loadRedone(signature), prompt])]);
    const nextResults = { ...results };
    delete nextResults[prompt];
    setResults(nextResults);
    saveResults(signature, nextResults);
    setText("");
    setResult(null);
    operationKey.current = null;
  }

  async function analyse() {
    if (currentDone) return;
    if (text.trim().length < 10) {
      toast.error("Write at least a couple of sentences.");
      return;
    }
    setLoading(true);
    const stableOperationKey = operationKey.current ?? crypto.randomUUID();
    operationKey.current = stableOperationKey;
    try {
      const authoritative = await analyseWriting({
        data: {
          operationKey: stableOperationKey,
          prompt,
          originalText: text.trim(),
        },
      });
      const feedback = authoritative.feedback;
      setResult(feedback);
      const original = text.trim();
      const nextResults = { ...results, [prompt]: { ...feedback, original } as WritingFeedback };
      setResults(nextResults);
      saveResults(signature, nextResults);
      setAnswers((a) => ({ ...a, [prompt]: original }));

      // Mark this task as answered — it is never offered again.
      const nextDone = [...done, prompt];
      setDone(nextDone);
      saveDone(signature, nextDone);
      saveRedone(
        signature,
        loadRedone(signature).filter((p) => p !== prompt),
      );
      saveDraft(prompt, "");
      rememberAnswered(prompt);

      if (profile) {
        await saveLegacyWriting({
          data: { operationKey: stableOperationKey, minutes: minutesSpent(1) },
        });
        await refreshAfterActivity(queryClient);
        queryClient.invalidateQueries({ queryKey: ["saved-practice"] });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not analyse your text");
    } finally {
      setLoading(false);
    }
  }

  function nextPrompt() {
    const remaining = prompts.filter((p) => !done.includes(p));
    if (remaining.length > 0) {
      setPrompt(remaining[0]!);
      setText(loadDraft(remaining[0]!));
      setResult(null);
      operationKey.current = null;
    }
  }

  return (
    <AppShell mobileOneScreen>
      <h1 className="text-2xl font-bold sm:text-3xl">Writing AI Corrector</h1>
      <p className="mt-1 text-sm font-medium text-muted-foreground">
        Writing Practice • {config.label} — {config.focus}
      </p>
      <p className="mt-2 hidden text-muted-foreground sm:block xl:hidden">
        One task for Everyday, Professional and Travel English, at your level. New tasks every day
        and every time you start a new lesson — nothing repeats.
      </p>
      {done.length > 0 && (
        <Button variant="ghost" size="sm" className="mt-2 -ml-2" onClick={redoToday}>
          Redo today's tasks
        </Button>
      )}

      {/* Wide desktop: practice on the left, session status and level focus on
          the right (like Listening); below the practice on smaller screens. */}
      <div className="mt-4 grid items-start gap-5 sm:mt-7 xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,1fr)]">
        <div className="min-w-0">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {prompts.map((p, index) => {
              const category = WRITING_CATEGORIES[index]!;
              const isDone = done.includes(p);
              const isActive = prompt === p;
              return (
                <button
                  key={p}
                  onClick={() => selectPrompt(p)}
                  title={isDone ? "Checked — click to redo" : undefined}
                  className={`card-soft flex h-full flex-col gap-1.5 p-2.5 text-left transition-colors sm:p-4 ${
                    isDone
                      ? "opacity-70 hover:bg-accent/50"
                      : isActive
                        ? "border-brand-green! ring-2 ring-brand-green/40!"
                        : "hover:bg-accent/50"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground sm:text-xs">
                    {isDone ? (
                      <CheckCircle2 className="size-3.5 text-green-600" />
                    ) : (
                      <PenLine className="size-3.5" />
                    )}
                    {category.label}
                  </span>
                  <span className="hidden text-sm font-medium sm:block">{p}</span>
                  <span className="mt-auto hidden pt-2 text-xs text-muted-foreground sm:block">
                    {isDone ? "Checked · click to redo" : category.hint}
                  </span>
                </button>
              );
            })}
          </div>

          <section className="card-soft mt-3 p-4 sm:mt-5 sm:p-6">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <label className="min-w-0 break-words text-sm font-medium">
                {allDone ? <span>Today's tasks</span> : prompt}
              </label>
              <span className="text-sm text-muted-foreground">
                <span>
                  {done.length}/{prompts.length}{" "}
                </span>
                <span>done</span>
              </span>
            </div>

            {allDone ? (
              <div className="mt-6 rounded-xl border border-green-500/40 bg-green-500/10 p-5 text-center">
                <CheckCircle2 className="mx-auto size-8 text-green-600" />
                <p className="mt-2 font-semibold">All 3 writing tasks completed!</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  New writing tasks arrive tomorrow, or as soon as you start a new lesson in the
                  Learning Center.
                </p>
                <Button variant="outline" className="mt-4" onClick={redoPrompt}>
                  Redo this task to improve your score
                </Button>
              </div>
            ) : currentDone ? (
              <div className="mt-6 rounded-xl border border-green-500/40 bg-green-500/10 p-5 text-center">
                <CheckCircle2 className="mx-auto size-8 text-green-600" />
                <p className="mt-2 font-semibold">This task is already checked.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Want a better score? Redo it and submit a new version.
                </p>
                <Button variant="outline" className="mt-4" onClick={redoPrompt}>
                  Redo this task
                </Button>
              </div>
            ) : (
              <>
                <Textarea
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    saveDraft(prompt, e.target.value);
                  }}
                  onKeyDown={(e) => {
                    // Ctrl/Cmd + Enter sends the text, like other chat and editor tools.
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !loading) {
                      e.preventDefault();
                      void analyse();
                    }
                  }}
                  onFocus={(event) => {
                    window.setTimeout(
                      () => event.currentTarget.scrollIntoView({ block: "center" }),
                      150,
                    );
                  }}
                  rows={9}
                  placeholder="Write your answer in English…"
                  className="mt-4 min-h-44 scroll-mb-40 text-base sm:mt-5 sm:min-h-52"
                />
                <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">
                    {text.trim().split(/\s+/).filter(Boolean).length} words · <span>target</span>{" "}
                    {expectedLengthLabel(config)}
                  </span>
                  <Button className="w-full sm:w-auto" onClick={analyse} disabled={loading}>
                    {loading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Wand2 className="size-4" />
                    )}
                    Correct my text
                  </Button>
                </div>
              </>
            )}
          </section>

          {(() => {
            // Every corrected task of this round stays visible for review, the
            // current one first, until a new set of tasks is generated.
            const order = [prompt, ...prompts.filter((p) => p !== prompt)];
            const entries = order
              .map((p) => ({ p, r: p === prompt && result ? result : results[p] }))
              .filter(
                (e): e is { p: string; r: WritingFeedback } =>
                  !!e.r && (done.includes(e.p) || (e.p === prompt && !!result)),
              );
            return entries.map(({ p, r }, i) => (
              <section key={p} className="mt-6 space-y-5 animate-rise">
                {(entries.length > 1 || p !== prompt) && (
                  <h2 className="text-sm font-semibold text-muted-foreground">{p}</h2>
                )}
                {answers[p] && (
                  <div className="card-soft p-6">
                    <h3 className="font-semibold">Your text</h3>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{answers[p]}</p>
                  </div>
                )}
                <WritingResultView result={r} />
                {i === 0 && p === prompt && result && !allDone && (
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={nextPrompt}>
                      Next task ({done.length}/{prompts.length} done)
                    </Button>
                  </div>
                )}
              </section>
            ));
          })()}
        </div>

        <aside className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          {/* The task cards above already show this on smaller screens. */}
          <section className="card-soft hidden p-4 xl:block">
            <h2 className="text-sm font-semibold">Today's tasks</h2>
            <ol className="mt-2.5 space-y-1.5">
              {prompts.map((p, index) => {
                const isDone = done.includes(p);
                const current = p === prompt && !isDone;
                const feedback = results[p];
                const score = feedback
                  ? Math.round((feedback.grammar + feedback.vocabulary + feedback.clarity) / 3)
                  : null;
                return (
                  <li key={p}>
                    <button
                      type="button"
                      onClick={() => selectPrompt(p)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent/50 ${
                        current ? "border-brand-green/50 bg-brand-green/10" : "border-border"
                      }`}
                    >
                      <span
                        className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                          isDone ? "bg-brand-green text-sidebar" : "bg-secondary"
                        }`}
                      >
                        {isDone ? <Check className="size-3.5" /> : index + 1}
                      </span>
                      <span className="min-w-0 flex-1">{WRITING_CATEGORIES[index]!.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {isDone ? (
                          score != null ? (
                            `${score}%`
                          ) : (
                            <span>Checked</span>
                          )
                        ) : current ? (
                          <span>In progress</span>
                        ) : (
                          <span>Up next</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="card-soft p-4">
            <h2 className="text-sm font-semibold">
              <span>Writing focus</span> · {config.label}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{config.focus}</p>
            <ul className="mt-2.5 space-y-1 text-sm text-muted-foreground">
              {config.priorities.map((tip) => (
                <li key={tip} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-green" />
                  <span className="block first-letter:uppercase">{tip}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              <span>Target length</span> · {expectedLengthLabel(config)}
            </p>
          </section>

          <Link
            to="/mistakes"
            className="card-soft flex items-center gap-3 p-4 transition-colors hover:bg-accent/50"
          >
            <SpellCheck className="size-5 shrink-0 text-brand-green" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">My mistakes</span>
              <span className="block text-xs text-muted-foreground">
                Mistakes from your corrections come back here for review.
              </span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        </aside>
      </div>
    </AppShell>
  );
}

function WritingResultView({ result }: { result: WritingFeedback }) {
  return (
    <>
      <div className="card-soft grid gap-5 p-6 sm:grid-cols-3">
        {[
          { label: "Grammar", value: result.grammar },
          { label: "Vocabulary", value: result.vocabulary },
          { label: "Clarity", value: result.clarity },
        ].map((s) => (
          <div key={s.label}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{s.label}</span>
              <span className="text-muted-foreground">{s.value}%</span>
            </div>
            <Progress value={s.value} className="mt-2 h-2" />
          </div>
        ))}
      </div>
      <div className="card-soft p-6">
        <h3 className="flex items-center gap-2 font-semibold">
          <PenLine className="size-4" /> Corrected text
        </h3>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{result.corrected}</p>
      </div>
      <div className="card-soft p-6">
        <h3 className="font-semibold">Natural version</h3>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{result.natural}</p>
      </div>
      {result.explanations.length > 0 && (
        <div className="card-soft p-6">
          <h3 className="font-semibold">What to fix</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {result.explanations.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {result.suggestions.length > 0 && (
        <div className="card-soft p-6">
          <h3 className="font-semibold">Suggestions</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {result.suggestions.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
