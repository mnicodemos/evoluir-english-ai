import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Languages,
  Layers,
  Loader2,
  Play,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast, type ExternalToast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { PronunciationResultToast } from "@/components/vocabulary/PronunciationResultToast";
import { haptic } from "@/lib/haptics";
import { StudyDayCounter } from "@/components/StudyDayCounter";
import { AppShell } from "@/components/AppShell";
import { OfflineVocabulary } from "@/components/vocabulary/OfflineVocabulary";
import {
  VocabularySession,
  VocabularyWordList,
  type VocabularyListContext,
  type Word,
} from "@/components/vocabulary/VocabularyWordList";
import { ClockHands, DoneSeal } from "@/components/DoneSeal";
import { Button } from "@/components/ui/button";

import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFlashcardsDue } from "@/hooks/useFlashcardsDue";
import { useLessonRound } from "@/hooks/useLessonRound";
import { useProfile } from "@/hooks/useProfile";
import { useTimeSpent } from "@/hooks/useTimeSpent";
import { supabase } from "@/integrations/supabase/client";
import { createAttemptGate } from "@/lib/attemptGate";
import { createPronunciationToaster } from "@/lib/pronunciationToast";
import {
  vocabularyGenerationFailureKey,
  vocabularyGenerationRecentlyFailed,
} from "@/lib/activityIndicators";

import { speakEnglish, stopSpeaking } from "@/lib/speech";
import { studyToday } from "@/lib/today";
import { pronunciationScore, transcribeAudio } from "@/lib/transcribe";
import { PronunciationHint } from "@/components/vocabulary/PronunciationHint";
import { DictionaryResult } from "@/components/vocabulary/DictionaryResult";
import { useDictionarySearch } from "@/hooks/useDictionarySearch";
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
import { dailyWords } from "@/lib/vocabularyPlan.functions";
import { resetVocabularyWords, reviewVocabularyWord } from "@/lib/vocabularyReview.functions";
import { vocabularySingleFlight } from "@/lib/vocabularySingleFlight";
import { useUiLang } from "@/lib/uiLang";
import { uiPt } from "@/lib/uiDictionary";
import { logPracticeTelemetry, persistPronunciationLegacy } from "@/lib/legacyActivity.functions";
import { DAILY_REVIEW_LIMIT, LEARNED_MASTERY, canAdvance, isDue } from "@/lib/vocabularyReview";
import { readStorage, removeStorage, writeStorage } from "@/lib/safeStorage";
import { loadOfflineVocabulary, saveOfflineVocabulary } from "@/lib/offlineVocabulary";
import { useOnline } from "@/hooks/useOnline";
import { STUDY_DAY_RULE } from "@/lib/studyDay";
import { cn } from "@/lib/utils";
import { studyDayStartIso } from "@/lib/today";
import { announceStudyInteraction } from "@/lib/focusStudyOffer";

const LEARNED_SOURCE_LABEL = {
  all: "All",
  lessons: "From lessons",
  reading: "From reading",
} as const;

