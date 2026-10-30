import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BookmarkPlus,
  BookOpenText,
  Check,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Clock,
  Languages,
  Loader2,
  MousePointerClick,
  Shapes,
  Square,
  TextSearch,
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
  answerParagraph,
  gradeReading,
  lookupTerm,
  READING_CATEGORIES,
  READING_CATEGORY_LABELS,
  READING_STYLE_LABELS,
  READING_STYLES,
  readingChoiceKey,
  readingEstimate,
  readingKindLabel,
  readingLevel,
  readingParagraphs,
  readingReference,
  readingShareText,
  readingSpeechParts,
  readingTokens,
  sentenceWith,
  type ReadingChoice,
} from "@/lib/dailyReading";
import {
  completeDailyReading,
  loadDailyReading,
  loadReadingWeek,
  type DailyReading,
  type ReadingWeekDay,
} from "@/lib/dailyReading.functions";
import { lookupWord } from "@/lib/dictionary.functions";
import { saveReadingWords } from "@/lib/readingWords.functions";
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
  id,
  text,
  glossary,
  marked,
  selected,
  onSelect,
  highlight = null,
}: {
  id?: string;
  text: string;
  glossary: ReadonlySet<string>;
  marked: readonly string[];
  selected: string | null;
  onSelect: (term: string) => void;
  /** "audio" while EVO reads it, "answer" for "See in the text". */
  highlight?: "audio" | "answer" | null;
}) {
  return (
    <p
      id={id}
      className={cn(
        "-mx-2 rounded-md px-2 py-0.5 transition-colors duration-300",
        highlight === "audio" && "bg-brand-green/10",
        highlight === "answer" && "bg-amber-400/15 ring-1 ring-amber-400/40",
      )}
    >
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

/**
 * The size of the task before starting (owner request, 2026-10-30): about how
 * many minutes, the words of the text and the questions.
 */
function ReadingSize({ reading, t }: { reading: DailyReading; t: (label: string) => string }) {
  const { minutes, words } = readingEstimate(
    reading.text,
    readingLevel(reading.level),
    reading.questions.length,
  );
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Clock className="size-3.5" aria-hidden="true" />
      <span>≈ {minutes}</span> <span>{t("min")}</span> <span>·</span> <span>{words}</span>{" "}
      <span>{t("words")}</span> <span>·</span> <span>{reading.questions.length}</span>{" "}
      <span>{t("questions")}</span>
    </span>
  );
}

/**
 * Marked words join the student's Vocabulary reviews (owner request,
 * 2026-10-30: they used to live only on this device for the day). Each goes
 * with its meaning (the glossary's or the dictionary's) and the sentence of
 * the text it came from; the words already saved are remembered for the day.
 */
function SaveMarkedWords({
  reading,
  marked,
  glossaryPt,
  t,
}: {
  reading: DailyReading;
  marked: string[];
  glossaryPt: Map<string, string>;
  t: (label: string) => string;
}) {
  const queryClient = useQueryClient();
  const searchDictionary = useServerFn(lookupWord);
  const save = useServerFn(saveReadingWords);
  const key = `${markedKey(reading)}:saved`;
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
      setSaved(Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []);
    } catch {
      setSaved([]);
    }
  }, [key]);
  const pending = marked.filter((term) => !saved.includes(term));

  const mutation = useMutation({
    mutationFn: async (terms: string[]) => {
      const items = await Promise.all(
        terms.map(async (term) => {
          let translation = glossaryPt.get(term) ?? "";
          let meaning = "";
          if (!translation) {
            const entry = await queryClient
              .fetchQuery({
                queryKey: ["dictionary-v2", term],
                queryFn: () => searchDictionary({ data: { term } }),
                staleTime: 1000 * 60 * 60,
              })
              .catch(() => null);
            translation = [...new Set(entry?.meanings.flatMap((item) => item.translations) ?? [])]
              .slice(0, 3)
              .join(", ");
            meaning = entry?.meanings.find((item) => item.definition)?.definition ?? "";
          }
          return translation
            ? {
                word: term,
                translation: translation.slice(0, 200),
                meaning: meaning.slice(0, 400),
                example: sentenceWith(reading.text, term),
              }
            : null;
        }),
      );
      const words = items.filter((item): item is NonNullable<typeof item> => item !== null);
      if (!words.length) throw new Error("no translation");
      await save({ data: { words } });
      return words.map((item) => item.word);
    },
    onSuccess: (terms) => {
      const next = [...new Set([...saved, ...terms])];
      setSaved(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Blocked storage: the button may offer these words again later.
      }
      // The Vocabulary page, its review count and the Dashboard's due words.
      void queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0]).includes("vocabulary"),
      });
    },
  });

  if (!pending.length) {
    return saved.length ? (
      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-brand-green">
        <CircleCheck className="size-3.5 shrink-0" aria-hidden="true" />
        <span>{t("Saved to your Vocabulary reviews.")}</span>
        <Link to="/vocabulary" className="font-semibold underline-offset-2 hover:underline">
          {t("Open Vocabulary")}
        </Link>
      </p>
    ) : null;
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate(pending)}
      >
        {mutation.isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <BookmarkPlus className="size-4" aria-hidden="true" />
        )}
        <span>{t("Save to my Vocabulary")}</span> <span>({pending.length})</span>
      </Button>
      {mutation.isError ? (
        <span className="text-xs text-destructive">
          {mutation.error instanceof Error && mutation.error.message === "no translation"
            ? t("No translation found for this word.")
            : t("Could not save the words. Please try again.")}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">
          {t("They come back in your word reviews.")}
        </span>
      )}
    </div>
  );
}

