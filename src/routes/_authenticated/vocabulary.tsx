import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Mic, RotateCcw, Search, Square, Volume2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLessonRound } from "@/hooks/useLessonRound";
import { useProfile } from "@/hooks/useProfile";
import { useTimeSpent } from "@/hooks/useTimeSpent";
import { supabase } from "@/integrations/supabase/client";
import { createAttemptGate } from "@/lib/attemptGate";
import {
  vocabularyGenerationFailureKey,
  vocabularyGenerationRecentlyFailed,
} from "@/lib/activityIndicators";

import { speakEnglish, stopSpeaking } from "@/lib/speech";
import { studyToday } from "@/lib/today";
import { pronunciationScore, transcribeAudio } from "@/lib/transcribe";
import {
  cancelBrowserRecognition,
  startBrowserRecognition,
  stopBrowserRecognition,
} from "@/lib/browserSpeech";
import {
  cancelVoiceRecording,
  startVoiceRecording,
  stopVoiceRecording,
} from "@/lib/voice-recorder";
import { lookupWord } from "@/lib/dictionary.functions";
import { dailyWords } from "@/lib/vocabularyPlan.functions";
import { vocabularySingleFlight } from "@/lib/vocabularySingleFlight";
import { useUiLang } from "@/lib/uiLang";
import { uiPt } from "@/lib/uiDictionary";
import { logPracticeTelemetry, persistPronunciationLegacy } from "@/lib/legacyActivity.functions";
import {
  DAILY_REVIEW_LIMIT,
  LEARNED_MASTERY,
  advance,
  canAdvance,
  fallBack,
  isDue,
} from "@/lib/vocabularyReview";