export const Route = createFileRoute("/_authenticated/vocabulary")({
  head: () => ({
    meta: [
      { title: "Vocabulary builder - Evoluir+ English AI" },
      {
        name: "description",
        content: "Learn new English words every day and test your pronunciation out loud.",
      },
      { property: "og:title", content: "Vocabulary builder - Evoluir+ English AI" },
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

/** Without a connection, the words saved on this device are shown read-only. */
function Vocabulary() {
  const { user } = Route.useRouteContext();
  const online = useOnline();
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const saved = useMemo(
    () => (online ? null : loadOfflineVocabulary(window.localStorage, user.id)),
    [online, user.id],
  );
  if (saved) return <OfflineVocabulary saved={saved} t={t} />;
  return <VocabularyOnline />;
}

function VocabularyOnline() {
  const { lang } = useUiLang();
  const t = (text: string) => (lang === "pt" ? (uiPt[text] ?? text) : text);
  const { data: profile } = useProfile();
  // The lessons' flashcards due: the second part of the one word review
  // (owner request, 2026-10-30), right under the words.
  const { data: cardsDue = 0 } = useFlashcardsDue(profile?.id);
  const loadDailyWords = useServerFn(dailyWords);
  const savePronunciation = useServerFn(persistPronunciationLegacy);
  const logTelemetry = useServerFn(logPracticeTelemetry);
  const reviewWord = useServerFn(reviewVocabularyWord);
  const resetWords = useServerFn(resetVocabularyWords);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  // Review session: the words frozen when it starts (null while the lists show).
  const [session, setSession] = useState<Word[] | null>(null);
  const [learnedQuery, setLearnedQuery] = useState("");
  const [learnedSource, setLearnedSource] = useState<"all" | "lessons" | "reading">("all");
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  // A passed local pronunciation is reflected immediately while the server writes it.
  const [optimisticPronounced, setOptimisticPronounced] = useState<Set<string>>(() => new Set());
  // One pronunciation check at a time; every attempt ends and frees the button.
  const pronunciationGate = useRef(createAttemptGate());
  const pronunciationAbort = useRef<AbortController | null>(null);
  const usingBrowserSpeech = useRef(false);
  // Time on the words, paused after a minute without a touch (minutes audit,
  // 2026-10-24: the manual clock only ran while recording or playing, so
  // reviewing words never added minutes). It counts once a word was reviewed
  // or pronounced on this visit.
  const minutesSpent = useTimeSpent();
  const workedOnWords = useRef(false);

  const { data: words, isLoading } = useQuery({
    queryKey: ["vocabulary"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vocabulary").select("*").order("word");
      if (error) throw error;
      return (data ?? []) as Word[];
    },
  });

  // Each COMPLETED lesson unlocks a new set of ten words (same count the
  // server uses for the batch key, lessonBatchKey).
  const { data: completedLessons } = useLessonRound();

  const { data: mine } = useQuery({
    queryKey: ["user-vocabulary", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_vocabulary")
        .select("*")
        .eq("user_id", profile!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  // A newly completed lesson means a new set of ten words.
  const dailyKey = [
    "daily-words",
    profile?.id,
    profile?.level,
    studyToday(),
    completedLessons ?? 0,
  ] as const;
  const roundReady = !!profile && completedLessons !== undefined;

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
  const failKey = profile
    ? vocabularyGenerationFailureKey(profile.id, completedLessons ?? 0)
    : null;
  const [genBlocked, setGenBlocked] = useState<boolean | null>(null);
  useEffect(() => {
    if (!failKey) return;
    setGenBlocked(vocabularyGenerationRecentlyFailed(readStorage(failKey)));
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
        if (failKey) writeStorage(failKey, String(Date.now()));
        setGenBlocked(true);
        throw error;
      }
    },
  });
  function retryGeneration() {
    if (failKey) removeStorage(failKey);
    queryClient.removeQueries({ queryKey: [...dailyKey, "generate"] });
    setGenBlocked(false);
  }
  const daily = generated && generated.length >= (saved?.length ?? 0) ? generated : saved;
  const dailyLoading = savedLoading || !roundReady;
  const genFailed = genBlocked === true || !!genError;

  const byWord = new Map((mine ?? []).map((m) => [m.word_id, m]));
  // Words reviewed today (São Paulo day), the same count the study day uses:
  // 10 complete it (user request: show how many are left).
  const dayStart = new Date(studyDayStartIso()).getTime();
  const reviewedToday = (mine ?? []).filter(
    (m) => m.last_reviewed_at && new Date(m.last_reviewed_at).getTime() >= dayStart,
  ).length;
  const reviewGoal = STUDY_DAY_RULE.reviewedWords;

  // Opening this page is not doing the practice: the dashboard dot is driven by
  // real reviews (user_vocabulary), so nothing is marked here.

  async function invalidateVocabulary() {
    await queryClient.invalidateQueries({ queryKey: ["user-vocabulary"] });
    await queryClient.invalidateQueries({ queryKey: ["user-vocabulary-mastery"] });
    await queryClient.invalidateQueries({ queryKey: ["study-snapshot"] });
    await queryClient.invalidateQueries({ queryKey: ["vocabulary-progress"] });
    await queryClient.invalidateQueries({ queryKey: ["vocabulary-batch-progress"] });
  }

  /**
   * Saves a review through the server, which applies the spaced review ladder
   * (the browser no longer writes user_vocabulary; security audit item 3).
   */
  async function saveReview(
    wordId: string,
    action: "known" | "forgotten" | "pronounced",
    { timed = false }: { timed?: boolean } = {},
  ) {
    if (!profile) return;
    setBusy(wordId);
    if (timed) minutesSpent.start();
    try {
      await reviewWord({ data: { wordId, action } });
      workedOnWords.current = true;
      await invalidateVocabulary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save this word");
    } finally {
      if (timed) minutesSpent.stop();
      setBusy(null);
    }
  }

  /** "I know it" moves the word one step up the spaced review ladder. */
  async function markKnown(wordId: string) {
    // Acting on the word clears any notification on screen at once
    // (owner request, 2026-11-02): a stale pronunciation result must not
    // linger above the card while the student rates the next one.
    pronunciationToasts.current.dismissAll();
    // Not due yet: marking again must not skip steps of the ladder.
    if (!canAdvance(byWord.get(wordId))) return;
    await saveReview(wordId, "known", { timed: true });
  }

  /** A failed review sends the word back two steps and due again tomorrow. */
  async function markForgotten(wordId: string) {
    const existing = byWord.get(wordId);
    if (!existing || !isDue(existing)) return;
    await saveReview(wordId, "forgotten");
  }

  /** Brings today's words back to the Today tab so the student can practise them again. */
  async function redoTodayWords() {
    if (!profile) return;
    const ids = (daily ?? []).map((w) => w.id);
    if (!ids.length) return;
    setBusy("redo");
    try {
      await resetWords({ data: { wordIds: ids } });
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
    // Tapping the speaker clears any pronunciation notice at once.
    pronunciationToasts.current.dismiss();
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

  // Pronunciation toasts are restricted to this page: they stop being shown
  // the moment the student leaves, so a late async answer never pops up on
  // another screen. Re-entering the page re-enables them (see the effect).
  const pronunciationToasts = useRef(createPronunciationToaster());
  useEffect(() => {
    const toasts = pronunciationToasts.current;
    toasts.setActive(true);
    return () => {
      toasts.setActive(false);
      toasts.dismiss();
    };
  }, []);

  function toastPronunciation(
    kind: "info" | "success" | "warning" | "error",
    message: string,
    options?: ExternalToast,
  ) {
    pronunciationToasts.current.notify(kind, message, options);
  }

  /** Records or checks a word; resolves true when the pronunciation passed
   *  (>= 70%), so the review session moves on to the next word. */
  async function togglePronunciation(word: Word): Promise<boolean> {
    // Tapping the microphone clears any pronunciation notice at once.
    pronunciationToasts.current.dismiss();
    if (pronunciationGate.current.isBusy()) {
      toastPronunciation("info", t("The check is already running."));
      return false;
    }

    if (recordingId === word.id) {
      const attempt = pronunciationGate.current.begin();
      if (attempt === null) return false;
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
        workedOnWords.current = true;
        const operationKey = crypto.randomUUID();
        const minutes = minutesSpent(0);
        // The local scorer uses the same deterministic rubric as the server. Show
        // its result now; persistence and the authoritative review run independently.
        if (!pronunciationGate.current.isCurrent(attempt)) return false;
        const pt = lang === "pt";
        if (previewScore >= 70) {
          setOptimisticPronounced((current) => new Set(current).add(word.id));
          haptic("success");
          pronunciationToasts.current.custom(
            (id) => (
              <PronunciationResultToast
                toastId={id}
                score={previewScore}
                word={word.word}
                pt={pt}
              />
            ),
            { duration: 3500 },
          );
        } else {
          // A low score is coaching, not a failure: amber "try again", not a red error.
          haptic("tap");
          pronunciationToasts.current.custom(
            (id) => (
              <PronunciationResultToast
                toastId={id}
                score={previewScore}
                word={word.word}
                heard={spoken}
                pt={pt}
                hint={<PronunciationHint target={word.word} spoken={spoken} pt={pt} />}
              />
            ),
            { duration: 8000 },
          );
        }

        // Do not hold the microphone state, button, or review-session queue open
        // for database round trips. The server remains authoritative for both writes.
        void (async () => {
          try {
            const authoritative = await savePronunciation({
              data: { operationKey, wordId: word.id, transcript: spoken, minutes },
            });
            if (authoritative.score >= 70) {
              await reviewWord({ data: { wordId: word.id, action: "pronounced" } });
            } else if (authoritative.score < 55) {
              await reviewWord({ data: { wordId: word.id, action: "forgotten" } });
            }
            await invalidateVocabulary();
          } catch {
            // A transient failure must not interrupt practice. Re-read the server
            // state so an optimistic Learned placement is not treated as persisted.
            await invalidateVocabulary().catch(() => undefined);
          } finally {
            setOptimisticPronounced((current) => {
              if (!current.has(word.id)) return current;
              const next = new Set(current);
              next.delete(word.id);
              return next;
            });
          }
        })();
        return previewScore >= 70;
      } catch (error) {
        const cancelled = error instanceof Error && error.name === "AbortError";
        if (!cancelled && pronunciationGate.current.isCurrent(attempt))
          toastPronunciation(
            "error",
            error instanceof Error ? error.message : "Could not check that pronunciation.",
          );
      } finally {
        // Success, error, cancel: the attempt always ends and frees the button.
        if (pronunciationAbort.current === controller) pronunciationAbort.current = null;
        minutesSpent.stop();
        pronunciationGate.current.end(attempt);
        setCheckingId(null);
      }
      return false;
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
      toastPronunciation(
        "error",
        error instanceof Error
          ? error.message
          : "Microphone access is needed to test pronunciation.",
      );
    }
    return false;
  }

  const all = words ?? [];
  // Learned = remembered across the 1, 3 and 7 day reviews (step 4 or above).
  // Today's words are merged in so a word learned today shows up even if the
  // full word list was cut off by the row limit.
  const learnedPool = new Map(all.map((w) => [w.id, w]));
  for (const w of daily ?? []) learnedPool.set(w.id, w);
  const learned = [...learnedPool.values()].filter(
    (w) =>
      optimisticPronounced.has(w.id) ||
      (byWord.get(w.id)?.mastery_level ?? 0) >= LEARNED_MASTERY,
  );

  // Dictionary search: answers come from context.reverso.net, not from the lessons.
  const { query, setQuery, q, entry, searching } = useDictionarySearch(minutesSpent);

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
      if (minutes >= 1 && p && workedOnWords.current) {
        void logTelemetry({
          data: {
            operationKey: crypto.randomUUID(),
            activityType: "vocabulary_reading",
            minutes,
          },
        })
          // Refresh today's minutes once the write lands (see useLogTimeOnExit).
          .then(() => queryClient.invalidateQueries({ queryKey: ["minutes-today"] }))
          .catch(() => undefined);
      }
    };
  }, [minutesSpent, logTelemetry, queryClient]);

  // Ten new words each day, written by the AI from the lessons in the learning path.
  // A word counts as known for now once it has climbed a step and its next review
  // has not arrived yet; it stays in the list, dimmed with a badge.
  const knownNow = (id: string) => {
    if (optimisticPronounced.has(id)) return true;
    const s = byWord.get(id);
    return (s?.mastery_level ?? 0) > 0 && !canAdvance(s);
  };
  const today = daily ?? [];
  const todayIds = new Set(today.map((w) => w.id));
  const todayKnownCount = today.filter((w) => knownNow(w.id)).length;
  const allTodayKnown = today.length > 0 && todayKnownCount === today.length;
  // Learned words (e.g. passed pronunciation) move out of Today into the Learned tab.
  const todayOpen = today.filter(
    (w) =>
      !optimisticPronounced.has(w.id) &&
      (byWord.get(w.id)?.mastery_level ?? 0) < LEARNED_MASTERY,
  );
  const todayToDo = todayOpen.filter((w) => !knownNow(w.id));

  // Spaced reviews: earlier words whose review date has arrived come back here,
  // most overdue first. Words reviewed today stay visible (dimmed) until tomorrow.
  const localDay = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString("en-CA") : "";
  const todayKey = new Date().toLocaleDateString("en-CA");
  const reviewItems = all
    .filter((w) => !todayIds.has(w.id))
    .filter((w) => {
      const s = byWord.get(w.id);
      // Optimistically passed words leave Review immediately, even if they were due.
      if (optimisticPronounced.has(w.id)) return false;
      if (isDue(s)) return true;
      // Words that reached Learned leave Today and live in the Learned tab.
      if ((s?.mastery_level ?? 0) >= LEARNED_MASTERY) return false;
      return Boolean(s?.next_review_at && localDay(s.last_reviewed_at) === todayKey);
    })
    .sort((a, b) =>
      (byWord.get(a.id)?.next_review_at ?? "").localeCompare(
        byWord.get(b.id)?.next_review_at ?? "",
      ),
    )
    .slice(0, DAILY_REVIEW_LIMIT);
  // Lists with only what is still to do; words rated today fold into "Done today".
  const reviewOpen = reviewItems.filter((w) => !knownNow(w.id));
  const doneToday = [...reviewItems, ...todayOpen].filter((w) => knownNow(w.id));
  // The session's queue: due reviews first, then today's new words.
  const sessionQueue = [...reviewOpen, ...todayToDo];
  // Learned tab: search, source filter, and the words coming back soonest first.
  const learnedNeedle = learnedQuery.trim().toLowerCase();
  const learnedShown = learned
    .filter((w) =>
      learnedSource === "all" ? true : (w.category === "reading") === (learnedSource === "reading"),
    )
    .filter(
      (w) =>
        !learnedNeedle ||
        w.word.toLowerCase().includes(learnedNeedle) ||
        w.translation.toLowerCase().includes(learnedNeedle),
    )
    .sort((a, b) =>
      (byWord.get(a.id)?.next_review_at ?? "9").localeCompare(
        byWord.get(b.id)?.next_review_at ?? "9",
      ),
    );

  // Keep what is on screen (today's words, then due reviews) for offline use.
  const offlineWords = [...today, ...reviewItems];
  const offlineSignature = offlineWords.map((w) => w.id).join(",");
  useEffect(() => {
    if (!profile?.id || !offlineSignature) return;
    try {
      saveOfflineVocabulary(window.localStorage, profile.id, offlineWords);
    } catch {
      // storage unavailable: offline words are a convenience
    }
    // offlineWords is rebuilt every render; its ids decide when to save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, offlineSignature]);

  // Shared state and actions for the three word lists (review, today, learned).
  const listProps: VocabularyListContext = {
    t,
    byWord,
    knownNow,
    busy,
    recordingId,
    checkingId,
    playingKey,
    onSpeak: speak,
    onMarkKnown: markKnown,
    onMarkForgotten: markForgotten,
    onTogglePronunciation: togglePronunciation,
  };

  return (
    <AppShell mobileOneScreen>
      <div className="vocabulary-page min-w-0 w-full overflow-x-clip">
        <PageHeader
          guide="vocabulary"
          actionsClassName="max-sm:basis-full"
          icon={BookOpen}
          accent="vocabulary"
          title={<>Vocabulary Builder</>}
          description={<>Remember, check and say your words: ten new ones with every new lesson.</>}
          actions={
            // The built-in translator, compact (owner request, 2026-11-02: a lookup
            // tool, not the page's task, so it left the big card above the words).
            <div className="relative w-full sm:w-72" title={t("Built-in English translator")}>
              <Languages
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[oklch(0.62_0.18_300)]"
                aria-hidden="true"
              />
              <input
                id="vocab-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Translate an English word...")}
                aria-label={t("Built-in English translator")}
                className="h-10 w-full rounded-full border border-white/15 bg-white/[0.04] pl-9 pr-9 text-sm outline-none transition focus:border-[oklch(0.62_0.18_300)] focus:ring-2 focus:ring-[oklch(0.62_0.18_300)]/30"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={t("Clear search")}
                  className="absolute right-0 top-1/2 grid size-10 -translate-y-1/2 place-items-center text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          }
        />
        <StudyDayCounter
          label={t("Words reviewed today")}
          value={reviewedToday}
          goal={reviewGoal}
          doneText={t("Study day counted")}
          hint={t("10 reviewed words complete your study day.")}
          action={
            (daily?.length ?? 0) > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2 text-[11px]"
                disabled={busy === "redo"}
                onClick={redoTodayWords}
              >
                <RotateCcw className="mr-1.5 size-3.5" /> Redo words
              </Button>
            ) : undefined
          }
        />

        {q.length >= 2 ? (
          <DictionaryResult
            q={q}
            searching={searching}
            entry={entry}
            playing={entry?.found ? playingKey === `dict-${entry.word}` : false}
            onSpeak={(word) => void speak(`dict-${word}`, word)}
          />
        ) : isLoading ? (
          <div className="mt-7 space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <Tabs defaultValue="today" className="mt-4">
            <TabsList>
              {/* A real gap: the triggers are flex boxes, which drop a leading space
                  ("Today(7)", user report). */}
              <TabsTrigger value="today" className="gap-1">
                <span>Today</span>
                <span>({todayOpen.length})</span>
              </TabsTrigger>
              {/* A real gap: the triggers are flex boxes, which drop a leading space
                  ("Today(7)", user report). */}
              <TabsTrigger value="learned" className="gap-1">
                <span>Learned</span>
                <span>({learned.length})</span>
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
                  {session ? (
                    <VocabularySession
                      queue={session}
                      cardsDue={cardsDue}
                      onClose={() => setSession(null)}
                      {...listProps}
                    />
                  ) : (
                    <>
                      {sessionQueue.length > 0 ? (
                        <section className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[oklch(0.62_0.18_300)]/35 bg-[oklch(0.62_0.18_300)]/[0.07] p-4">
                          <div className="min-w-0 flex-1">
                            <h2 className="font-display text-base font-semibold">
                              <span>{sessionQueue.length}</span>{" "}
                              <span>
                                {sessionQueue.length === 1
                                  ? t("word to remember now")
                                  : t("words to remember now")}
                              </span>
                            </h2>
                            <p className="text-xs text-muted-foreground">
                              {t(
                                "One word at a time: remember it, check the meaning, then rate it.",
                              )}
                            </p>
                          </div>
                          <Button
                            className="min-h-11 shrink-0"
                            onClick={() => {
                              announceStudyInteraction(
                                document.querySelector("main"),
                                "vocabulary",
                              );
                              setSession(sessionQueue);
                            }}
                          >
                            <Play className="size-4" /> {t("Start review")}
                          </Button>
                        </section>
                      ) : today.length > 0 && allTodayKnown ? (
                        <p className="mt-4 flex items-center gap-2 text-sm font-medium text-success">
                          <Check className="size-4" aria-hidden />{" "}
                          {t("All words known today. Nice work!")}
                        </p>
                      ) : null}
                      {cardsDue > 0 && (
                        <section
                          aria-label={t("Lesson cards to review")}
                          className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                        >
                          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[oklch(0.62_0.18_300)]/15 text-[oklch(0.62_0.18_300)]">
                            <Layers className="size-5" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <h2 className="font-display text-sm font-semibold">
                              <span>{t("Lesson cards to review")}</span> <span>({cardsDue})</span>
                            </h2>
                            <p className="text-xs text-muted-foreground">
                              {t(
                                "Your lessons' words as flashcards: part of the same word review.",
                              )}
                            </p>
                          </div>
                          <Button asChild size="sm" variant="outline" className="shrink-0">
                            <Link to="/learning/review">{t("Review cards")}</Link>
                          </Button>
                        </section>
                      )}
                      {reviewOpen.length > 0 && (
                        <section aria-label={t("Review due")} className="mt-5">
                          <h2 className="font-display text-sm font-semibold">
                            <span>{t("Review due")}</span> <span>({reviewOpen.length})</span>
                          </h2>
                          <VocabularyWordList items={reviewOpen} highlightKnown {...listProps} />
                        </section>
                      )}
                      {todayToDo.length > 0 && (
                        <section aria-label={t("New words")} className="mt-5">
                          <h2 className="font-display text-sm font-semibold">
                            <span>{t("New words")}</span> <span>({todayToDo.length})</span>
                          </h2>
                          <VocabularyWordList items={todayToDo} highlightKnown {...listProps} />
                        </section>
                      )}
                      {doneToday.length > 0 && (
                        // Words already rated today fold away (owner request,
                        // 2026-11-02: dimmed cards in the list read as noise).
                        <details className="group mt-5">
                          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
                            <ChevronRight
                              className="size-4 transition-transform group-open:rotate-90"
                              aria-hidden
                            />
                            <span>{t("Done today")}</span> <span>({doneToday.length})</span>
                          </summary>
                          <VocabularyWordList items={doneToday} highlightKnown {...listProps} />
                        </details>
                      )}
                      {today.length === 0 && !generating && !genFailed && (
                        <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 p-6 text-center">
                          <DoneSeal icon={ClockHands} />
                          <p className="text-sm text-muted-foreground">
                            {t("New words arrive with your next lesson.")}
                          </p>
                          <Button asChild size="sm" variant="outline">
                            <Link to="/learning">{t("Open your next lesson")}</Link>
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </TabsContent>
            <TabsContent value="learned">
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <div className="relative min-w-0 flex-1 sm:max-w-xs">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={learnedQuery}
                    onChange={(e) => setLearnedQuery(e.target.value)}
                    placeholder={t("Search your words...")}
                    aria-label={t("Search your words...")}
                    className="h-10 w-full rounded-full border border-white/15 bg-white/[0.04] pl-9 pr-3 text-sm outline-none focus:border-[oklch(0.62_0.18_300)]"
                  />
                </div>
                {(["all", "lessons", "reading"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setLearnedSource(key)}
                    className={cn(
                      "h-9 rounded-full border px-3 text-xs font-medium transition-colors",
                      learnedSource === key
                        ? "border-[oklch(0.62_0.18_300)]/60 bg-[oklch(0.62_0.18_300)]/15 text-foreground"
                        : "border-white/10 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t(LEARNED_SOURCE_LABEL[key])}
                  </button>
                ))}
              </div>
              <VocabularyWordList items={learnedShown} showActions={false} {...listProps} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}
