import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, CheckCircle2, Headphones, Mic, RotateCcw, Square, Volume2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLessons, type Lesson } from "@/hooks/useLearning";
import { useLessonRound } from "@/hooks/useLessonRound";
import { logActivity, useProfile } from "@/hooks/useProfile";
import { useTimeSpent } from "@/hooks/useTimeSpent";
import { speakEnglish } from "@/lib/speech";
import { transcribeAudio } from "@/lib/transcribe";
import { cancelVoiceRecording, startVoiceRecording, stopVoiceRecording } from "@/lib/voice-recorder";

export const Route = createFileRoute("/_authenticated/listening")({
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · Listening Lab" },
      { name: "description", content: "Train your English listening with dictation drills for everyday, work and travel." },
      { property: "og:title", content: "Evoluir+ English AI · Listening Lab" },
      { property: "og:description", content: "Listen to natural English sentences and repeat them out loud." },
    ],
  }),
  component: ListeningPage,
});

type Track = { id: string; label: string; description: string; sentences: string[] };

/** Each track presents one sentence per round. */
const SENTENCES_PER_TRACK = 3;
/** Pronunciation drills use short sentences: 5 to 7 words. */
const MIN_WORDS = 5;
const MAX_WORDS = 7;

function countWords(sentence: string) {
  return sentence.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;
}

function clampWords(sentence: string, max = MAX_WORDS) {
  const words = sentence.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length <= max) return sentence.trim();
  const clipped = words.slice(0, max).join(" ").replace(/[,;:]$/, "");
  return /[.!?]$/.test(clipped) ? clipped : `${clipped}.`;
}

/** Keeps only drills with 5 to 7 words. */
function isDrillLength(sentence: string) {
  const total = countWords(sentence);
  return total >= MIN_WORDS && total <= MAX_WORDS;
}

const tracks: Track[] = [
  {
    id: "everyday",
    label: "Everyday English",
    description: "Daily routines, small talk and casual plans.",
    sentences: [
      "I get up early every morning.",
      "Let's grab a coffee after work.",
      "She lives near the train station.",
      "I forgot my keys at home.",
      "We are having dinner outside tonight.",
      "It looks like rain this afternoon.",
    ],
  },
  {
    id: "professional",
    label: "Professional English",
    description: "Meetings, emails and workplace conversations.",
    sentences: [
      "Could you send me the report?",
      "We must call the client today.",
      "The deadline moved to next month.",
      "Let's schedule a quick call tomorrow.",
      "I need support with this presentation.",
      "The team delivered the first version.",
    ],
  },
  {
    id: "travel",
    label: "Travel English",
    description: "Airports, hotels, restaurants and directions.",
    sentences: [
      "Where is the gate for Lisbon?",
      "I have a reservation for tonight.",
      "How do I reach the station?",
      "Is breakfast included in the price?",
      "A table for two, please.",
      "My luggage did not arrive today.",
    ],
  },
];

/** Sentences taken from the lessons the student already has, so listening follows the course. */
function lessonSentences(lessons: Lesson[]) {
  const byCategory = new Map<string, string[]>();
  for (const lesson of lessons) {
    const text = `${lesson.summary ?? ""} ${lesson.transcript ?? ""}`;
    const parts = text
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+/)
      .map((s) => clampWords(s.trim()))
      .filter((s) => isDrillLength(s) && /^[A-Za-z]/.test(s));
    const key = (lesson.category || "general").toLowerCase();
    byCategory.set(key, [...(byCategory.get(key) ?? []), ...parts]);
  }
  return byCategory;
}