export const Route = createFileRoute("/_authenticated/vocabulary")({
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · Vocabulary builder" },
      {
        name: "description",
        content: "Learn new English words every day and test your pronunciation out loud.",
      },
      { property: "og:title", content: "Evoluir+ English AI · Vocabulary builder" },
      {
        property: "og:description",
        content: "Fresh English words every day, with pronunciation practice.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Vocabulary,
});

type Word = {
  id: string;
  word: string;
  translation: string;
  meaning: string;
  pronunciation: string;
  example: string;
  category: string;
  difficulty: string;
};

function highlightWord(sentence: string, word: string) {
  const safe = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${safe})`, "gi");
  const parts = sentence.split(re);
  return parts.map((part, i) =>
    part.toLowerCase() === word.toLowerCase() ? (
      <strong key={i} className="text-foreground">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function Vocabulary() {
  const { lang } = useUiLang();
  const t = (text: string) => (lang === "pt" ? (uiPt[text] ?? text) : text);
  const { data: profile } = useProfile();
  const loadDailyWords = useServerFn(dailyWords);
  const searchDictionary = useServerFn(lookupWord);
  const savePronunciation = useServerFn(persistPronunciationLegacy);
  const logTelemetry = useServerFn(logPracticeTelemetry);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  // One pronunciation check at a time; every attempt ends and frees the button.
  const pronunciationGate = useRef(createAttemptGate());
  const pronunciationAbort = useRef<AbortController | null>(null);
  const usingBrowserSpeech = useRef(false);
  // Reading time only counts while the student is actually working on the words.
  const minutesSpent = useTimeSpent({ manual: true });

  const { data: words, isLoading } = useQuery({
    queryKey: ["vocabulary"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vocabulary").select("*").order("word");
      if (error) throw error;
      return (data ?? []) as Word[];
    },
  });

  // Starting a new lesson unlocks a new set of ten words.
  const { data: startedLessons } = useLessonRound();

  const { data: mine } = useQuery({
    queryKey: ["user-vocabulary", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_vocabulary").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Starting a new lesson means a new set of ten words.
  const dailyKey = [
    "daily-words",
    profile?.id,
    profile?.level,
    studyToday(),
    startedLessons ?? 0,
  ] as const;
  const roundReady = !!profile && startedLessons !== undefined;

  // 1) Words already saved for this batch: a plain read, shown right away.
  const { data: saved, isLoading: savedLoading } = useQuery({
    queryKey: [...dailyKey, "saved"],
    enabled: roundReady,
    staleTime: 1000 * 60 * 30,
    retry: false,
    queryFn: async () =>
      (await loadDailyWords({
        data: { level: profile?.level ?? "intermediate", generate: false },
      })) as Word[],
  });

  // 2) Missing words are generated in the background. A failed attempt is
  // remembered for this batch so reopening or refreshing the page does not
  // start a new generation by itself; the student can retry on purpose.
  const failKey = profile ? vocabularyGenerationFailureKey(profile.id, startedLessons ?? 0) : null;
  const [genBlocked, setGenBlocked] = useState<boolean | null>(null);
  useEffect(() => {
    if (!failKey) return;
    setGenBlocked(vocabularyGenerationRecentlyFailed(window.localStorage.getItem(failKey)));
  }, [failKey]);
  const needsGeneration = roundReady && !!saved && saved.length < 10 && genBlocked === false;
  const {
    data: generated,
    isFetching: generating,
    error: genError,
  } = useQuery({
    queryKey: [...dailyKey, "generate"],
    enabled: needsGeneration,
    staleTime: 1000 * 60 * 30,
    retry: false,
    refetchOnMount: false,
    queryFn: async () => {
      try {
        return (await vocabularySingleFlight(profile?.id ?? "", () =>
          loadDailyWords({ data: { level: profile?.level ?? "intermediate" } }),
        )) as Word[];
      } catch (error) {
        if (failKey) window.localStorage.setItem(failKey, String(Date.now()));
        setGenBlocked(true);
        throw error;
      }
    },
  });
  function retryGeneration() {
    if (failKey) window.localStorage.removeItem(failKey);
    queryClient.removeQueries({ queryKey: [...dailyKey, "generate"] });
    setGenBlocked(false);
  }
  const daily = generated && generated.length >= (saved?.length ?? 0) ? generated : saved;
  const dailyLoading = savedLoading || !roundReady;
  const genFailed = genBlocked === true || !!genError;

  const byWord = new Map((mine ?? []).map((m) => [m.word_id, m]));

  // Opening this page is not doing the practice: the dashboard dot is driven by
  // real reviews (user_vocabulary), so nothing is marked here.

  async function invalidateVocabulary() {
    await queryClient.invalidateQueries({ queryKey: ["user-vocabulary"] });
    await queryClient.invalidateQueries({ queryKey: ["user-vocabulary-mastery"] });
    await queryClient.invalidateQueries({ queryKey: ["study-snapshot"] });
    await queryClient.invalidateQueries({ queryKey: ["vocabulary-progress"] });
    await queryClient.invalidateQueries({ queryKey: ["vocabulary-batch-progress"] });
  }

  /** "I know it" moves the word one step up the spaced review ladder. */
  async function markKnown(wordId: string) {
    if (!profile) return;
    const existing = byWord.get(wordId);
    // Not due yet: marking again must not skip steps of the ladder.
    if (!canAdvance(existing)) return;
    setBusy(wordId);
    minutesSpent.start();
    try {
      const next = advance(existing);
      const { error } = await supabase.from("user_vocabulary").upsert(
        {
          user_id: profile.id,
          word_id: wordId,
          mastery_level: next.mastery_level,
          next_review_at: next.next_review_at,
          is_difficult: false,
          times_reviewed: (existing?.times_reviewed ?? 0) + 1,
          last_reviewed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,word_id" },
      );
      if (error) throw error;
      await invalidateVocabulary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save this word");
    } finally {
      minutesSpent.stop();
      setBusy(null);
    }
  }

  /** A failed review sends the word back two steps and due again tomorrow. */
  async function markForgotten(wordId: string) {
    if (!profile) return;
    const existing = byWord.get(wordId);
    if (!existing || !isDue(existing)) return;
    setBusy(wordId);
    try {
      const next = fallBack(existing);
      const { error } = await supabase
        .from("user_vocabulary")
        .update({
          mastery_level: next.mastery_level,
          next_review_at: next.next_review_at,
          is_difficult: true,
        })
        .eq("user_id", profile.id)
        .eq("word_id", wordId);
      if (error) throw error;
      await invalidateVocabulary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save this word");
    } finally {
      setBusy(null);
    }
  }

  /** Brings today's words back to the Today tab so the student can practise them again. */
  async function redoTodayWords() {
    if (!profile) return;
    const ids = (daily ?? []).map((w) => w.id);
    if (!ids.length) return;
    setBusy("redo");
    try {
      const { error } = await supabase
        .from("user_vocabulary")
        .update({ mastery_level: 0, next_review_at: null })
        .eq("user_id", profile.id)
        .in("word_id", ids);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["user-vocabulary"] });
      await queryClient.invalidateQueries({ queryKey: ["user-vocabulary-mastery"] });
      await queryClient.invalidateQueries({ queryKey: ["vocabulary-batch-progress"] });

      toast.success(t("Today's words are back — practise them again."));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Could not reset today's words"));
    } finally {
      setBusy(null);
    }
  }

  async function speak(key: string, word: string) {
    setPlayingKey(key);
    minutesSpent.start();
    try {
      await speakEnglish(word, { cache: "persistent" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not play this pronunciation.");
    } finally {
      setPlayingKey(null);
      minutesSpent.stop();
    }
  }

  async function togglePronunciation(word: Word) {
    if (pronunciationGate.current.isBusy()) {
      toast(t("The check is already running."));
      return;
    }

    if (recordingId === word.id) {
      const attempt = pronunciationGate.current.begin();
      if (attempt === null) return;
      const controller = new AbortController();
      pronunciationAbort.current = controller;
      setRecordingId(null);
      setCheckingId(word.id);
      try {
        // Browser recognition is instant and normally avoids an AI call. The
        // local recording remains available as a safety net when mobile Chrome
        // ends recognition without returning a transcript.
        let spoken: string;
        if (usingBrowserSpeech.current) {
          const heard = await stopBrowserRecognition();
          if (!heard) throw new Error(t("I couldn't hear that clearly. Please try again."));
          spoken = heard;
        } else {
          spoken = await transcribeAudio(await stopVoiceRecording(), controller.signal);
        }
        const previewScore = Math.round(pronunciationScore(word.word, spoken) * 100);
        const authoritative = await savePronunciation({
          data: {
            operationKey: crypto.randomUUID(),
            wordId: word.id,
            transcript: spoken,
            minutes: minutesSpent(1),
          },
        });
        // A late answer from an older attempt must never change the screen.
        if (!pronunciationGate.current.isCurrent(attempt)) return;
        const score = authoritative.score;
        if (score !== previewScore)
          console.warn("Pronunciation preview differed from the authoritative result");
        if (score > 70) {
          toast.success(`Great pronunciation — ${score}% match.`);
          await markKnown(word.id);
        } else if (score >= 55) {
          toast(`Almost there — ${score}% match. I heard “${spoken}”.`);
        } else {
          toast.error(`I heard “${spoken}”. Listen again and try once more.`);
          // A clear miss on a due review counts as a failed review.
          await markForgotten(word.id);
        }
      } catch (error) {
        const cancelled = error instanceof Error && error.name === "AbortError";
        if (!cancelled && pronunciationGate.current.isCurrent(attempt))
          toast.error(
            error instanceof Error ? error.message : "Could not check that pronunciation.",
          );
      } finally {
        // Success, error, cancel: the attempt always ends and frees the button.
        if (pronunciationAbort.current === controller) pronunciationAbort.current = null;
        minutesSpent.stop();
        pronunciationGate.current.end(attempt);
        setCheckingId(null);
      }
      return;
    }

    // Another card was left recording: release it before starting a new one.
    if (recordingId) {
      cancelVoiceRecording();
      cancelBrowserRecognition();
    }

    try {
      stopSpeaking();
      // The full recording (the same path the Listening Lab uses) is the main
      // capture: built-in browser recognizers on Android Chrome and Samsung
      // Internet often return nothing for a single short word. Browsers that
      // cannot record fall back to their own recognizer. Exactly one capture
      // path is used, because mobile browsers cannot share the microphone.
      usingBrowserSpeech.current = false;
      try {
        await startVoiceRecording();
      } catch (recordError) {
        usingBrowserSpeech.current = startBrowserRecognition();
        if (!usingBrowserSpeech.current) throw recordError;
      }
      minutesSpent.start();
      setRecordingId(word.id);
    } catch (error) {
      setRecordingId(null);
      minutesSpent.stop();
      cancelVoiceRecording();
      cancelBrowserRecognition();
      toast.error(
        error instanceof Error
          ? error.message
          : "Microphone access is needed to test pronunciation.",
      );
    }
  }

  const all = words ?? [];
  // Learned = remembered across the 1, 3 and 7 day reviews (step 4 or above).
  const learned = all.filter((w) => (byWord.get(w.id)?.mastery_level ?? 0) >= LEARNED_MASTERY);

  // Dictionary search: answers come from context.reverso.net, not from the lessons.
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const q = term.trim();

  useEffect(() => {
    const id = setTimeout(() => setTerm(query), 450);
    return () => clearTimeout(id);
  }, [query]);

  // Time spent looking words up in the search field counts as reading practice,
  // but pauses one minute after the last keystroke.
  useEffect(() => {
    if (query.trim().length < 2) {
      minutesSpent.stop();
      return;
    }
    minutesSpent.start();
    const idle = setTimeout(() => minutesSpent.stop(), 60_000);
    return () => clearTimeout(idle);
  }, [query, minutesSpent]);

  // When leaving the page, store the practice minutes that were not logged yet.
  const profileRef = useRef(profile);
  profileRef.current = profile;
  useEffect(() => {
    const gate = pronunciationGate.current;
    const abortRef = pronunciationAbort;
    return () => {
      // Leaving the page cancels an open check and releases the microphone.
      abortRef.current?.abort();
      abortRef.current = null;
      gate.reset();
      cancelVoiceRecording();
      cancelBrowserRecognition();
      minutesSpent.stop();

      const minutes = minutesSpent(0);
      const p = profileRef.current;
      if (minutes >= 1 && p) {
        void logTelemetry({
          data: {
            operationKey: crypto.randomUUID(),
            activityType: "vocabulary_reading",
            minutes,
          },
        });
      }
    };
  }, [minutesSpent, logTelemetry]);

  const { data: entry, isFetching: searching } = useQuery({
    queryKey: ["dictionary-v2", q.toLowerCase()],
    queryFn: () => searchDictionary({ data: { term: q } }),
    enabled: q.length >= 2,
    staleTime: 1000 * 60 * 60,
  });

  // Ten new words each day, written by the AI from the lessons in the learning path.
  // A word counts as known for now once it has climbed a step and its next review
  // has not arrived yet; it stays in the list, dimmed with a badge.
  const knownNow = (id: string) => {
    const s = byWord.get(id);
    return (s?.mastery_level ?? 0) > 0 && !canAdvance(s);
  };
  const today = daily ?? [];
  const todayIds = new Set(today.map((w) => w.id));
  const todayKnownCount = today.filter((w) => knownNow(w.id)).length;
  const allTodayKnown = today.length > 0 && todayKnownCount === today.length;

  // Spaced reviews: earlier words whose review date has arrived come back here,
  // most overdue first. Words reviewed today stay visible (dimmed) until tomorrow.
  const localDay = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString("en-CA") : "";
  const todayKey = new Date().toLocaleDateString("en-CA");
  const reviewItems = all
    .filter((w) => !todayIds.has(w.id))
    .filter((w) => {
      const s = byWord.get(w.id);
      return isDue(s) || (s?.next_review_at && localDay(s.last_reviewed_at) === todayKey);
    })
    .sort((a, b) =>
      (byWord.get(a.id)?.next_review_at ?? "").localeCompare(
        byWord.get(b.id)?.next_review_at ?? "",
      ),
    )
    .slice(0, DAILY_REVIEW_LIMIT);

  function List({
    items,
    showActions = true,
    highlightKnown = false,
  }: {
    items: Word[];
    showActions?: boolean;
    highlightKnown?: boolean;
  }) {
    if (items.length === 0)
      return (
        <p className="mt-6 text-sm text-muted-foreground">Nothing here yet — keep practicing.</p>
      );
    return (
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {items.map((w) => {
          const isRecording = recordingId === w.id;
          const isChecking = checkingId === w.id;
          const state = byWord.get(w.id);
          const isKnown = highlightKnown && knownNow(w.id);
          const mastery = state?.mastery_level ?? 0;
          const isLearning = highlightKnown && !isKnown && mastery > 0 && mastery < LEARNED_MASTERY;
          return (
            <article key={w.id} className={`card-soft p-4 xl:p-3 ${isKnown ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 break-words">
                  <h3 className="text-lg font-semibold">{w.word}</h3>
                  <p className="text-sm text-muted-foreground">{w.translation}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isKnown && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">
                      <Check className="size-3" aria-hidden /> {t("Known")}
                    </span>
                  )}
                  {isLearning && (
                    <span className="rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning">
                      {t("Learning")}
                    </span>
                  )}
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                    {w.difficulty}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => speak(`daily-${w.id}`, w.word)}
                    aria-label="Listen"
                    className={
                      playingKey === `daily-${w.id}`
                        ? "bg-success text-success-foreground hover:bg-success/90"
                        : ""
                    }
                  >
                    <Volume2 className="size-4" />
                  </Button>
                </div>
              </div>
              <p className="mt-1.5 text-sm">{w.meaning}</p>
              <p className="mt-1 text-sm text-muted-foreground">{w.pronunciation}</p>
              <p className="mt-1.5 rounded-lg bg-secondary/70 px-3 py-1.5 text-xs italic line-clamp-2">
                "{w.example}"
              </p>
              {showActions && (
                <div className="mt-3 flex gap-2">
                  {!isKnown && (
                    <Button
                      size="sm"
                      className="min-h-11 flex-1"
                      disabled={busy === w.id || Boolean(recordingId) || Boolean(checkingId)}
                      onClick={() => markKnown(w.id)}
                      aria-label="I know this word"
                      title="I know this word"
                    >
                      <Check className="size-4" /> {t("I know it")}
                    </Button>
                  )}
                  {!isKnown && isDue(state) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11 flex-1"
                      disabled={busy === w.id || Boolean(recordingId) || Boolean(checkingId)}
                      onClick={() => markForgotten(w.id)}
                    >
                      <X className="size-4" /> {t("Not yet")}
                    </Button>
                  )}
                  <Button
                    className="min-h-11 flex-1"
                    variant={isRecording ? "destructive" : "outline"}
                    disabled={isChecking || Boolean(checkingId)}
                    onClick={() => togglePronunciation(w)}
                    aria-label={
                      isRecording ? "Stop and check pronunciation" : "Test your pronunciation"
                    }
                    title={isRecording ? "Stop and check pronunciation" : "Test your pronunciation"}
                  >
                    {isChecking ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : isRecording ? (
                      <Square className="size-4" />
                    ) : (
                      <Mic className="size-4" />
                    )}
                    {isRecording ? t("Stop") : t("Say it")}
                  </Button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <AppShell mobileOneScreen>
      <h1 className="text-2xl font-bold lg:text-3xl">Vocabulary Builder</h1>
      <p className="mt-1 text-sm text-muted-foreground lg:mt-2">
        Ten new words every time you start a new lesson, chosen from your learning path, with
        meaning, examples and a microphone to test your pronunciation.
      </p>
      {(daily?.length ?? 0) > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 -ml-2"
          disabled={busy === "redo"}
          onClick={redoTodayWords}
        >
          <RotateCcw className="mr-2 size-4" /> Redo today's words
        </Button>
      )}

      <label htmlFor="vocab-search" className="mt-3 block text-sm font-medium text-foreground">
        Search in English:
      </label>
      <div className="relative mt-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="vocab-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter text or word..."
          aria-label="Search vocabulary"
          className="h-9 w-full rounded-lg border border-border bg-card pl-10 pr-10 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-0 top-1/2 grid size-11 -translate-y-1/2 place-items-center text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {q.length >= 2 ? (
        <section aria-label="Search results" className="mt-6">
          {searching ? (
            <Skeleton className="h-40 w-full" />
          ) : !entry?.found ? (
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                No dictionary entry found for <span className="font-medium">“{q}”</span>.
              </p>
              <p>Check the spelling and try another English word.</p>
            </div>
          ) : (
            <article className="card-soft p-5">
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-bold">{entry.word}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => speak(`dict-${entry.word}`, entry.word)}
                  aria-label="Listen"
                  className={
                    playingKey === `dict-${entry.word}`
                      ? "bg-success text-success-foreground hover:bg-success/90"
                      : ""
                  }
                >
                  <Volume2 className="size-5" />
                </Button>
              </div>

              {(entry.ipaUs || entry.ipaUk) && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {entry.ipaUs && <span>US /{entry.ipaUs}/</span>}
                  {entry.ipaUs && entry.ipaUk && <span> · </span>}
                  {entry.ipaUk && <span>UK /{entry.ipaUk}/</span>}
                </p>
              )}

              {entry.meanings.length > 0 && (
                <ol className="mt-5 grid gap-4">
                  {entry.meanings.map((m, i) => (
                    <li key={i} className="border-b border-border pb-4 last:border-0">
                      <p className="text-sm">
                        <span className="text-muted-foreground">{i + 1}.</span>{" "}
                        {m.context && (
                          <span className="italic text-muted-foreground">({m.context})</span>
                        )}{" "}
                        {m.definition}
                      </p>

                      {m.translations.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {m.translations.map((t, j) => (
                            <span
                              key={j}
                              className="rounded-md bg-secondary px-2.5 py-1 text-sm font-medium text-secondary-foreground"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      {m.example && (
                        <div className="mt-3 text-sm">
                          <p className="italic text-foreground">
                            "{highlightWord(m.example.en, entry.word)}"
                          </p>
                          <p className="mt-1 text-muted-foreground">{m.example.pt}</p>
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}

              <a
                href={entry.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block text-xs text-muted-foreground underline"
              >
                Source: context.reverso.net
              </a>
            </article>
          )}
        </section>
      ) : isLoading ? (
        <div className="mt-7 space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <Tabs defaultValue="today" className="mt-4">
          <TabsList>
            <TabsTrigger value="today">
              <span>Today</span>
              <span> ({today.length})</span>
            </TabsTrigger>
            <TabsTrigger value="learned">
              <span>Learned</span>
              <span> ({learned.length})</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="today">
            {dailyLoading ? (
              <div className="mt-5 space-y-4">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : (
              <>
                {generating ? (
                  <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> {t("Preparing new words…")}
                  </p>
                ) : genFailed && (daily?.length ?? 0) < 10 ? (
                  <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span>
                      {genError instanceof Error && genError.message
                        ? genError.message
                        : t("No new words available right now. Please try again later.")}
                    </span>
                    <Button variant="outline" size="sm" onClick={retryGeneration}>
                      <RotateCcw className="size-4" /> {t("Try again")}
                    </Button>
                  </div>
                ) : null}
                {reviewItems.length > 0 && (
                  <section aria-label={t("Review due")} className="mt-4">
                    <h2 className="text-sm font-semibold">
                      {t("Review due")} ({reviewItems.filter((w) => !knownNow(w.id)).length})
                    </h2>
                    <List items={reviewItems} highlightKnown />
                  </section>
                )}
                {today.length > 0 ? (
                  <>
                    {allTodayKnown ? (
                      <p className="mt-4 flex items-center gap-2 text-sm font-medium text-success">
                        <Check className="size-4" aria-hidden />{" "}
                        {t("All words known today. Nice work!")}
                      </p>
                    ) : (
                      <div className="mt-4">
                        <p className="text-sm text-muted-foreground">
                          {t("{n} of {total} words known")
                            .replace("{n}", String(todayKnownCount))
                            .replace("{total}", String(today.length))}
                        </p>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-success transition-all"
                            style={{
                              width: `${Math.round((todayKnownCount / today.length) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                    <List items={today} highlightKnown />
                  </>
                ) : !generating && !genFailed ? (
                  <p className="mt-6 text-sm text-muted-foreground">
                    {t("No new words available right now. Please try again later.")}
                  </p>
                ) : null}
              </>
            )}
          </TabsContent>
          <TabsContent value="learned">
            <List items={learned} showActions={false} />
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}
