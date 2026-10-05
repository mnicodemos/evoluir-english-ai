import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  CheckCircle2,
  Headphones,
  Loader2,
  Mic,
  RotateCcw,
  Square,
  AudioLines,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useLessons, type Lesson } from "@/hooks/useLearning";
import { useLessonRound } from "@/hooks/useLessonRound";
import { useRoundStart, useSavedPractice } from "@/hooks/usePracticeSync";
import { useProfile } from "@/hooks/useProfile";
import { useLogTimeOnExit, useTimeSpent } from "@/hooks/useTimeSpent";
import { findLevel } from "@/lib/level";
import {
  listeningLevelConfig,
  pickListeningSentences,
  sentencesFromText,
  type ListeningLevelConfig,
} from "@/lib/listeningLevels";
import { formatDate } from "@/lib/formatDate";
import { speakEnglish } from "@/lib/speech";
import { useUiLang } from "@/lib/uiLang";
import { transcribeAudio } from "@/lib/transcribe";
import {
  cancelVoiceRecording,
  startVoiceRecording,
  stopVoiceRecording,
} from "@/lib/voice-recorder";
import { persistListeningLegacy } from "@/lib/legacyActivity.functions";
import { listeningAnswerScore } from "@/lib/legacyScores";

export const Route = createFileRoute("/_authenticated/listening")({
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · Listening Lab" },
      {
        name: "description",
        content:
          "Train your English listening with dictation drills for everyday, work and travel.",
      },
      { property: "og:title", content: "Evoluir+ English AI · Listening Lab" },
      {
        property: "og:description",
        content: "Listen to natural English sentences and repeat them out loud.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ListeningPage,
});

/** Each round presents one sentence at a time. */
const SENTENCES_PER_TRACK = 3;
/** Kept for the existing evidence records, which store one track id. */
const LEGACY_TRACK_ID = "everyday" as const;

/** Sentences taken from the lessons of the student's own level. */
function lessonSentencesForLevel(lessons: Lesson[], level: string, config: ListeningLevelConfig) {
  return lessons
    .filter((lesson) => findLevel(lesson.level).value === level)
    .flatMap((lesson) =>
      sentencesFromText(`${lesson.summary ?? ""} ${lesson.transcript ?? ""}`, config),
    );
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Marks which words of the sentence the student actually repeated. */
function wordMatches(expected: string, spoken: string) {
  const pool = normalize(spoken);
  return expected
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((original) => {
      const clean = normalize(original)[0];
      if (!clean) return { word: original, hit: true };
      const at = pool.indexOf(clean);
      if (at >= 0) pool.splice(at, 1);
      return { word: original, hit: at >= 0 };
    });
}

const STORAGE_KEY = "listening-lab-completed-v1";
const PROGRESS_KEY = "listening-lab-progress-v1";

type CompletionMap = Record<string, number>;
type ProgressMap = Record<string, { round: number; answered: number[] }>;

function readProgress(): ProgressMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? "{}") as ProgressMap;
  } catch {
    return {};
  }
}

function writeProgress(map: ProgressMap) {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable */
  }
}

function readCompletion(): CompletionMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as CompletionMap;
  } catch {
    return {};
  }
}

/** Three short pronunciation tips for the student's CEFR band. */
function listeningTips(level: string): string[] {
  if (level === "a1" || level === "a2")
    return [
      "Listen once at normal speed, then word by word.",
      "Say every word clearly, including the endings.",
      "Repeat right after the audio, while it is fresh.",
    ];
  if (level === "c1" || level === "c2")
    return [
      "Keep the rhythm without pausing between ideas.",
      "Reduce small words (to, of, and) as natives do.",
      "Match the rise and fall of the speaker's voice.",
    ];
  return [
    "Stress the content words: nouns, verbs and adjectives.",
    "Link words together instead of saying them one by one.",
    "Copy the rise and fall of the sentence.",
  ];
}

