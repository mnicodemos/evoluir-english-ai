import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpenText,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Languages,
  Loader2,
  Square,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { CopyButton, EmailButton, WhatsAppButton } from "@/components/ShareActions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/useProfile";
import { useLogTimeOnExit, useTimeSpent } from "@/hooks/useTimeSpent";
import {
  gradeReading,
  lookupTerm,
  READING_CATEGORIES,
  READING_CATEGORY_LABELS,
  READING_STYLE_LABELS,
  READING_STYLES,
  readingChoiceKey,
  readingParagraphs,
  readingReference,
  readingShareText,
  readingSpeechChunks,
  readingTokens,
  type ReadingChoice,
} from "@/lib/dailyReading";
import {
  completeDailyReading,
  loadDailyReading,
  type DailyReading,
} from "@/lib/dailyReading.functions";
import { lookupWord } from "@/lib/dictionary.functions";
import { prepareSpeech, speakEnglish, stopSpeaking } from "@/lib/speech";
import { studyToday } from "@/lib/today";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reading")({
  head: () => ({
    meta: [
      { title: "Daily reading - Evoluir+ English AI" },
      {
        name: "description",
        content: "A short text at your level every day, with audio, key words and questions.",
      },
    ],
  }),
  component: ReadingPage,
});

/**
 * A paragraph where every word can be tapped. Key words from the glossary are
 * underlined; words the student marked stay highlighted.
 */
function ReadingParagraph({
  text,
  glossary,
  marked,
  selected,
  onSelect,
}: {
  text: string;
  glossary: ReadonlySet<string>;
  marked: readonly string[];
  selected: string | null;
  onSelect: (term: string) => void;
}) {
  return (
    <p>
      {readingTokens(text).map((token, index) => {
        if (!token.word) return <span key={index}>{token.text}</span>;
        const term = lookupTerm(token.text);
        return (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(term)}
            className={cn(
              "rounded-sm transition-colors hover:bg-secondary",
              glossary.has(term) &&
                "underline decoration-brand-green/60 decoration-dotted underline-offset-4",
              marked.includes(term) && "bg-amber-400/20",
              selected === term && "bg-brand-green/15 text-brand-green",
            )}
          >
            {token.text}
          </button>
        );
      })}
    </p>
  );
}

/** The meaning of the tapped word: the glossary's, or the app dictionary's. */
function WordMeaning({ term, glossaryPt }: { term: string; glossaryPt: string | null }) {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const searchDictionary = useServerFn(lookupWord);
  // Same query key as the Vocabulary dictionary, so a word looked up there
  // (or by any student, in the server cache) comes back with no new AI call.
  const { data: entry, isFetching } = useQuery({
    queryKey: ["dictionary-v2", term],
    queryFn: () => searchDictionary({ data: { term } }),
    enabled: !glossaryPt && term.length >= 2,
    staleTime: 1000 * 60 * 60,
  });
  const translations = [
    ...new Set(entry?.meanings.flatMap((meaning) => meaning.translations) ?? []),
  ].slice(0, 4);
  const definition = entry?.meanings.find((meaning) => meaning.definition)?.definition ?? null;

  return (
    <div className="mt-4 rounded-lg bg-brand-green/10 px-3 py-2 text-sm">
      <span translate="no" lang="en" className="font-semibold">
        {term}
      </span>
      <span> · </span>
      {glossaryPt ? (
        <span translate="no">{glossaryPt}</span>
      ) : isFetching ? (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          <span>{t("Looking up…")}</span>
        </span>
      ) : translations.length ? (
        <>
          <span translate="no">{translations.join(", ")}</span>
          {definition ? (
            <span translate="no" lang="en" className="mt-0.5 block text-xs text-muted-foreground">
              {definition}
            </span>
          ) : null}
        </>
      ) : (
        <span className="text-muted-foreground">{t("No translation found for this word.")}</span>
      )}
    </div>
  );
}

const markedKey = (reading: DailyReading) =>
  `reading-marked:${reading.day}:${reading.level}${reading.choice ? `:${readingChoiceKey(reading.choice)}` : ""}`;

// The text the student chose today (category and style), kept on this device
// for the day; "Today's pick" (null) when there is none.
const choiceKey = () => `reading-choice:${studyToday()}`;

