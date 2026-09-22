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
import { markVocabularyBatchSeen, vocabularySignature } from "@/lib/activityIndicators";
import { createAttemptGate } from "@/lib/attemptGate";

import { speakEnglish, stopSpeaking } from "@/lib/speech";
import { studyToday } from "@/lib/today";
import { pronunciationScore, transcribeAudio } from "@/lib/transcribe";
import {
  cancelVoiceRecording,
  startVoiceRecording,
  stopVoiceRecording,
} from "@/lib/voice-recorder";
import { lookupWord } from "@/lib/dictionary.functions";
import { dailyWords } from "@/lib/vocabularyPlan.functions";
import { useUiLang } from "@/lib/uiLang";
import { uiPt } from "@/lib/uiDictionary";
import { logPracticeTelemetry, persistPronunciationLegacy } from "@/lib/legacyActivity.functions";

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

  const {
    data: daily,
    isLoading: dailyLoading,
    error: dailyError,
  } = useQuery({
    // Starting a new lesson means a new set of ten words.
    queryKey: ["daily-words", profile?.id, studyToday(), startedLessons ?? 0],
    enabled: !!profile,
    staleTime: 1000 * 60 * 30,
    retry: false,
    queryFn: async () =>
      (await loadDailyWords({ data: { level: profile?.level ?? "intermediate" } })) as Word[],
  });

  const byWord = new Map((mine ?? []).map((m) => [m.word_id, m]));

  // Opening this page consumes the batch, so the dashboard dot goes away.
  useEffect(() => {
    if (!profile) return;
    markVocabularyBatchSeen(vocabularySignature(studyToday(), startedLessons ?? 0));
  }, [profile, startedLessons]);

  async function markKnown(wordId: string) {
    if (!profile) return;
    setBusy(wordId);
    minutesSpent.start();
    try {
      const existing = byWord.get(wordId);
      const { error } = await supabase.from("user_vocabulary").upsert(
        {
          user_id: profile.id,
          word_id: wordId,
          mastery_level: 100,
          is_difficult: false,
          times_reviewed: (existing?.times_reviewed ?? 0) + 1,
          last_reviewed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,word_id" },
      );
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["user-vocabulary"] });
      await queryClient.invalidateQueries({ queryKey: ["study-snapshot"] });
      await queryClient.invalidateQueries({ queryKey: ["vocabulary-progress"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save this word");
    } finally {
      minutesSpent.stop();
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
        .update({ mastery_level: 0 })
        .eq("user_id", profile.id)
        .in("word_id", ids);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["user-vocabulary"] });
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
        const audio = await stopVoiceRecording();
        const spoken = await transcribeAudio(audio, controller.signal);
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
        if (score >= 80) toast.success(`Great pronunciation — ${score}% match.`);
        else if (score >= 55) toast(`Almost there — ${score}% match. I heard “${spoken}”.`);
        else toast.error(`I heard “${spoken}”. Listen again and try once more.`);
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
    if (recordingId) cancelVoiceRecording();

    try {
      stopSpeaking();
      await startVoiceRecording();
      minutesSpent.start();
      setRecordingId(word.id);
    } catch (error) {
      setRecordingId(null);
      minutesSpent.stop();
      cancelVoiceRecording();
      toast.error(
        error instanceof Error
          ? error.message
          : "Microphone access is needed to test pronunciation.",
      );
    }
  }


  const all = words ?? [];
  const learned = all.filter((w) => (byWord.get(w.id)?.mastery_level ?? 0) >= 75);

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
    return () => {
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
  const today = (daily ?? []).filter((w) => (byWord.get(w.id)?.mastery_level ?? 0) < 75);

  function List({ items, showActions = true }: { items: Word[]; showActions?: boolean }) {
    if (items.length === 0)
      return (
        <p className="mt-6 text-sm text-muted-foreground">Nothing here yet — keep practicing.</p>
      );
    return (
      <div className="mt-5 grid gap-4">
        {items.map((w) => {
          const isRecording = recordingId === w.id;
          const isChecking = checkingId === w.id;
          return (
            <article key={w.id} className="card-soft p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 break-words">
                  <h3 className="text-lg font-semibold">{w.word}</h3>
                  <p className="text-sm text-muted-foreground">{w.translation}</p>
                </div>
                <div className="flex items-center gap-2">
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
              <p className="mt-3 text-sm">{w.meaning}</p>
              <p className="mt-1 text-sm text-muted-foreground">{w.pronunciation}</p>
              <p className="mt-3 rounded-lg bg-secondary/70 px-3 py-2 text-sm italic">
                "{w.example}"
              </p>
              {showActions && (
                <div className="mt-4 flex gap-2">
                  <Button
                    size="icon"
                    disabled={busy === w.id}
                    onClick={() => markKnown(w.id)}
                    aria-label="I know this word"
                    title="I know this word"
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    size="icon"
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
    <AppShell>
      <h1 className="text-3xl font-bold">Vocabulary Builder</h1>
      <p className="mt-2 text-muted-foreground">
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

      <label htmlFor="vocab-search" className="mt-6 block text-sm font-medium text-foreground">
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
          className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-10 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
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
        <Tabs defaultValue="today" className="mt-7">
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
            ) : dailyError ? (
              <p className="mt-6 text-sm text-muted-foreground">
                {dailyError instanceof Error
                  ? dailyError.message
                  : "Today's words are not ready yet."}
              </p>
            ) : (
              <List items={today} />
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
