import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ChevronDown,
  ChevronUp,
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

import { PageHeader } from "@/components/PageHeader";
import { AppShell } from "@/components/AppShell";
import { useTodayActivities } from "@/components/DailyGoalCard";
import { Button } from "@/components/ui/button";
import { useLessons, type Lesson } from "@/hooks/useLearning";
import { useSavedPractice } from "@/hooks/usePracticeSync";
import { useProfile } from "@/hooks/useProfile";
import { useLogTimeOnExit, useTimeSpent } from "@/hooks/useTimeSpent";
import { findLevel } from "@/lib/level";
import { STUDY_DAY_RULE } from "@/lib/studyDay";
import { studyDayStartIso, studyToday } from "@/lib/today";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  listeningLevelConfig,
  pickListeningSentences,
  RECENT_LESSON_SENTENCES,
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
import { DoneSeal } from "@/components/DoneSeal";
import { MusicLabSection } from "@/components/listening/MusicLabSection";

export const Route = createFileRoute("/_authenticated/listening")({
  head: () => ({
    meta: [
      { title: "Listening Lab - Evoluir+ English AI" },
      {
        name: "description",
        content:
          "Train your English listening with dictation drills for everyday, work and travel.",
      },
      { property: "og:title", content: "Listening Lab - Evoluir+ English AI" },
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

/**
 * One session is 9 sentences, one at a time (user request, 2026-10-24: three
 * sessions of 3 meant pressing "redo" and hearing the same sentences again).
 * It is saved in parts of 3, each one "listening" activity, so a whole session
 * is the study day's 3 activities (credit_study_day unchanged) and leaving
 * halfway keeps the parts already done.
 */
const SENTENCES_PER_PART = 3;
const PARTS_PER_SESSION = STUDY_DAY_RULE.listening;
const SENTENCES_PER_SESSION = SENTENCES_PER_PART * PARTS_PER_SESSION;
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
  // Parts saved today (each one "listening" activity of 3 sentences). Parts
  // saved on this screen count at once, before today's activities are read again.
  const { data: todayActivities } = useTodayActivities(profile?.id);
  const partsSavedToday = (todayActivities ?? []).filter(
    (row) => row.activity_type === "listening",
  ).length;
  const [partsSavedHere, setPartsSavedHere] = useState(0);
  const partsToday = Math.max(partsSavedToday, partsSavedHere);
  const sessionNumber = Math.floor(partsToday / PARTS_PER_SESSION);
  // "Do another session" after today's session was finished.
  const [another, setAnother] = useState(false);
  const sessionDone =
    partsToday >= PARTS_PER_SESSION && partsToday % PARTS_PER_SESSION === 0 && !another;
  const savedSentencesToday = Math.min(partsToday, PARTS_PER_SESSION) * SENTENCES_PER_PART;
  const minutesSpent = useTimeSpent();
  // A session left before Finish still counts once a sentence was answered
  // (minutes audit, 2026-10-24: 2 of 3 sentences left with 0).
  const [answeredSentences, setAnsweredSentences] = useState(0);
  useLogTimeOnExit({
    timer: minutesSpent,
    profile: answeredSentences > 0 ? profile : null,
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
  useEffect(() => {
    setAnsweredSentences(transcripts.filter((tries) => tries.length > 0).length);
  }, [transcripts]);
  const operationKey = useRef(crypto.randomUUID());
  // Up to 3 attempts per sentence; the best score is kept. Below 70% forces a retry.
  const [attempts, setAttempts] = useState(0);
  const [best, setBest] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Repeating is only possible after the sentence was heard (user request).
  const [heard, setHeard] = useState(false);
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
  const [pronunciationFocusExpanded, setPronunciationFocusExpanded] = useState(false);

  useEffect(() => () => cancelVoiceRecording(), []);

  // A session left halfway resumes at its next part, once today's parts are known.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || todayActivities === undefined) return;
    resumed.current = true;
    setIndex((partsSavedToday % PARTS_PER_SESSION) * SENTENCES_PER_PART);
  }, [todayActivities, partsSavedToday]);

  useEffect(() => {
    setRevealed(false);
    setCanReveal(false);
    setAttempts(0);
    setBest(0);
    setHeard(false);
  }, [index]);

  // The sentences move on every day, with every lesson opened and with every
  // session finished today, so "Do another session" never repeats them, and
  // the lesson opened last opens the session with its own sentences (owner
  // report, 2026-10-26: only completed lessons moved the rotation, and the
  // lesson's sentences sat at the end of the pool).
  const levelLessons = useMemo(
    () => (lessons ?? []).filter((lesson) => findLevel(lesson.level).value === levelInfo.value),
    [lessons, levelInfo.value],
  );
  const lessonCount = levelLessons.length;
  // The lesson opened last, while it is from today: its sentences open the
  // day's sessions, three per session, so "Do another session" never repeats them.
  const newestLesson = useMemo(
    () => [...levelLessons].sort((a, b) => b.created_at.localeCompare(a.created_at))[0],
    [levelLessons],
  );
  const recentSentences = useMemo(() => {
    if (!newestLesson || studyToday(new Date(newestLesson.created_at)) !== studyToday()) return [];
    return sentencesFromText(
      `${newestLesson.summary ?? ""} ${newestLesson.transcript ?? ""}`,
      config,
    ).slice(sessionNumber * RECENT_LESSON_SENTENCES, (sessionNumber + 1) * RECENT_LESSON_SENTENCES);
  }, [newestLesson, config, sessionNumber]);
  const dayNumber = Math.floor(Date.parse(`${studyToday()}T00:00:00Z`) / 86_400_000);

  const pickedSentences = useMemo(
    () =>
      pickListeningSentences({
        config,
        lessonSentences: lessonSentencesForLevel(levelLessons, levelInfo.value, config),
        recentSentences,
        rotation: dayNumber + lessonCount + sessionNumber,
        count: SENTENCES_PER_SESSION,
      }),
    [levelLessons, recentSentences, lessonCount, dayNumber, sessionNumber, config, levelInfo.value],
  );
  // Kept from the first answer to the session's end: lessons loading late or a
  // lesson started mid-session would otherwise change the sentences under the
  // student, and a later part could repeat one already done.
  const [frozenSentences, setFrozenSentences] = useState<string[] | null>(null);
  const sentences = frozenSentences ?? pickedSentences;

  const sentence = sentences[index] ?? "";
  // The latest saved part, shown as "Last result".
  const { data: saved } = useSavedPractice();
  // The student advances when reaching 70% or after using all 3 attempts (best score is kept).
  const passed = checked !== null && (checked >= 70 || attempts >= 3);
  const finished = index >= sentences.length - 1 && passed;
  // Scores of the parts saved before this visit (a session resumed halfway):
  // each saved part keeps its sentences' scores (activities.result.itemScores),
  // so "Today's session" and Accuracy show them instead of "Saved" and NaN
  // (user report, 2026-10-24).
  const { data: savedPartScores = [] } = useQuery({
    queryKey: ["listening-parts-today", profile?.id],
    enabled: !!profile?.id,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select("result, created_at")
        .eq("user_id", profile!.id)
        .eq("activity_type", "listening")
        .gte("created_at", studyDayStartIso())
        .order("created_at");
      return (data ?? []).map((row) => {
        const itemScores = (row.result as { itemScores?: unknown } | null)?.itemScores;
        return Array.isArray(itemScores)
          ? itemScores.map((value) => (typeof value === "number" ? value : null))
          : [];
      });
    },
  });
  // The current session's earlier parts are the last ones saved today.
  const partsBefore = Math.floor(index / SENTENCES_PER_PART);
  const earlierScores = (partsBefore > 0 ? savedPartScores.slice(-partsBefore) : []).flatMap(
    (part) => Array.from({ length: SENTENCES_PER_PART }, (_, at) => part[at] ?? null),
  );
  /** A sentence's score: this visit's answer, else the saved part's. */
  const scoreAt = (at: number): number | null => scores[at] ?? earlierScores[at] ?? null;
  const knownScores = sentences
    .map((_, at) => scoreAt(at))
    .filter((value): value is number => typeof value === "number");
  // "Sentences today" moves with every sentence done (user request,
  // 2026-10-25: it stayed at 0/9 until a part of 3 was saved): the saved
  // parts plus the sentences passed in the part being done. It stops one
  // short of the goal until the last part is saved, since only a saved
  // session completes the study day.
  const doneInPart = sessionDone ? 0 : (index % SENTENCES_PER_PART) + (passed ? 1 : 0);
  const sentencesToday =
    savedSentencesToday >= SENTENCES_PER_SESSION
      ? SENTENCES_PER_SESSION
      : Math.min(savedSentencesToday + doneInPart, SENTENCES_PER_SESSION - 1);
  const average = knownScores.length
    ? Math.round(knownScores.reduce((a, b) => a + b, 0) / knownScores.length)
    : 0;

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
      setHeard(true);
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
    setHeard(false);
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
      setFrozenSentences((current) => current ?? sentences);
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
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "I couldn't hear that clearly. Please try again.",
      );
    } finally {
      setChecking(false);
    }
  }

  async function next() {
    const lastOfPart = (index + 1) % SENTENCES_PER_PART === 0 || index >= sentences.length - 1;
    if (!lastOfPart) {
      setIndex(index + 1);
      setAnswer("");
      setChecked(null);
      return;
    }
    // Each part of 3 is saved before moving on: only a stored part counts, so
    // a failed save keeps the answers and the button for a safe retry (the
    // same operation key makes the retry idempotent).
    const partStart = index - (index % SENTENCES_PER_PART);
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
            evidence: sentences.slice(partStart, index + 1).map((expected, offset) => ({
              expected,
              transcripts: transcripts[partStart + offset] ?? [],
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
      setPartsSavedHere(partsToday + 1);
      queryClient.invalidateQueries({ queryKey: ["minutes-today"] });
      queryClient.invalidateQueries({ queryKey: ["listening-parts-today"] });
      queryClient.invalidateQueries({ queryKey: ["saved-practice"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    }
    operationKey.current = crypto.randomUUID();
    setAnswer("");
    setChecked(null);
    if (index < sentences.length - 1) {
      // The session goes on with the next part's sentences.
      if (final !== null)
        toast.success(
          lang === "pt"
            ? `Progresso salvo: ${index + 1}/${sentences.length} frases`
            : `Progress saved: ${index + 1}/${sentences.length} sentences`,
        );
      setIndex(index + 1);
      return;
    }
    if (final !== null)
      toast.success(
        lang === "pt"
          ? `Sessão de Listening salva com ${average}%`
          : `Listening session saved with ${average}%`,
      );
    setAnother(false);
    setFrozenSentences(null);
    setIndex(0);
    setScores([]);
    setTranscripts([]);
  }

  /** Starts a new session of 9 sentences after today's was finished. */
  function startAnotherSession() {
    setAnother(true);
    setFrozenSentences(null);
    setIndex(0);
    setAnswer("");
    setChecked(null);
    setScores([]);
    setTranscripts([]);
    setAttempts(0);
    setBest(0);
    operationKey.current = crypto.randomUUID();
  }

  return (
    <AppShell mobileOneScreen>
      <div className="space-y-6">
        <PageHeader
          icon={Headphones}
          accent="sky"
          eyebrow={
            <>
              <span>Listening Practice</span>
              <span> • {config.label}</span>
            </>
          }
          title={<>Train your ear with real English</>}
          descriptionClassName="max-w-3xl"
          description={
            <>
              Listen to the sentence and repeat it out loud. One session has 9 sentences and your
              progress is saved every 3, so you can stop and come back later.
            </>
          }
        />

        {sessionDone ? (
          <section className="card-soft space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium">This session</label>
              <span className="text-sm text-muted-foreground">
                <span>
                  {SENTENCES_PER_SESSION}/{SENTENCES_PER_SESSION}{" "}
                </span>
                <span>sentences</span>
              </span>
            </div>
            <div className="rounded-xl border border-brand-green/40 bg-brand-green/10 p-5 text-center">
              <DoneSeal className="mx-auto" />
              <p className="mt-2 font-semibold">Session complete: all 9 sentences done!</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Want more? Another session brings 9 new sentences.
              </p>
              <Button variant="outline" className="mt-4" onClick={startAnotherSession}>
                <RotateCcw className="mr-2 size-4" /> Do another session
              </Button>
            </div>
          </section>
        ) : (
          // Desktop: the practice stage on the left, today's session and the
          // level focus on the right. Below xl both cards sit under the stage.
          <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(15rem,0.8fr)_minmax(22rem,1.1fr)]">
            <section className="card-soft flex h-full flex-col gap-4 p-4 sm:p-5">
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
                        className={`h-1.5 w-3 rounded-full sm:w-5 ${
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
                  {/* "—" until the first try (user report: "0%" read as a failure). */}
                  <span> {knownScores.length ? `${average}%` : "—"}</span>
                </span>
              </div>

              <div className="flex flex-1 flex-col justify-center gap-4 py-3">
                {/* Listening stage: one big play control, slower replay underneath. */}
                <div className="flex flex-col items-center gap-2 py-1 text-center">
                  <button
                    type="button"
                    onClick={() => play(false)}
                    disabled={playing}
                    aria-label={playing ? "Playing..." : "Play sentence"}
                    className="grid size-16 place-items-center rounded-full bg-brand-green text-sidebar shadow-[0_0_0_7px_oklch(0.8_0.15_175/0.12)] transition-transform hover:scale-105 disabled:opacity-70"
                  >
                    <Volume2 className="size-7" />
                  </button>
                  <p className="text-sm font-medium">{playing ? "Playing..." : "Play sentence"}</p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => play(true)}
                      disabled={playing}
                    >
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
                  role="group"
                  aria-label="Sentence words"
                >
                  {checked !== null
                    ? wordMatches(sentence, answer).map((item, i) => (
                        <span
                          key={`${item.word}-${i}`}
                          className={
                            item.hit
                              ? "rounded bg-brand-green/15 px-1.5 py-0.5 text-sm text-brand-green"
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
                    <p className="text-sm font-medium">
                      {heard ? "Now repeat the sentence out loud" : "Play the sentence first"}
                    </p>
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
                      <Button
                        size="lg"
                        className="min-h-14 px-7 text-base"
                        onClick={startRepeat}
                        disabled={checking || playing || !heard}
                      >
                        <Mic className="mr-2 size-5" />{" "}
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
              </div>
            </section>

            <aside className="grid h-full gap-4 md:grid-cols-2 xl:grid-cols-1">
              <section className="card-soft h-full space-y-4 p-4">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-display text-sm font-semibold">Today's session</h2>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {sentencesToday}/{SENTENCES_PER_SESSION}
                    </span>
                  </div>
                  <div
                    className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"
                    role="progressbar"
                    aria-label="Today's session progress"
                    aria-valuemin={0}
                    aria-valuemax={SENTENCES_PER_SESSION}
                    aria-valuenow={sentencesToday}
                  >
                    <div
                      className="h-full rounded-full bg-brand-green transition-[width]"
                      style={{ width: `${(sentencesToday / SENTENCES_PER_SESSION) * 100}%` }}
                    />
                  </div>
                  <ol className="mt-3 space-y-1.5">
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
                              scoreAt(i) != null ? (
                                `${scoreAt(i)}%`
                              ) : (
                                <span>Saved</span>
                              )
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
                </div>
                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                      <AudioLines className="size-4 shrink-0 text-brand-green" aria-hidden="true" />
                      <span>Pronunciation focus</span>
                      <span className="text-muted-foreground">· {config.label}</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setPronunciationFocusExpanded((expanded) => !expanded)}
                      aria-expanded={pronunciationFocusExpanded}
                      aria-label={
                        pronunciationFocusExpanded
                          ? "Minimize pronunciation focus"
                          : "Maximize pronunciation focus"
                      }
                      className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {pronunciationFocusExpanded ? (
                        <ChevronUp className="size-4" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {pronunciationFocusExpanded && (
                    <>
                      <p className="mt-1 text-xs leading-snug text-muted-foreground">
                        {config.focus}
                      </p>
                      <ul className="mt-1.5 space-y-1 text-xs leading-snug text-muted-foreground">
                        {listeningTips(config.level).map((tip) => (
                          <li key={tip} className="flex gap-2">
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-green" />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </section>
            </aside>
            <MusicLabSection level={levelInfo.value} levelLabel={levelInfo.label} />
          </div>
        )}
        {sessionDone && <MusicLabSection level={levelInfo.value} levelLabel={levelInfo.label} />}
      </div>
    </AppShell>
  );
}