function readChoice(): ReadingChoice | null {
  try {
    const raw = window.localStorage.getItem(choiceKey());
    const parsed = raw ? (JSON.parse(raw) as Partial<ReadingChoice>) : null;
    return parsed &&
      (READING_CATEGORIES as readonly string[]).includes(parsed.category ?? "") &&
      (READING_STYLES as readonly string[]).includes(parsed.style ?? "")
      ? (parsed as ReadingChoice)
      : null;
  } catch {
    return null;
  }
}

function saveChoice(choice: ReadingChoice | null) {
  try {
    if (choice) window.localStorage.setItem(choiceKey(), JSON.stringify(choice));
    else window.localStorage.removeItem(choiceKey());
  } catch {
    // Private window or blocked storage: the choice lasts until the page closes.
  }
}

const chipClass = (active: boolean) =>
  cn(
    "h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
    active
      ? "border-amber-400/60 bg-amber-400/12 text-amber-300"
      : "border-border text-muted-foreground hover:text-foreground",
  );

/**
 * What to read (user request, 2026-10-22): "Today's pick" (the theme of the
 * day) or one of six categories in one of three styles. Each choice is a text
 * written once per level and day and shared, like the daily text.
 */
function ReadingPicker({
  choice,
  onChange,
  t,
}: {
  choice: ReadingChoice | null;
  onChange: (choice: ReadingChoice | null) => void;
  t: (label: string) => string;
}) {
  return (
    <section className="card-soft mt-5 p-3 sm:p-4" aria-labelledby="reading-picker-title">
      <h2 id="reading-picker-title" className="text-xs font-semibold text-muted-foreground">
        {t("What do you want to read?")}
      </h2>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={t("Category")}>
        <button
          type="button"
          aria-pressed={!choice}
          className={chipClass(!choice)}
          onClick={() => onChange(null)}
        >
          {t("Today's pick")}
        </button>
        {READING_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            aria-pressed={choice?.category === category}
            className={chipClass(choice?.category === category)}
            onClick={() => onChange({ category, style: choice?.style ?? "story" })}
          >
            {t(READING_CATEGORY_LABELS[category])}
          </button>
        ))}
      </div>
      {choice ? (
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={t("Text style")}>
          {READING_STYLES.map((style) => (
            <button
              key={style}
              type="button"
              aria-pressed={choice.style === style}
              className={chipClass(choice.style === style)}
              onClick={() => onChange({ category: choice.category, style })}
            >
              {t(READING_STYLE_LABELS[style])}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function readMarked(reading: DailyReading): string[] {
  try {
    const raw = window.localStorage.getItem(markedKey(reading));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function saveMarked(reading: DailyReading, words: string[]) {
  try {
    window.localStorage.setItem(markedKey(reading), JSON.stringify(words));
  } catch {
    // Private window or blocked storage: the marks last until the page closes.
  }
}

function ReadingPage() {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const { data: profile } = useProfile();
  const fetchReading = useServerFn(loadDailyReading);
  // Read after mount (localStorage), so the server render and the first
  // client render agree.
  const [choice, setChoice] = useState<ReadingChoice | null>(null);
  const [choiceReady, setChoiceReady] = useState(false);
  useEffect(() => {
    setChoice(readChoice());
    setChoiceReady(true);
  }, []);
  const { data: reading, isLoading } = useQuery({
    queryKey: ["daily-reading", profile?.level, readingChoiceKey(choice)],
    queryFn: () => fetchReading({ data: { choice } }),
    enabled: !!profile && choiceReady,
    staleTime: 1000 * 60 * 30,
  });

  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  // Words the student tapped because they did not understand them, kept for
  // the day on this device.
  const [marked, setMarked] = useState<string[]>([]);
  const [showPt, setShowPt] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [chosen, setChosen] = useState<(number | null)[]>([]);
  const [checked, setChecked] = useState(false);
  // The question on screen: the five questions sit behind numbered tabs.
  const [current, setCurrent] = useState(0);

  // Answering every question finishes today's reading: the server grades it
  // and records it once a day, which closes the study day (migration 0073).
  const queryClient = useQueryClient();
  const finishReading = useServerFn(completeDailyReading);
  const finish = useMutation({
    mutationFn: (input: { answers: number[]; fallback: boolean; choice: ReadingChoice | null }) =>
      finishReading({ data: input }),
    onSuccess: () =>
      // Streak, rhythm, today's progress, goals and this page (now done)
      // read the new activity.
      queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0]) !== "dictionary-v2",
      }),
  });

  // Reading time counts toward today's minutes once the student has engaged:
  // played the text or checked the answers.
  const [engaged, setEngaged] = useState(false);
  const minutesSpent = useTimeSpent();
  useLogTimeOnExit({
    timer: minutesSpent,
    profile: engaged ? profile : null,
    type: "reading",
    title: "Daily reading",
  });

  // Bumped on every start or stop, so an old loop never keeps reading.
  const playRun = useRef(0);
  useEffect(
    () => () => {
      playRun.current += 1;
      stopSpeaking();
    },
    [],
  );
  // The study day closes once a day: the text finished today shows done; any
  // other text of the day is practice, checked here on the device.
  const completed = reading?.completed ?? null;
  const doneHere =
    !!reading &&
    !!completed &&
    readingChoiceKey(completed.choice) === readingChoiceKey(reading.choice);
  const practice = !!completed && !doneHere;

  function pick(next: ReadingChoice | null) {
    playRun.current += 1;
    stopSpeaking();
    setPlaying(false);
    setShowPt(false);
    finish.reset();
    setChoice(next);
    saveChoice(next);
  }

  useEffect(() => {
    // Already finished today: the page shows it done, with the answers given.
    const done =
      reading?.completed &&
      readingChoiceKey(reading.completed.choice) === readingChoiceKey(reading.choice)
        ? reading.completed
        : null;
    const given =
      done?.answers && reading && done.answers.length === reading.questions.length
        ? done.answers
        : null;
    setChosen(reading ? (given ?? reading.questions.map(() => null)) : []);
    setChecked(!!done);
    setCurrent(0);
    setMarked(reading ? readMarked(reading) : []);
    setSelectedWord(null);
  }, [reading]);

  function selectWord(term: string) {
    setEngaged(true);
    if (selectedWord === term) {
      setSelectedWord(null);
      return;
    }
    setSelectedWord(term);
    if (!reading || marked.includes(term)) return;
    const next = [...marked, term];
    setMarked(next);
    saveMarked(reading, next);
  }

  function unmark(term: string) {
    if (!reading) return;
    const next = marked.filter((word) => word !== term);
    setMarked(next);
    saveMarked(reading, next);
    if (selectedWord === term) setSelectedWord(null);
  }

  async function listen(current: DailyReading) {
    playRun.current += 1;
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      return;
    }
    const run = playRun.current;
    setEngaged(true);
    setPlaying(true);
    // Read chunk by chunk (the voice takes 500 characters at a time), the next
    // one prepared while the current one plays. Same text for every student of
    // the level, so each chunk's audio is cached once.
    const chunks = readingSpeechChunks(current.text);
    try {
      for (let index = 0; index < chunks.length; index += 1) {
        if (playRun.current !== run) return;
        const next = chunks[index + 1];
        if (next) prepareSpeech(next, { cache: "persistent" });
        await speakEnglish(chunks[index]!, { cache: "persistent" });
      }
    } catch {
      // Playback stopped or failed: the text is still on screen.
    } finally {
      if (playRun.current === run) setPlaying(false);
    }
  }

  const glossaryPt = new Map(
    (reading?.glossary ?? []).map((item) => [lookupTerm(item.word), item.pt] as const),
  );
  const glossaryTerms = new Set(glossaryPt.keys());
  // No result line for a reading finished before the answers were recorded.
  const result =
    reading && checked && chosen.every((value) => value !== null)
      ? gradeReading(reading.questions, chosen)
      : null;
  const allAnswered = chosen.length > 0 && chosen.every((value) => value !== null);

  return (
    <AppShell>
      <PageHeader
        icon={BookOpenText}
        accent="amber"
        eyebrow={t("Reading practice")}
        title={t("Daily reading")}
        description={t(
          "A short text at your level every day, with audio, key words and questions.",
        )}
      />

      <ReadingPicker choice={choice} onChange={pick} t={t} />

      {isLoading || !reading ? (
        <div className="mt-5 space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-40 w-full" />
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {choice ? t("EVO is writing your text…") : t("Preparing today's reading…")}
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="card-soft p-4 sm:p-6" aria-labelledby="reading-title">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-amber-400/12 px-2.5 py-1 font-medium text-amber-400">
                {reading.choice
                  ? `${t(READING_CATEGORY_LABELS[reading.choice.category])} · ${t(READING_STYLE_LABELS[reading.choice.style])}`
                  : reading.theme === "motivational"
                    ? t("Motivation")
                    : t("Everyday story")}
              </span>
              <span className="rounded-full bg-secondary px-2.5 py-1 font-medium uppercase">
                {reading.level}
              </span>
            </div>
            <h2
              id="reading-title"
              translate="no"
              lang="en"
              className="font-display mt-3 text-xl font-semibold sm:text-2xl"
            >
              {reading.title}
            </h2>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={playing ? "outline" : "default"}
                className="gap-1.5"
                onClick={() => void listen(reading)}
              >
                {playing ? (
                  <Square className="size-4" aria-hidden="true" />
                ) : (
                  <Volume2 className="size-4" aria-hidden="true" />
                )}
                {playing ? t("Stop") : t("Listen to EVO")}
              </Button>
              {reading.textPt ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  aria-pressed={showPt}
                  onClick={() => setShowPt((value) => !value)}
                >
                  <Languages className="size-4" aria-hidden="true" />
                  {showPt ? t("Hide translation") : t("Show translation")}
                </Button>
              ) : null}
            </div>

            <div
              translate="no"
              lang="en"
              className="mt-4 space-y-3 text-base leading-relaxed sm:text-[1.05rem]"
            >
              {readingParagraphs(reading.text).map((paragraph, index) => (
                <ReadingParagraph
                  key={index}
                  text={paragraph}
                  glossary={glossaryTerms}
                  marked={marked}
                  selected={selectedWord}
                  onSelect={selectWord}
                />
              ))}
            </div>

            {/* Where the text comes from (user request): every daily reading is
                an original text by EVO, so the reference says so plainly. */}
            <p className="mt-4 border-t border-border pt-3 text-[11px] leading-snug text-muted-foreground">
              <span className="font-semibold uppercase tracking-wide">{t("Source")}</span>{" "}
              {readingReference(reading, t)}
            </p>
            <div className="-ml-2 mt-1 flex flex-wrap items-center gap-1">
              <CopyButton text={readingShareText(reading, t)} />
              <EmailButton subject={reading.title} text={readingShareText(reading, t)} />
              <WhatsAppButton text={readingShareText(reading, t)} />
            </div>

            {selectedWord ? (
              <WordMeaning term={selectedWord} glossaryPt={glossaryPt.get(selectedWord) ?? null} />
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">
                {t("Tap any word you don't understand to see its translation.")}
              </p>
            )}

            {marked.length ? (
              <div className="mt-4">
                <p className="text-xs font-medium text-muted-foreground">{t("Words you marked")}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {marked.map((term) => (
                    <span
                      key={term}
                      className={cn(
                        "inline-flex items-center rounded-full bg-amber-400/15 text-xs",
                        selectedWord === term && "ring-1 ring-brand-green",
                      )}
                    >
                      <button
                        type="button"
                        translate="no"
                        lang="en"
                        className="py-1 pl-2.5 pr-1 font-medium"
                        onClick={() => setSelectedWord(term)}
                      >
                        {term}
                      </button>
                      <button
                        type="button"
                        className="rounded-full p-1 pr-2 text-muted-foreground hover:text-foreground"
                        aria-label={`${t("Remove")} ${term}`}
                        onClick={() => unmark(term)}
                      >
                        <X className="size-3" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {showPt && reading.textPt ? (
              <div
                translate="no"
                className="mt-4 space-y-2 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground"
              >
                {readingParagraphs(reading.textPt).map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            ) : null}
          </section>

          <section className="card-soft p-4 sm:p-5" aria-labelledby="questions-title">
            <h2 id="questions-title" className="font-display text-base font-semibold">
              {t("Did you understand?")}
            </h2>
            {/* One question at a time behind numbered tabs (user request: the
                five questions made this block much taller than the text). */}
            <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label={t("Questions")}>
              {reading.questions.map((question, qIndex) => {
                const answered = chosen[qIndex] !== null && chosen[qIndex] !== undefined;
                const right = checked && chosen[qIndex] === question.answer;
                const wrong = checked && answered && chosen[qIndex] !== question.answer;
                return (
                  <button
                    key={qIndex}
                    type="button"
                    role="tab"
                    aria-selected={current === qIndex}
                    aria-label={`${t("Question")} ${qIndex + 1}`}
                    onClick={() => setCurrent(qIndex)}
                    className={cn(
                      "grid size-8 place-items-center rounded-full border text-xs font-semibold tabular-nums transition-colors",
                      right
                        ? "border-brand-green bg-brand-green/15 text-brand-green"
                        : wrong
                          ? "border-destructive/60 bg-destructive/10 text-destructive"
                          : answered
                            ? "border-brand-green/50 bg-brand-green/10 text-foreground"
                            : "border-border text-muted-foreground",
                      current === qIndex &&
                        "ring-2 ring-brand-green/60 ring-offset-1 ring-offset-background",
                    )}
                  >
                    {right ? (
                      <Check className="size-3.5" aria-hidden="true" />
                    ) : wrong ? (
                      <X className="size-3.5" aria-hidden="true" />
                    ) : (
                      qIndex + 1
                    )}
                  </button>
                );
              })}
            </div>
            {(() => {
              const qIndex = Math.min(current, reading.questions.length - 1);
              const question = reading.questions[qIndex];
              if (!question) return null;
              return (
                <div className="mt-3" role="tabpanel">
                  <p translate="no" lang="en" className="text-sm font-medium">
                    {qIndex + 1}. {question.question}
                  </p>
                  <div className="mt-2 grid gap-1.5">
                    {question.options.map((option, oIndex) => {
                      const picked = chosen[qIndex] === oIndex;
                      const right = checked && oIndex === question.answer;
                      const wrong = checked && picked && oIndex !== question.answer;
                      return (
                        <button
                          key={oIndex}
                          type="button"
                          disabled={checked}
                          aria-pressed={picked}
                          onClick={() => {
                            const next = chosen.map((value, index) =>
                              index === qIndex ? oIndex : value,
                            );
                            setChosen(next);
                            // On to the next open question, so answering flows.
                            const open = next.findIndex(
                              (value, index) => index > qIndex && value === null,
                            );
                            if (open >= 0) window.setTimeout(() => setCurrent(open), 250);
                          }}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                            picked && !checked
                              ? "border-brand-green bg-brand-green/10"
                              : "border-border hover:bg-secondary/60",
                            right && "border-brand-green bg-brand-green/10 text-brand-green",
                            wrong && "border-destructive/60 bg-destructive/10",
                          )}
                        >
                          {right ? (
                            <Check className="size-4 shrink-0" aria-hidden="true" />
                          ) : wrong ? (
                            <X className="size-4 shrink-0" aria-hidden="true" />
                          ) : null}
                          <span translate="no" lang="en">
                            {option}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {checked && question.explanation_pt ? (
                    <p translate="no" className="mt-1.5 text-xs text-muted-foreground">
                      {question.explanation_pt}
                    </p>
                  ) : null}
                  <div className="mt-3 flex items-center justify-between">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="gap-1"
                      disabled={qIndex === 0}
                      onClick={() => setCurrent(qIndex - 1)}
                    >
                      <ChevronLeft className="size-4" aria-hidden="true" />
                      {t("Previous")}
                    </Button>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {qIndex + 1}/{reading.questions.length}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="gap-1"
                      disabled={qIndex >= reading.questions.length - 1}
                      onClick={() => setCurrent(qIndex + 1)}
                    >
                      {t("Next")}
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              );
            })()}

            {result ? (
              <p className="mt-4 rounded-lg bg-secondary/60 px-3 py-2 text-sm font-medium">
                <span>{t("You got")}</span> {result.right}/{result.total} <span>{t("right.")}</span>
              </p>
            ) : checked ? null : (
              <Button
                type="button"
                className="mt-4 w-full"
                disabled={!allAnswered}
                onClick={() => {
                  setEngaged(true);
                  setChecked(true);
                  // Today's study day already counts: this text is practice.
                  if (practice) return;
                  finish.mutate({
                    answers: chosen.map((value) => value ?? 0),
                    fallback: reading.fallback,
                    choice: reading.choice,
                  });
                }}
              >
                {t("Check answers")}
              </Button>
            )}
            {practice ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {t("Extra practice: today's reading already counts as a study day.")}
              </p>
            ) : finish.isSuccess || doneHere ? (
              <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-brand-green">
                <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
                {t("Reading done: today counts as a study day.")}
              </p>
            ) : finish.isError ? (
              <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-destructive">
                <span>{t("Your answers could not be saved.")}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={finish.isPending}
                  onClick={() => finish.variables && finish.mutate(finish.variables)}
                >
                  {t("Try again")}
                </Button>
              </p>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">
              {t("A new reading arrives every day, matching your level.")}
            </p>
          </section>
        </div>
      )}
    </AppShell>
  );
}
