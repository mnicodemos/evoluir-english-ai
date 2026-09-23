import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { CheckCircle2, Loader2, PenLine, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useLessonRound } from "@/hooks/useLessonRound";
import { useProfile } from "@/hooks/useProfile";
import { useLogTimeOnExit, useTimeSpent } from "@/hooks/useTimeSpent";
import { type WritingFeedback } from "@/lib/ai-prompts";
import { analyseAuthoritativeWriting } from "@/lib/pedagogy/dualWrite.functions";
import { persistWritingLegacy } from "@/lib/legacyActivity.functions";
import {
import { refreshAfterActivity } from "@/lib/refreshKeys";
  expectedLengthLabel,
  pickWritingTasks,
  WRITING_CATEGORIES,
  writingLevelConfig,
  type WritingLevelConfig,
} from "@/lib/writingLevels";

export const Route = createFileRoute("/_authenticated/writing")({
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · Writing corrector" },
      {
        name: "description",
        content: "Get your English text corrected, rewritten naturally and scored.",
      },
      { property: "og:title", content: "Evoluir+ English AI · Writing corrector" },
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

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

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

/**
 * One task per theme (Everyday, Professional, Travel), taken from the pool of
 * the student's CEFR level. Already answered tasks are skipped while fresh ones
 * exist; when the whole level pool is used the history is cleared.
 */
function roundPrompts(signature: string, config: WritingLevelConfig, rotation: number): string[] {
  const key = `writing-prompts-round-${signature}`;
  const saved = readList(key);
  if (saved.length === TASKS_PER_ROUND) return saved;

  let history = loadHistory();
  const levelExhausted = WRITING_CATEGORIES.every(({ id }) =>
    config.tasks[id].every((task) => history.includes(task)),
  );
  if (levelExhausted) {
    history = [];
    writeList(HISTORY_KEY, history);
  }

  const picked = pickWritingTasks({ config, history, rotation });
  writeList(key, picked);
  return picked;
}

function loadDone(signature: string): string[] {
  return readList(`writing-done-round-${signature}`);
}

function saveDone(signature: string, done: string[]) {
  writeList(`writing-done-round-${signature}`, done);
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
  const signature = `${todayKey()}-${config.level}-${rotation}`;
  const prompts = useMemo(
    () => roundPrompts(signature, config, rotation),
    [signature, config, rotation],
  );
  const [done, setDone] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WritingFeedback | null>(null);
  const operationKey = useRef<string | null>(null);
  const analyseWriting = useServerFn(analyseAuthoritativeWriting);
  const saveLegacyWriting = useServerFn(persistWritingLegacy);

  useEffect(() => {
    const finished = loadDone(signature);
    setDone(finished);
    setPrompt(prompts.find((p) => !finished.includes(p)) ?? prompts[0] ?? "");
    setText("");
    setResult(null);
    operationKey.current = null;
  }, [signature, prompts]);

  const currentDone = done.includes(prompt);
  const allDone = prompts.every((p) => done.includes(p));

  function selectPrompt(p: string) {
    setPrompt(p);
    setText("");
    setResult(null);
    operationKey.current = null;
  }

  /** Lets the student redo every task already checked today. */
  function redoToday() {
    setDone([]);
    saveDone(signature, []);
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

      // Mark this task as answered — it is never offered again.
      const nextDone = [...done, prompt];
      setDone(nextDone);
      saveDone(signature, nextDone);
      rememberAnswered(prompt);

      if (profile) {
        await saveLegacyWriting({
          data: { operationKey: stableOperationKey, minutes: minutesSpent(1) },
        });
        await refreshAfterActivity(queryClient);
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
      setText("");
      setResult(null);
      operationKey.current = null;
    }
  }

  return (
    <AppShell>
      <h1 className="text-3xl font-bold">Writing AI Corrector</h1>
      <p className="mt-1 text-sm font-medium text-muted-foreground">
        Writing Practice • {config.label} — {config.focus}
      </p>
      <p className="mt-2 text-muted-foreground">
        One task for Everyday, Professional and Travel English, at your level. New tasks every day
        and every time you start a new lesson — nothing repeats.
      </p>
      {done.length > 0 && (
        <Button variant="ghost" size="sm" className="mt-2 -ml-2" onClick={redoToday}>
          Redo today's tasks
        </Button>
      )}

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {prompts.map((p, index) => {
          const category = WRITING_CATEGORIES[index]!;
          const isDone = done.includes(p);
          const isActive = prompt === p;
          return (
            <button
              key={p}
              onClick={() => selectPrompt(p)}
              title={isDone ? "Checked — click to redo" : undefined}
              className={`card-soft flex h-full flex-col gap-1.5 p-4 text-left transition-colors ${
                isDone
                  ? "opacity-70 hover:bg-accent/50"
                  : isActive
                    ? "ring-2 ring-primary"
                    : "hover:bg-accent/50"
              }`}
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {isDone ? (
                  <CheckCircle2 className="size-3.5 text-green-600" />
                ) : (
                  <PenLine className="size-3.5" />
                )}
                {category.label}
              </span>
              <span className="text-sm font-medium">{p}</span>
              <span className="mt-auto pt-2 text-xs text-muted-foreground">
                {isDone ? "Checked · click to redo" : category.hint}
              </span>
            </button>
          );
        })}
      </div>

      <section className="card-soft mt-5 p-4 sm:p-6">
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
              onChange={(e) => setText(e.target.value)}
              onFocus={(event) => {
                window.setTimeout(
                  () => event.currentTarget.scrollIntoView({ block: "center" }),
                  150,
                );
              }}
              rows={9}
              placeholder="Write your answer in English…"
              className="mt-5 min-h-52 scroll-mb-40 text-base"
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

      {result && (
        <section className="mt-6 space-y-5 animate-rise">
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
            <h2 className="flex items-center gap-2 font-semibold">
              <PenLine className="size-4" /> Corrected text
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{result.corrected}</p>
          </div>

          <div className="card-soft p-6">
            <h2 className="font-semibold">Natural version</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{result.natural}</p>
          </div>

          {result.explanations.length > 0 && (
            <div className="card-soft p-6">
              <h2 className="font-semibold">What to fix</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                {result.explanations.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {result.suggestions.length > 0 && (
            <div className="card-soft p-6">
              <h2 className="font-semibold">Suggestions</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                {result.suggestions.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {!allDone && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={nextPrompt}>
                Next task ({done.length}/{prompts.length} done)
              </Button>
            </div>
          )}
        </section>
      )}
    </AppShell>
  );
}
