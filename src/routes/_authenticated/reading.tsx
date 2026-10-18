import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BookOpenText, Check, Languages, Loader2, Square, Volume2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/useProfile";
import { useLogTimeOnExit, useTimeSpent } from "@/hooks/useTimeSpent";
import { gradeReading, readingParagraphs, readingSpeechChunks } from "@/lib/dailyReading";
import { loadDailyReading, type DailyReading } from "@/lib/dailyReading.functions";
import { prepareSpeech, speakEnglish, stopSpeaking } from "@/lib/speech";
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

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A paragraph with its glossary words as tappable spans (longest words first). */
function GlossaryParagraph({
  text,
  words,
  selected,
  onSelect,
}: {
  text: string;
  words: string[];
  selected: string | null;
  onSelect: (word: string) => void;
}) {
  const sorted = [...words].sort((a, b) => b.length - a.length).filter(Boolean);
  if (!sorted.length) return <p>{text}</p>;
  const pattern = new RegExp(`\\b(${sorted.map(escapeRegExp).join("|")})\\b`, "gi");
  const parts = text.split(pattern);
  return (
    <p>
      {parts.map((part, index) => {
        const match = sorted.find((word) => word.toLowerCase() === part.toLowerCase());
        if (!match) return <span key={index}>{part}</span>;
        return (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(match)}
            className={cn(
              "rounded-sm underline decoration-brand-green/60 decoration-dotted underline-offset-4",
              selected === match && "bg-brand-green/15 text-brand-green",
            )}
          >
            {part}
          </button>
        );
      })}
    </p>
  );
}

function ReadingPage() {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const { data: profile } = useProfile();
  const fetchReading = useServerFn(loadDailyReading);
  const { data: reading, isLoading } = useQuery({
    queryKey: ["daily-reading", profile?.level],
    queryFn: () => fetchReading(),
    enabled: !!profile,
    staleTime: 1000 * 60 * 30,
  });

  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [showPt, setShowPt] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [chosen, setChosen] = useState<(number | null)[]>([]);
  const [checked, setChecked] = useState(false);

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
  useEffect(() => {
    setChosen(reading ? reading.questions.map(() => null) : []);
    setChecked(false);
  }, [reading]);

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

  const glossaryWords = reading?.glossary.map((item) => item.word) ?? [];
  const selectedMeaning = reading?.glossary.find((item) => item.word === selectedWord) ?? null;
  const result = reading && checked ? gradeReading(reading.questions, chosen) : null;
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

      {isLoading || !reading ? (
        <div className="mt-5 space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-40 w-full" />
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t("Preparing today's reading…")}
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="card-soft p-4 sm:p-6" aria-labelledby="reading-title">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-amber-400/12 px-2.5 py-1 font-medium text-amber-400">
                {reading.theme === "motivational" ? t("Motivation") : t("Everyday story")}
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
                <GlossaryParagraph
                  key={index}
                  text={paragraph}
                  words={glossaryWords}
                  selected={selectedWord}
                  onSelect={(word) => {
                    setEngaged(true);
                    setSelectedWord((current) => (current === word ? null : word));
                  }}
                />
              ))}
            </div>

            {selectedMeaning ? (
              <p className="mt-4 rounded-lg bg-brand-green/10 px-3 py-2 text-sm">
                <span translate="no" lang="en" className="font-semibold">
                  {selectedMeaning.word}
                </span>
                <span> · </span>
                <span translate="no">{selectedMeaning.pt}</span>
              </p>
            ) : glossaryWords.length ? (
              <p className="mt-4 text-xs text-muted-foreground">
                {t("Tap an underlined word to see its meaning.")}
              </p>
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
            <ol className="mt-3 space-y-4">
              {reading.questions.map((question, qIndex) => (
                <li key={qIndex}>
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
                          onClick={() =>
                            setChosen((current) =>
                              current.map((value, index) => (index === qIndex ? oIndex : value)),
                            )
                          }
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
                </li>
              ))}
            </ol>

            {result ? (
              <p className="mt-4 rounded-lg bg-secondary/60 px-3 py-2 text-sm font-medium">
                <span>{t("You got")}</span> {result.right}/{result.total} <span>{t("right.")}</span>
              </p>
            ) : (
              <Button
                type="button"
                className="mt-4 w-full"
                disabled={!allAnswered}
                onClick={() => {
                  setEngaged(true);
                  setChecked(true);
                }}
              >
                {t("Check answers")}
              </Button>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              {t("A new reading arrives every day, matching your level.")}
            </p>
          </section>
        </div>
      )}
    </AppShell>
  );
}
