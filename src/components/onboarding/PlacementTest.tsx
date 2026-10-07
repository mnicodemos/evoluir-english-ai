import {
  CircleCheck,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Loader2,
  PenLine,
  Volume2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DONT_KNOW,
  PLACEMENT_QUESTIONS,
  isAnswered,
  placementComplete,
  type PlacementQuestion,
} from "@/lib/placementTest";
import { speakEnglish, stopSpeaking } from "@/lib/speech";

/**
 * Placement test, one question at a time: for each CEFR band the student hears a
 * sentence and picks its meaning, then types the missing words of another one.
 * If the audio cannot play, the sentence is shown so the test can still be finished.
 * "I don't know" skips a question, and the test ends as soon as the harder
 * questions can no longer change the level.
 */
export function PlacementTest({
  answers,
  onAnswer,
  t,
}: {
  answers: Record<string, string>;
  onAnswer: (id: string, value: string) => void;
  t: (label: string) => string;
}) {
  const total = PLACEMENT_QUESTIONS.length;
  const firstOpen = PLACEMENT_QUESTIONS.findIndex((q) => !isAnswered(answers[q.id]));
  const [index, setIndex] = useState(firstOpen === -1 ? 0 : firstOpen);
  const question = PLACEMENT_QUESTIONS[index]!;
  const answered = PLACEMENT_QUESTIONS.filter((q) => isAnswered(answers[q.id])).length;
  const complete = placementComplete(answers);

  useEffect(() => () => stopSpeaking(), []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t(
          "Listen and write. The questions get harder as you go — it is normal not to know the last ones.",
        )}
      </p>

      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>
          {t("Question")} {index + 1}/{total}
        </span>
        <span>
          {answered}/{total} {t("answered")}
        </span>
      </div>
      <div className="flex gap-1" aria-hidden="true">
        {PLACEMENT_QUESTIONS.map((q, i) => (
          <span
            key={q.id}
            className={`h-1 flex-1 rounded-full ${
              i === index ? "bg-primary" : isAnswered(answers[q.id]) ? "bg-primary/45" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {complete && !isAnswered(answers[question.id]) ? (
        <div className="card-soft flex items-start gap-3 p-4" role="status">
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-brand-green" aria-hidden="true" />
          <p className="text-sm">
            <span className="block font-semibold">{t("That's enough to find your level.")}</span>
            <span className="block text-muted-foreground">
              {t("The next questions are harder than your level, so you can skip them.")}
            </span>
          </p>
        </div>
      ) : (
        <QuestionCard
          key={question.id}
          question={question}
          value={answers[question.id] === DONT_KNOW ? "" : (answers[question.id] ?? "")}
          onAnswer={(value) => onAnswer(question.id, value)}
          onSubmit={() => index < total - 1 && setIndex(index + 1)}
          t={t}
        />
      )}

      <div className="flex justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={index === 0}
          onClick={() => setIndex(index - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {t("Previous")}
        </Button>
        {!complete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onAnswer(question.id, DONT_KNOW);
              if (index < total - 1) setIndex(index + 1);
            }}
          >
            {t("I don't know")}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={index === total - 1 || !isAnswered(answers[question.id])}
          onClick={() => setIndex(index + 1)}
        >
          {t("Next question")}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  value,
  onAnswer,
  onSubmit,
  t,
}: {
  question: PlacementQuestion;
  value: string;
  onAnswer: (value: string) => void;
  onSubmit: () => void;
  t: (label: string) => string;
}) {
  const [playing, setPlaying] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);

  async function play(text: string) {
    setPlaying(true);
    try {
      await speakEnglish(text, { cache: "persistent" });
    } catch {
      setAudioFailed(true);
    } finally {
      setPlaying(false);
    }
  }

  if (question.kind === "listen") {
    return (
      <fieldset className="card-soft space-y-4 p-4">
        <legend className="sr-only">{question.prompt}</legend>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Headphones className="size-4" aria-hidden="true" />
          {t("Listening")}
        </p>
        <Button
          type="button"
          variant="secondary"
          className="w-full gap-2"
          disabled={playing}
          onClick={() => void play(question.audio)}
        >
          {playing ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Volume2 className="size-4" aria-hidden="true" />
          )}
          {t("Play the audio")}
        </Button>
        {audioFailed && (
          <p className="rounded-lg bg-muted p-3 text-sm">
            <span className="block text-xs text-muted-foreground">
              {t("The audio did not play. Read the sentence instead:")}
            </span>
            <span lang="en">{question.audio}</span>
          </p>
        )}
        <p className="text-sm font-medium" lang="en">
          {question.prompt}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {question.options.map((option) => (
            <button
              key={option}
              type="button"
              lang="en"
              aria-pressed={value === option}
              onClick={() => onAnswer(option)}
              className={`rounded-lg border p-2.5 text-left text-sm transition-colors ${
                value === option
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border hover:bg-secondary"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>
    );
  }

  const [before, after] = question.sentence.split("___");
  return (
    <div className="card-soft space-y-4 p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <PenLine className="size-4" aria-hidden="true" />
        {t("Writing")}
      </p>
      <p className="text-sm text-muted-foreground" lang="en">
        {question.prompt}
      </p>
      <p className="text-base font-medium leading-relaxed" lang="en">
        {before}
        <span className="mx-1 inline-block min-w-16 border-b-2 border-primary px-1 text-primary">
          {value.trim() || " "}
        </span>
        {after}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (isAnswered(value)) onSubmit();
        }}
      >
        <Input
          aria-label={t("Your answer")}
          value={value}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          lang="en"
          placeholder={t("Type the missing words")}
          onChange={(event) => onAnswer(event.target.value)}
        />
      </form>
    </div>
  );
}
