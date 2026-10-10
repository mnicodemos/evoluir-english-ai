import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, RotateCcw, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { OfflineVocabulary } from "@/components/vocabulary/OfflineVocabulary";
import {
  VocabularyWordList,
  type VocabularyListContext,
  type Word,
} from "@/components/vocabulary/VocabularyWordList";
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
  const loadDailyWords = useServerFn(dailyWords);
  const savePronunciation = useServerFn(persistPronunciationLegacy);
  const logTelemetry = useServerFn(logPracticeTelemetry);
  const reviewWord = useServerFn(reviewVocabularyWord);
  const resetWords = useServerFn(resetVocabularyWords);
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
    // Not due yet: marking again must not skip steps of the ladder.
    if (!canAdvance(byWord.get(wordId))) return;
    await saveReview(wordId, "known", { timed: true });
  }

  /** Passed pronunciation (>= 70%): the word goes straight to the Learned tab. */
  async function markPronouncedKnown(wordId: string) {
    await saveReview(wordId, "pronounced");
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
        const pt = lang === "pt";
        if (score >= 70) {
          toast.success(
            pt
              ? `Pronúncia OK — ${score}%. Próxima palavra!`
              : `Pronunciation OK — ${score}%. Next word!`,
          );
          await markPronouncedKnown(word.id);
        } else {
          // A low score is coaching, not a failure: amber "try again", not a red error.
          toast.warning(
            pt
              ? `${score}% — abaixo de 70%. Ouvi “${spoken}”. Repita a palavra.`
              : `${score}% — below 70%. I heard “${spoken}”. Please repeat the word.`,
            {
              // Which part of the word came out different, not only the percentage.
              description: <PronunciationHint target={word.word} spoken={spoken} pt={pt} />,
              duration: 8000,
            },
          );
          // A clear miss on a due review counts as a failed review.
          if (score < 55) await markForgotten(word.id);
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
  // Today's words are merged in so a word learned today shows up even if the
  // full word list was cut off by the row limit.
  const learnedPool = new Map(all.map((w) => [w.id, w]));
  for (const w of daily ?? []) learnedPool.set(w.id, w);
  const learned = [...learnedPool.values()].filter(
    (w) => (byWord.get(w.id)?.mastery_level ?? 0) >= LEARNED_MASTERY,
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
  // Learned words (e.g. passed pronunciation) move out of Today into the Learned tab.
  const todayOpen = today.filter((w) => (byWord.get(w.id)?.mastery_level ?? 0) < LEARNED_MASTERY);

  // Spaced reviews: earlier words whose review date has arrived come back here,
  // most overdue first. Words reviewed today stay visible (dimmed) until tomorrow.
  const localDay = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString("en-CA") : "";
  const todayKey = new Date().toLocaleDateString("en-CA");
  const reviewItems = all
    .filter((w) => !todayIds.has(w.id))
    .filter((w) => {
      const s = byWord.get(w.id);
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
            <TabsTrigger value="today">
              <span>Today</span>
              <span> ({todayOpen.length})</span>
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
                    <VocabularyWordList items={reviewItems} highlightKnown {...listProps} />
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
                    {todayOpen.length > 0 && (
                      <VocabularyWordList items={todayOpen} highlightKnown {...listProps} />
                    )}
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
            <VocabularyWordList items={learned} showActions={false} {...listProps} />
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}