const SLOW_KEY = "evoluir-reading-slow";

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

/** "30/10" (Portuguese) or "Oct 30" (English) for a "YYYY-MM-DD" study day. */
function shortDate(day: string, lang: string) {
  return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", {
    day: "numeric",
    month: lang === "pt" ? "2-digit" : "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}

/**
 * The student's reading week (owner request, 2026-10-30: each day was
 * isolated): the last seven days, done ones in green with their score, today
 * outlined; an earlier day with a stored text opens again as practice.
 */
function ReadingWeek({
  week,
  openDay,
  onOpen,
  lang,
  t,
}: {
  week: ReadingWeekDay[];
  openDay: string | null;
  onOpen: (entry: ReadingWeekDay | null) => void;
  lang: string;
  t: (label: string) => string;
}) {
  const doneCount = week.filter((entry) => entry.done).length;
  const today = week[week.length - 1]?.day;
  return (
    <section className="card-soft mt-5 p-3 sm:p-4" aria-labelledby="reading-week-title">
      <h2 id="reading-week-title" className="text-xs font-semibold text-muted-foreground">
        <span>{t("Your reading week")}</span> <span>·</span>{" "}
        <span className="text-foreground">{doneCount}</span> <span>{t("of")}</span> <span>7</span>{" "}
        <span>{t("days")}</span>
      </h2>
      <ol className="mt-2 grid max-w-xl grid-cols-7 gap-1.5">
        {week.map((entry) => {
          const isToday = entry.day === today;
          const selected = isToday ? openDay === null : openDay === entry.day;
          const canOpen = isToday || entry.available;
          const weekday = new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", {
            weekday: "short",
            timeZone: "UTC",
          })
            .format(new Date(`${entry.day}T12:00:00Z`))
            .replace(".", "");
          return (
            <li key={entry.day}>
              <button
                type="button"
                disabled={!canOpen}
                aria-pressed={selected}
                aria-label={`${shortDate(entry.day, lang)}${entry.done ? ` · ${t("Reading done")}` : ""}${entry.score !== null ? ` · ${entry.score}%` : ""}`}
                title={canOpen && !isToday ? t("Read it again") : undefined}
                onClick={() => onOpen(isToday ? null : entry)}
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] transition-colors sm:text-xs",
                  canOpen ? "hover:bg-white/[0.04]" : "cursor-default opacity-60",
                  selected && "bg-white/[0.06] ring-1 ring-inset ring-white/10",
                )}
              >
                <span className="capitalize text-muted-foreground">{weekday}</span>
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-full text-[10px] font-semibold tabular-nums",
                    entry.done
                      ? "bg-brand-green/15 text-brand-green ring-1 ring-brand-green/50"
                      : "bg-white/[0.04] text-muted-foreground",
                    isToday && !entry.done && "ring-1 ring-brand-green/60",
                  )}
                >
                  {entry.done ? (
                    entry.score !== null ? (
                      `${entry.score}`
                    ) : (
                      <Check className="size-3.5" aria-hidden="true" />
                    )
                  ) : (
                    shortDate(entry.day, lang).split(/[/\s]/)[lang === "pt" ? 0 : 1]
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

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
  // Closed while the student keeps Today's pick (owner request, 2026-10-30:
  // eighteen choices before the text asked for a decision first).
  const [open, setOpen] = useState(false);
  if (!open && !choice) {
    return (
      <button
        type="button"
        className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        aria-expanded={false}
        onClick={() => setOpen(true)}
      >
        <Shapes className="size-3.5" aria-hidden="true" />
        {t("Read another topic")}
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </button>
    );
  }
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
  // An earlier day of the week opened again from the reading week (practice).
  const [pastDay, setPastDay] = useState<ReadingWeekDay | null>(null);
  const shownChoice = pastDay ? pastDay.choice : choice;
  const { data: reading, isLoading } = useQuery({
    queryKey: [
      "daily-reading",
      profile?.level,
      readingChoiceKey(shownChoice),
      pastDay?.day ?? "today",
    ],
    queryFn: () =>
      fetchReading({
        data: pastDay ? { choice: pastDay.choice, day: pastDay.day } : { choice },
      }),
    enabled: !!profile && choiceReady,
    staleTime: 1000 * 60 * 30,
  });
  const fetchWeek = useServerFn(loadReadingWeek);
  const { data: week } = useQuery({
    queryKey: ["reading-week", profile?.id],
    queryFn: () => fetchWeek(),
    enabled: !!profile,
    staleTime: 1000 * 60 * 10,
  });

  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  // Words the student tapped because they did not understand them, kept for
  // the day on this device.
  const [marked, setMarked] = useState<string[]>([]);
  const [showPt, setShowPt] = useState(false);
  const [playing, setPlaying] = useState(false);
  // The paragraph EVO is reading, highlighted while the audio plays.
  const [speakingParagraph, setSpeakingParagraph] = useState<number | null>(null);
  // A slower voice (0.8×), kept on this device; useful at A1-A2.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    try {
      setSlow(window.localStorage.getItem(SLOW_KEY) === "1");
    } catch {
      setSlow(false);
    }
  }, []);
  function toggleSlow() {
    setSlow((value) => {
      try {
        window.localStorage.setItem(SLOW_KEY, value ? "0" : "1");
      } catch {
        // Blocked storage: the choice lasts until the page closes.
      }
      return !value;
    });
  }
  // The paragraph that answers the question on screen ("See in the text").
  const [answerAt, setAnswerAt] = useState<number | null>(null);
  function seeInText(paragraph: number) {
    setAnswerAt(paragraph);
    document
      .getElementById(`reading-paragraph-${paragraph}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
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
  // An earlier day is always practice; today, any text but the one finished.
  const practice = reading?.past ? !doneHere : !!completed && !doneHere;

  function pick(next: ReadingChoice | null) {
    playRun.current += 1;
    stopSpeaking();
    setPlaying(false);
    setShowPt(false);
    finish.reset();
    setPastDay(null);
    setChoice(next);
    saveChoice(next);
  }

  function openDay(entry: ReadingWeekDay | null) {
    playRun.current += 1;
    stopSpeaking();
    setPlaying(false);
    setShowPt(false);
    finish.reset();
    setPastDay(entry);
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
      setSpeakingParagraph(null);
      return;
    }
    const run = playRun.current;
    setEngaged(true);
    setPlaying(true);
    // Read chunk by chunk (the voice takes 500 characters at a time), the next
    // one prepared while the current one plays. Same text for every student of
    // the level, so each chunk's audio is cached once.
    const parts = readingSpeechParts(current.text);
    try {
      for (let index = 0; index < parts.length; index += 1) {
        if (playRun.current !== run) return;
        const next = parts[index + 1];
        if (next) prepareSpeech(next.text, { cache: "persistent" });
        setSpeakingParagraph(parts[index]!.paragraph);
        // The speed is applied on playback, so the cached audio stays shared.
        await speakEnglish(parts[index]!.text, { cache: "persistent", rate: slow ? 0.8 : 1 });
      }
    } catch {
      // Playback stopped or failed: the text is still on screen.
    } finally {
      if (playRun.current === run) {
        setPlaying(false);
        setSpeakingParagraph(null);
      }
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
        guide="reading"
        icon={BookOpenText}
        accent="amber"
        eyebrow={t("Reading practice")}
        title={t("Daily reading")}
        description={t(
          "A short text at your level every day, with audio, key words and questions.",
        )}
      />

      {week ? (
        <ReadingWeek
          week={week}
          openDay={pastDay?.day ?? null}
          onOpen={openDay}
          lang={lang}
          t={t}
        />
      ) : null}

      {pastDay ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] px-3 py-2 text-xs sm:text-sm">
          <span>
            <span>{t("Reading again from")}</span> <span>{shortDate(pastDay.day, lang)}</span>{" "}
            <span className="text-muted-foreground">
              · {t("practice: today's study day is not changed.")}
            </span>
          </span>
          <Button type="button" size="sm" variant="outline" onClick={() => openDay(null)}>
            {t("Back to today")}
          </Button>
        </div>
      ) : (
        <ReadingPicker choice={choice} onChange={pick} t={t} />
      )}

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
                {readingKindLabel(reading, t)}
              </span>
              <span className="rounded-full bg-secondary px-2.5 py-1 font-medium uppercase">
                {reading.level}
              </span>
              <ReadingSize reading={reading} t={t} />
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
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn("tabular-nums", slow && "border-brand-green text-brand-green")}
                aria-pressed={slow}
                aria-label={t("Slower voice")}
                title={t("Slower voice")}
                onClick={toggleSlow}
              >
                0.8×
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

            {/* The tip comes before the text (owner request, 2026-10-30: at the
                bottom it was read too late), until the first word is marked. */}
            {marked.length === 0 ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MousePointerClick className="size-3.5 shrink-0" aria-hidden="true" />
                {t("Tap any word you don't understand to see its translation.")}
              </p>
            ) : null}

            <div
              translate="no"
              lang="en"
              className="mt-4 space-y-3 text-base leading-relaxed sm:text-[1.05rem]"
            >
              {readingParagraphs(reading.text).map((paragraph, index) => (
                <ReadingParagraph
                  key={index}
                  id={`reading-paragraph-${index}`}
                  highlight={
                    speakingParagraph === index ? "audio" : answerAt === index ? "answer" : null
                  }
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
            ) : null}

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
                <SaveMarkedWords reading={reading} marked={marked} glossaryPt={glossaryPt} t={t} />
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
                    onClick={() => {
                      setCurrent(qIndex);
                      setAnswerAt(null);
                    }}
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
                  {checked
                    ? (() => {
                        // Where the answer is, once the answers are checked.
                        const at = answerParagraph(reading.text, question);
                        return at === null ? null : (
                          <button
                            type="button"
                            className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-amber-400 underline-offset-2 hover:underline"
                            onClick={() => seeInText(at)}
                          >
                            <TextSearch className="size-3.5" aria-hidden="true" />
                            {t("See in the text")}
                          </button>
                        );
                      })()
                    : null}
                  <div className="mt-3 flex items-center justify-between">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="gap-1"
                      disabled={qIndex === 0}
                      onClick={() => {
                        setCurrent(qIndex - 1);
                        setAnswerAt(null);
                      }}
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
                      onClick={() => {
                        setCurrent(qIndex + 1);
                        setAnswerAt(null);
                      }}
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
            {reading.past ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {doneHere
                  ? t("Your answers from that day.")
                  : t("Practice: answers checked here, today's study day is not changed.")}
              </p>
            ) : practice ? (
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
          </section>
        </div>
      )}
    </AppShell>
  );
}