function ListeningPage() {
  const { lang } = useUiLang();
  const { data: profile } = useProfile();
  const { data: lessons } = useLessons();
  const queryClient = useQueryClient();
  const saveListening = useServerFn(persistListeningLegacy);
  const minutesSpent = useTimeSpent();
  useLogTimeOnExit({
    timer: minutesSpent,
    profile,
    type: "listening_practice",
    title: "Listening practice",
  });
  const track = { id: LEGACY_TRACK_ID };
  // The drills follow the CEFR level stored on the profile.
  const levelInfo = findLevel(profile?.level);
  const config = listeningLevelConfig(profile?.level);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState<number | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [transcripts, setTranscripts] = useState<string[][]>([]);
  const operationKey = useRef(crypto.randomUUID());
  // Up to 3 attempts per sentence; the best score is kept. Below 70% forces a retry.
  const [attempts, setAttempts] = useState(0);
  const [best, setBest] = useState(0);
  const [playing, setPlaying] = useState(false);
  // "REVEAL" shows up for 5 seconds after the audio ends, in case the student didn't catch the sentence.
  const [canReveal, setCanReveal] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [recording, setRecording] = useState(false);
  // Shadowing: speaking along with the audio. Practice only, never scored for
  // the session, since the microphone can also pick up the playback.
  const [shadowing, setShadowing] = useState(false);
  const [shadowResult, setShadowResult] = useState<{ score: number; spoken: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState<CompletionMap>({});
  const [progress, setProgress] = useState<ProgressMap>({});

  useEffect(() => {
    setCompleted(readCompletion());
    setProgress(readProgress());
    return () => cancelVoiceRecording();
  }, []);

  useEffect(() => {
    setRevealed(false);
    setCanReveal(false);
    setAttempts(0);
    setBest(0);
  }, [index]);

  // A new round of sentences is unlocked every time the student starts a new lesson.
  const { data: startedLessons } = useLessonRound();
  const lessonCount = startedLessons ?? 0;

  const sentences = useMemo(
    () =>
      pickListeningSentences({
        config,
        lessonSentences: lessonSentencesForLevel(lessons ?? [], levelInfo.value, config),
        rotation: lessonCount,
        count: SENTENCES_PER_TRACK,
      }),
    [lessons, lessonCount, config, levelInfo.value],
  );

  const sentence = sentences[index] ?? "";
  // Finished on any device of this account during the current round.
  const roundStart = useRoundStart();
  const { data: saved } = useSavedPractice();
  const doneOnServer =
    roundStart !== undefined &&
    (saved?.listening ?? []).some((at) => !roundStart || at > roundStart);
  const redoneHere = completed[track.id] === -1 - lessonCount;
  const isDone = (completed[track.id] === lessonCount || doneOnServer) && !redoneHere;
  const trackProgress = progress[track.id];
  const trackRound = trackProgress?.round ?? -1;
  const trackDone = isDone && (trackRound === lessonCount || doneOnServer);
  // The student advances when reaching 70% or after using all 3 attempts (best score is kept).
  const passed = checked !== null && (checked >= 70 || attempts >= 3);
  const finished = index >= sentences.length - 1 && passed;
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  function markCompleted(id: string) {
    const nextCompletion = { ...readCompletion(), [id]: lessonCount };
    setCompleted(nextCompletion);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextCompletion));
    } catch {
      /* storage unavailable */
    }
  }

  /** Lets the student redo the current round to try to improve the score. */
  function redoActivity() {
    const completion = readCompletion();
    // Remembered as "redoing this round" so the server's record does not hide it again.
    completion[track.id] = -1 - lessonCount;
    setCompleted(completion);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(completion));
    } catch {
      /* storage unavailable */
    }
    const map = readProgress();
    delete map[track.id];
    setProgress(map);
    writeProgress(map);
    setIndex(0);
    setAnswer("");
    setChecked(null);
    setScores([]);
    setTranscripts([]);
    operationKey.current = crypto.randomUUID();
    setAttempts(0);
    setBest(0);
  }

  function recordAnswer(id: string, sentenceIndex: number) {
    const map = readProgress();
    const entry = map[id];
    const answered = entry?.round === lessonCount ? entry.answered : [];
    if (answered.includes(sentenceIndex)) return;
    const next: ProgressMap = {
      ...map,
      [id]: { round: lessonCount, answered: [...answered, sentenceIndex] },
    };
    setProgress(next);
    writeProgress(next);
  }

  async function play(slow = false) {
    setPlaying(true);
    try {
      // Lower levels practise word by word; from B1 the sentence stays whole,
      // just slower, so rhythm and intonation are preserved.
      if (slow && config.slowMode === "word-by-word") {
        const words = sentence.split(/\s+/).filter(Boolean);
        for (const word of words) {
          await speakEnglish(word, { cache: "persistent", rate: config.rate });
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      } else {
        await speakEnglish(sentence, {
          cache: "persistent",
          rate: slow ? config.rate * 0.85 : config.rate,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Audio is unavailable right now.");
    } finally {
      setPlaying(false);
      setCanReveal(true);
      // REVEAL is available for 5s after audio; only stays fixed on the third attempt.
      window.setTimeout(
        () =>
          setAttempts((a) => {
            if (a < 3) setCanReveal(false);
            return a;
          }),
        5000,
      );
    }
  }

  useEffect(() => {
    setShadowResult(null);
  }, [index, sentence]);

  /** Plays the sentence while recording, so the student speaks along with it. */
  async function shadow() {
    setShadowResult(null);
    try {
      await startVoiceRecording();
    } catch (error) {
      cancelVoiceRecording();
      toast.error(error instanceof Error ? error.message : "Microphone is unavailable right now.");
      return;
    }
    setShadowing(true);
    try {
      await speakEnglish(sentence, { cache: "persistent", rate: config.rate });
      // A short tail so the last word the student says is not cut off.
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const spoken = await transcribeAudio(await stopVoiceRecording());
      setShadowResult({ score: listeningAnswerScore(sentence, spoken), spoken });
    } catch (error) {
      cancelVoiceRecording();
      toast.error(
        error instanceof Error ? error.message : "I couldn't hear that clearly. Please try again.",
      );
    } finally {
      setShadowing(false);
    }
  }

  /** Starts recording the student repeating the sentence. */
  async function startRepeat() {
    try {
      await startVoiceRecording();
      setRecording(true);
    } catch (error) {
      cancelVoiceRecording();
      toast.error(error instanceof Error ? error.message : "Microphone is unavailable right now.");
    }
  }

  /** Stops the recording, transcribes it and scores the words the student repeated. */
  async function stopRepeat() {
    setRecording(false);
    setChecking(true);
    try {
      const spoken = await transcribeAudio(await stopVoiceRecording());
      if (!spoken) throw new Error("I couldn't hear that clearly. Please try again.");
      setAnswer(spoken);
      const value = listeningAnswerScore(sentence, spoken);
      setChecked(value);
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      setBest((prev) => Math.max(prev, value));
      // Keep only the best score of the attempts for this sentence.
      setScores((prev) => {
        const copy = [...prev];
        copy[index] = Math.max(copy[index] ?? 0, value);
        return copy;
      });
      setTranscripts((prev) => {
        const copy = prev.map((items) => [...items]);
        copy[index] = [...(copy[index] ?? []), spoken];
        return copy;
      });
      // After the third attempt, REVEAL stays available for the rest of the sentence.
      if (nextAttempts >= 3) setCanReveal(true);
      recordAnswer(track.id, index);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "I couldn't hear that clearly. Please try again.",
      );
    } finally {
      setChecking(false);
    }
  }

  async function next() {
    if (index < sentences.length - 1) {
      setIndex(index + 1);
      setAnswer("");
      setChecked(null);
      return;
    }
    // Saved first: only a stored session marks the round as completed, so a
    // failed save keeps the answers and the Finish button for a safe retry
    // (the same operation key makes the retry idempotent).
    let final: number | null = null;
    if (profile) {
      setSaving(true);
      try {
        const saved = (await saveListening({
          data: {
            operationKey: operationKey.current,
            trackId: track.id as "everyday" | "professional" | "travel",
            round: lessonCount,
            minutes: minutesSpent(1),
            evidence: sentences.map((expected, sentenceIndex) => ({
              expected,
              transcripts: transcripts[sentenceIndex] ?? [],
            })),
          },
        })) as { score?: number };
        final = saved.score ?? average;
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not save your listening session. Please try again.",
        );
        return;
      } finally {
        setSaving(false);
      }
    }
    markCompleted(track.id);
    const map = readProgress();
    const nextProgress: ProgressMap = {
      ...map,
      [track.id]: { round: lessonCount, answered: sentences.map((_, i) => i) },
    };
    setProgress(nextProgress);
    writeProgress(nextProgress);
    if (final !== null) {
      queryClient.invalidateQueries({ queryKey: ["minutes-today"] });
      queryClient.invalidateQueries({ queryKey: ["saved-practice"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(`Listening session saved with ${final}%`);
    }
    setIndex(0);
    setAnswer("");
    setChecked(null);
    setScores([]);
    setTranscripts([]);
    operationKey.current = crypto.randomUUID();
  }

  return (
    <AppShell mobileOneScreen>
      <div className="space-y-6">
        <header>
          <p className="text-sm text-muted-foreground">
            <span>Listening Practice</span>
            <span> • {config.label}</span>
          </p>
          <h1 className="text-2xl font-semibold">Train your ear with real English</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Listen to the sentence and repeat it out loud. Finish all 3 sentences to complete the
            activity — a new set arrives every time you start a new lesson in the Learning Center.
          </p>
          <Button variant="ghost" size="sm" className="mt-2 -ml-2" onClick={redoActivity}>
            <RotateCcw className="mr-2 size-4" /> Redo today's activity
          </Button>
        </header>

        {trackDone ? (
          <section className="card-soft space-y-5 p-6">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium">Today's tasks</label>
              <span className="text-sm text-muted-foreground">
                <span>3/3 </span>
                <span>done</span>
              </span>
            </div>
            <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-5 text-center">
              <CheckCircle2 className="mx-auto size-8 text-green-600" />
              <p className="mt-2 font-semibold">All 3 listening tasks completed!</p>
              <p className="mt-1 text-sm text-muted-foreground">
                New listening tasks arrive as soon as you start a new lesson in the Learning Center.
              </p>
              <Button variant="outline" className="mt-4" onClick={redoActivity}>
                <RotateCcw className="mr-2 size-4" /> Redo activity to improve your score
              </Button>
            </div>
          </section>
        ) : (
          // Desktop: the practice stage on the left, today's session and the
          // level focus on the right. Below xl both cards sit under the stage.
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,1fr)]">
            <section className="card-soft space-y-6 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <p className="text-sm text-muted-foreground">
                    <span>Sentence</span>
                    <span> {index + 1} </span>
                    <span>of</span>
                    <span> {sentences.length}</span>
                  </p>
                  <span className="flex gap-1.5" aria-hidden="true">
                    {sentences.map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-6 rounded-full ${
                          i < index || (i === index && passed)
                            ? "bg-brand-green"
                            : i === index
                              ? "bg-brand-green/50"
                              : "bg-secondary"
                        }`}
                      />
                    ))}
                  </span>
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                  <span>Accuracy</span>
                  <span> {average}%</span>
                </span>
              </div>

              {/* Listening stage: one big play control, slower replay underneath. */}
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                <button
                  type="button"
                  onClick={() => play(false)}
                  disabled={playing}
                  aria-label={playing ? "Playing..." : "Play sentence"}
                  className="grid size-20 place-items-center rounded-full bg-brand-green text-sidebar shadow-[0_0_0_10px_oklch(0.8_0.15_175/0.12)] transition-transform hover:scale-105 disabled:opacity-70"
                >
                  <Volume2 className="size-8" />
                </button>
                <p className="text-sm font-medium">{playing ? "Playing..." : "Play sentence"}</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => play(true)} disabled={playing}>
                    <RotateCcw className="mr-2 size-4" />{" "}
                    {config.slowMode === "word-by-word" ? "Play word by word" : "Play slower"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void shadow()}
                    disabled={playing || shadowing || recording || checking}
                    title="Speak along with the audio, at the same time. Headphones help."
                  >
                    {shadowing ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <AudioLines className="mr-2 size-4" />
                    )}
                    {shadowing ? "Speak along now..." : "Shadowing: speak along"}
                  </Button>
                </div>
                {shadowResult && (
                  <p className="max-w-md text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      <span>Shadowing</span> · {shadowResult.score}%
                    </span>{" "}
                    <span>(practice only, not scored)</span>
                    {shadowResult.spoken && (
                      <span className="block break-words">
                        <span>You said:</span> {shadowResult.spoken}
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* One slot per word: the length of the sentence before listening,
                  the words heard after a check, the full text when revealed. */}
              <div
                className="flex min-h-12 flex-wrap items-end justify-center gap-x-2 gap-y-3 rounded-xl bg-secondary/40 px-4 py-4"
                aria-label="Sentence words"
              >
                {checked !== null
                  ? wordMatches(sentence, answer).map((item, i) => (
                      <span
                        key={`${item.word}-${i}`}
                        className={
                          item.hit
                            ? "rounded bg-green-500/15 px-1.5 py-0.5 text-sm text-green-700 dark:text-green-400"
                            : "rounded bg-destructive/15 px-1.5 py-0.5 text-sm text-destructive"
                        }
                      >
                        {item.word}
                      </span>
                    ))
                  : sentence
                      .split(/\s+/)
                      .filter(Boolean)
                      .map((word, i) =>
                        revealed ? (
                          <span key={`${word}-${i}`} className="text-sm">
                            {word}
                          </span>
                        ) : (
                          <span
                            key={`${word}-${i}`}
                            className="h-1 rounded-full bg-muted-foreground/40"
                            style={{ width: `${Math.max(2, word.length) * 0.55}rem` }}
                          />
                        ),
                      )}
              </div>

              {(canReveal || revealed) && checked === null && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setRevealed((value) => !value)}
                    className="inline-flex min-h-11 items-center text-sm font-bold uppercase tracking-wide text-success underline-offset-4 hover:underline"
                  >
                    {revealed ? "Hide sentence" : "REVEAL"}
                  </button>
                </div>
              )}

              {checked !== null ? (
                <div className="rounded-xl bg-secondary p-4 text-sm">
                  <p className="flex items-center gap-2 font-medium">
                    {checked >= 80 ? (
                      <Check className="size-4 text-primary" />
                    ) : (
                      <X className="size-4 text-destructive" />
                    )}
                    You repeated {checked}% of the words.
                  </p>
                  <p className="mt-2 break-words text-muted-foreground">
                    Correct sentence: {sentence}
                  </p>
                  {answer && (
                    <p className="mt-1 break-words text-muted-foreground">You said: {answer}</p>
                  )}
                  <p className="mt-2 text-muted-foreground">
                    Attempt {attempts} of 3 · Best result: {best}%
                    {!passed && checked < 70 && " · You need at least 70% — try again."}
                    {passed && checked < 70 && " · No attempts left, keeping your best result."}
                  </p>
                </div>
              ) : (
                <div className="space-y-1 text-center">
                  <p className="text-sm font-medium">Now repeat the sentence out loud</p>
                  <p className="text-sm text-muted-foreground">
                    Record your voice and the AI checks which words you understood and repeated.
                  </p>
                </div>
              )}

              <div className="flex justify-center">
                {checked === null || !passed ? (
                  recording ? (
                    <Button size="lg" variant="destructive" onClick={stopRepeat}>
                      <Square className="mr-2 size-4" /> Stop and check
                    </Button>
                  ) : (
                    <Button size="lg" onClick={startRepeat} disabled={checking || playing}>
                      <Mic className="mr-2 size-4" />{" "}
                      {checking
                        ? "Checking..."
                        : checked !== null
                          ? "Try again"
                          : "Repeat the sentence"}
                    </Button>
                  )
                ) : (
                  <Button size="lg" onClick={next} disabled={saving}>
                    {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                    {finished ? "Finish session" : "Next sentence"}
                  </Button>
                )}
              </div>
            </section>

            <aside className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <section className="card-soft p-4">
                <h2 className="text-sm font-semibold">Today's session</h2>
                <ol className="mt-2.5 space-y-1.5">
                  {sentences.map((_, i) => {
                    const done = i < index || (i === index && passed);
                    const current = i === index && !passed;
                    return (
                      <li
                        key={i}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-1.5 text-sm ${
                          current ? "border-brand-green/50 bg-brand-green/10" : "border-border"
                        }`}
                      >
                        <span
                          className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                            done ? "bg-brand-green text-sidebar" : "bg-secondary"
                          }`}
                        >
                          {done ? <Check className="size-3.5" /> : i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span>Sentence</span> <span>{i + 1}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {done ? (
                            `${scores[i] ?? 0}%`
                          ) : current ? (
                            <span>In progress</span>
                          ) : (
                            <span>Up next</span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                {saved?.lastListening && (
                  <p className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
                    <span>
                      <span>Last result</span> · {formatDate(saved.lastListening.at, lang)}
                    </span>
                    <span className="text-base font-bold text-brand-green">
                      {saved.lastListening.score != null ? `${saved.lastListening.score}%` : "—"}
                    </span>
                  </p>
                )}
              </section>

              <section className="card-soft p-4">
                <h2 className="text-sm font-semibold">
                  <span>Pronunciation focus</span> · {config.label}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">{config.focus}</p>
                <ul className="mt-2.5 space-y-1 text-sm text-muted-foreground">
                  {listeningTips(config.level).map((tip) => (
                    <li key={tip} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-green" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </aside>
          </div>
        )}
      </div>
    </AppShell>
  );
}
