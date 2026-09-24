import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, CheckCircle2, Headphones, Mic, RotateCcw, Square, Volume2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLessons, type Lesson } from "@/hooks/useLearning";
import { useLessonRound } from "@/hooks/useLessonRound";
import { useProfile } from "@/hooks/useProfile";
import { useLogTimeOnExit, useTimeSpent } from "@/hooks/useTimeSpent";
import { findLevel } from "@/lib/level";
import {
  listeningLevelConfig,
  pickListeningSentences,
  sentencesFromText,
  type ListeningLevelConfig,
} from "@/lib/listeningLevels";
import { speakEnglish } from "@/lib/speech";
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

function ListeningPage() {
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
  const [checking, setChecking] = useState(false);
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
  const isDone = completed[track.id] === lessonCount;
  const trackProgress = progress[track.id];
  const trackRound = trackProgress?.round ?? -1;
  const trackDone = isDone && trackRound === lessonCount;
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
    delete completion[track.id];
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
    markCompleted(track.id);
    const map = readProgress();
    const nextProgress: ProgressMap = {
      ...map,
      [track.id]: { round: lessonCount, answered: sentences.map((_, i) => i) },
    };
    setProgress(nextProgress);
    writeProgress(nextProgress);
    if (profile) {
      const saved = await saveListening({
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
      });
      const result = saved as { score?: number };
      const final = result.score ?? average;
      queryClient.invalidateQueries({ queryKey: ["minutes-today"] });
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
    <AppShell>
      <div className="space-y-6">
        <header>
          <p className="text-sm text-muted-foreground">
            <span>Listening Practice</span>
            <span> • {config.label}</span>
          </p>
          <h1 className="text-2xl font-semibold">Train your ear with real English</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Listen to the sentence and repeat it out loud. Finish all 3 sentences to complete the
            activity — a new set arrives every time you start a new lesson in the Learning Center.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            <span>Pronunciation</span>
            <span> • {config.label} — </span>
            <span>{config.focus}</span>
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
          <section className="card-soft space-y-5 p-6">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                <span>Sentence</span>
                <span> {index + 1} </span>
                <span>of</span>
                <span> {sentences.length}</span>
              </p>
              <p className="text-sm font-medium">
                <span>Accuracy</span>
                <span> {average}%</span>
              </p>
            </div>
            <Progress
              value={((index + (checked !== null ? 1 : 0)) / Math.max(1, sentences.length)) * 100}
            />

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => play(false)} disabled={playing}>
                <Volume2 className="mr-2 size-4" /> {playing ? "Playing..." : "Play sentence"}
              </Button>
              <Button variant="outline" onClick={() => play(true)} disabled={playing}>
                <RotateCcw className="mr-2 size-4" />{" "}
                {config.slowMode === "word-by-word" ? "Play word by word" : "Play slower"}
              </Button>
            </div>

            {(canReveal || revealed) && (
              <div className="space-y-2">
                {!revealed ? (
                  <button
                    type="button"
                    onClick={() => setRevealed(true)}
                    className="inline-flex min-h-11 items-center text-sm font-bold uppercase tracking-wide text-success underline-offset-4 hover:underline"
                  >
                    REVEAL
                  </button>
                ) : (
                  <div className="space-y-1">
                    <p className="rounded-xl bg-secondary p-3 text-sm">{sentence}</p>
                    <button
                      type="button"
                      onClick={() => setRevealed(false)}
                      className="inline-flex min-h-11 items-center text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      Hide sentence
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">Now repeat the sentence out loud</p>
              <p className="text-sm text-muted-foreground">
                Record your voice and the AI checks which words you understood and repeated.
              </p>
            </div>

            {checked !== null && (
              <div className="rounded-xl bg-secondary p-4 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  {checked >= 80 ? (
                    <Check className="size-4 text-primary" />
                  ) : (
                    <X className="size-4 text-destructive" />
                  )}
                  You repeated {checked}% of the words.
                </p>
                <p className="mt-2 flex flex-wrap gap-1">
                  {wordMatches(sentence, answer).map((item, i) => (
                    <span
                      key={`${item.word}-${i}`}
                      className={
                        item.hit
                          ? "rounded bg-green-500/15 px-1.5 py-0.5 text-green-700 dark:text-green-400"
                          : "rounded bg-destructive/15 px-1.5 py-0.5 text-destructive"
                      }
                    >
                      {item.word}
                    </span>
                  ))}
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
            )}

            <div className="flex flex-wrap gap-3">
              {checked === null || !passed ? (
                recording ? (
                  <Button variant="destructive" onClick={stopRepeat}>
                    <Square className="mr-2 size-4" /> Stop and check
                  </Button>
                ) : (
                  <Button onClick={startRepeat} disabled={checking || playing}>
                    <Mic className="mr-2 size-4" />{" "}
                    {checking
                      ? "Checking..."
                      : checked !== null
                        ? "Try again"
                        : "Repeat the sentence"}
                  </Button>
                )
              ) : (
                <Button onClick={next}>{finished ? "Finish session" : "Next sentence"}</Button>
              )}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