// Grammar lessons never feed the tracks — sentences must match each track's theme.
const trackCategories: Record<string, string[]> = {
  everyday: ["everyday", "conversation", "vocabulary", "general", "speaking", "listening"],
  professional: ["professional", "business", "work", "writing"],
  travel: ["travel"],
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function scoreAnswer(expected: string, answer: string) {
  const target = normalize(expected);
  const given = normalize(answer);
  const pool = [...given];
  let hits = 0;
  for (const word of target) {
    const index = pool.indexOf(word);
    if (index >= 0) {
      hits += 1;
      pool.splice(index, 1);
    }
  }
  return target.length ? Math.round((hits / target.length) * 100) : 0;
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
  const minutesSpent = useTimeSpent();
  const track = tracks[0]!;
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState<number | null>(null);
  const [scores, setScores] = useState<number[]>([]);
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

  const sentences = useMemo(() => {
    const fromLessons = lessonSentences(lessons ?? []);
    const extra = (trackCategories[track.id] ?? []).flatMap((c) => (fromLessons.get(c) ?? []).map(clampWords));
    const pool = [...new Set([...extra, ...track.sentences.map(clampWords)])].filter(isDrillLength);
    const start = pool.length ? (lessonCount * SENTENCES_PER_TRACK) % pool.length : 0;
    const picked: string[] = [];
    for (let i = 0; i < Math.min(SENTENCES_PER_TRACK, pool.length); i += 1) {
      picked.push(pool[(start + i) % pool.length]!);
    }
    return picked;
  }, [lessons, lessonCount, track]);

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
      if (slow) {
        const words = sentence.split(/\s+/).filter(Boolean);
        for (const word of words) {
          await speakEnglish(word);
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      } else {
        await speakEnglish(sentence);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Audio is unavailable right now.");
    } finally {
      setPlaying(false);
      setCanReveal(true);
      // REVEAL is available for 5s after audio; only stays fixed on the third attempt.
      window.setTimeout(() => setAttempts((a) => {
        if (a < 3) setCanReveal(false);
        return a;
      }), 5000);
    }
  }

  /** Starts recording the student repeating the sentence. */
  async function startRepeat() {
    try {
      await startVoiceRecording();
      setRecording(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Microphone is unavailable right now.");
    }
  }

  /** Stops the recording, transcribes it and scores the words the student repeated. */
  async function stopRepeat() {
    setRecording(false);
    setChecking(true);
    try {
      const blob = await stopVoiceRecording();
      const spoken = await transcribeAudio(blob);
      setAnswer(spoken);
      const value = scoreAnswer(sentence, spoken);
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
      // After the third attempt, REVEAL stays available for the rest of the sentence.
      if (nextAttempts >= 3) setCanReveal(true);
      recordAnswer(track.id, index);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "I couldn't hear that clearly. Please try again.");
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
      const final = Math.round([...scores].reduce((a, b) => a + b, 0) / Math.max(1, scores.length));
      await logActivity({
        userId: profile.id,
        type: "listening",
        title: `Listening Lab: ${track.label}`,
        minutes: minutesSpent(1),
        score: final,
        scores: { listening: final },
        currentStreak: profile.streak_days,
        lastDate: profile.last_activity_date,
      });
      queryClient.invalidateQueries({ queryKey: ["minutes-today"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(`Listening session saved with ${final}%`);
    }
    setIndex(0);
    setAnswer("");
    setChecked(null);
    setScores([]);
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <header>
          <p className="text-sm text-muted-foreground">Listening Lab</p>
          <h1 className="text-2xl font-semibold">Train your ear with real English</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Listen to the sentence and repeat it out loud. Finish all 3 sentences to complete the activity and unlock
            a new set when new lessons are created.
          </p>
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
                New listening tasks arrive when you create new lessons in the Learning Center.
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
            <Progress value={((index + (checked !== null ? 1 : 0)) / Math.max(1, sentences.length)) * 100} />

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => play(false)} disabled={playing}>
                <Volume2 className="mr-2 size-4" /> {playing ? "Playing..." : "Play sentence"}
              </Button>
              <Button variant="outline" onClick={() => play(true)} disabled={playing}>
                <RotateCcw className="mr-2 size-4" /> Play word by word
              </Button>
            </div>

            {(canReveal || revealed) && (
              <div className="space-y-2">
                {!revealed ? (
                  <button
                    type="button"
                    onClick={() => setRevealed(true)}
                    className="text-sm font-bold uppercase tracking-wide text-success underline-offset-4 hover:underline"
                  >
                    REVEAL
                  </button>
                ) : (
                  <div className="space-y-1">
                    <p className="rounded-xl bg-secondary p-3 text-sm">{sentence}</p>
                    <button
                      type="button"
                      onClick={() => setRevealed(false)}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground"
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
                <p className="mt-2 text-muted-foreground">Correct sentence: {sentence}</p>
                {answer && <p className="mt-1 text-muted-foreground">You said: {answer}</p>}
                <p className="mt-2 text-muted-foreground">
                  Attempt {attempts} of 3 · Best result: {best}%
                  {!passed && checked < 70 && " · You need at least 70% — try again."}
                  {passed && checked < 70 && " · No attempts left, keeping your best result."}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              {checked === null || !passed ? (
                recording ? (
                  <Button variant="destructive" onClick={stopRepeat}>
                    <Square className="mr-2 size-4" /> Stop and check
                  </Button>
                ) : (
                  <Button onClick={startRepeat} disabled={checking || playing}>
                    <Mic className="mr-2 size-4" />{" "}
                    {checking ? "Checking..." : checked !== null ? "Try again" : "Repeat the sentence"}
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
