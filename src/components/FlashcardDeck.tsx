import { Check, Headphones, RotateCcw, Volume2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  nextReviewDays,
  reviewFlashcard,
  type Flashcard,
  type UserFlashcard,
} from "@/hooks/useLearning";
import { usePersistentState } from "@/hooks/usePersistentState";
import { reversedCard } from "@/lib/flashcards";
import { speakEnglish } from "@/lib/speech";
import { useUiLang } from "@/lib/uiLang";
import { uiPt } from "@/lib/uiDictionary";
import { cn } from "@/lib/utils";

/** The three ratings (owner request, 2026-10-30: two buttons sent a hard-won "right" 4 days away). */
type Rating = "again" | "hard" | "easy";
const SERVER_RATING = { again: "hard", hard: "medium", easy: "easy" } as const;

/**
 * Lesson vocabulary flip-card deck. The student recalls the answer, flips the
 * card and rates it: Again, Hard or Easy (the spaced review follows the
 * rating). A card answered with Again comes back at the end of the session
 * until it is remembered once (that second pass is practice only; its next
 * review stays tomorrow). Progress is saved, so leaving keeps the place.
 */
export function FlashcardDeck({
  cards,
  userId,
  states,
  storageKey,
  level,
  onFinished,
  onRated,
}: {
  cards: Flashcard[];
  userId?: string | undefined;
  states: UserFlashcard[];
  storageKey?: string | null;
  /** The student's level: at A1-A2 some cards ask from Portuguese. */
  level?: string | null | undefined;
  onFinished?: () => void;
  onRated?: () => void;
}) {
  const [saved, setSaved, clearSaved] = usePersistentState(storageKey ?? null, {
    index: 0,
    done: false,
  });
  // Cards answered with Again, shown again at the end of this session.
  const [again, setAgain] = useState<string[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasListened, setHasListened] = useState(false);
  const [feedback, setFeedback] = useState<Rating | null>(null);
  const { lang } = useUiLang();
  const t = (text: string) => (lang === "pt" ? (uiPt[text] ?? text) : text);

  const index = Math.min(saved.index, Math.max(0, cards.length - 1));
  const inMainDeck = !saved.done && index < cards.length;
  const relearning = !inMainDeck && again.length > 0;
  const card = relearning ? cards.find((item) => item.id === again[0]) : cards[index];
  const position = relearning ? cards.length + 1 : index;

  async function speak(text: string) {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
      await speakEnglish(text, { cache: "persistent" });
      setHasListened(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Could not play this audio."));
    } finally {
      setIsPlaying(false);
    }
  }

  async function rate(rating: Rating) {
    if (!card || feedback) return;
    setFeedback(rating);
    // The second pass of a missed card is practice: its review stays tomorrow.
    if (userId && !relearning) {
      try {
        await reviewFlashcard(
          userId,
          card.id,
          SERVER_RATING[rating],
          states.find((s) => s.flashcard_id === card.id),
        );
        onRated?.();
      } catch (error) {
        setFeedback(null);
        toast.error(
          error instanceof Error
            ? error.message
            : t("Your answer is safe, but progress could not be saved. Try again."),
        );
        return;
      }
    }
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    setFlipped(false);
    setHasListened(false);
    setFeedback(null);
    if (relearning) {
      // Remembered: it leaves the queue; missed again: it goes to the back.
      setAgain((queue) => (rating === "again" ? [...queue.slice(1), queue[0]!] : queue.slice(1)));
      if (rating !== "again" && again.length === 1) onFinished?.();
      return;
    }
    const nextAgain = rating === "again" ? [...again, card.id] : again;
    if (rating === "again") setAgain(nextAgain);
    if (index + 1 >= cards.length) {
      setSaved({ index, done: true });
      if (nextAgain.length === 0) onFinished?.();
    } else {
      setSaved({ index: index + 1, done: false });
    }
  }

  function restart() {
    clearSaved();
    setSaved({ index: 0, done: false });
    setAgain([]);
    setFlipped(false);
    setHasListened(false);
    setFeedback(null);
  }

  if (!card) {
    return (
      <div className="card-soft p-8 text-center">
        <p className="text-lg font-semibold">{t("Review finished")} 🎉</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("Everything you did is saved. You can go through the cards again whenever you like.")}
        </p>
        {cards.length > 0 && (
          <Button variant="outline" size="sm" className="mt-4" onClick={restart}>
            {t("Redo flashcards")}
          </Button>
        )}
      </div>
    );
  }

  const reversed = reversedCard(card, position, level);
  const prompt = reversed ? card.translation.trim() : card.prompt?.trim() || card.word;
  const answerText = reversed
    ? card.word
    : card.answer?.trim() || card.definition?.trim() || card.example?.trim() || card.word;
  const listenText =
    card.listen_text?.trim() || (card.card_type === "listen" ? card.example?.trim() : "");
  const isListenCard = card.card_type === "listen";
  const state = states.find((s) => s.flashcard_id === card.id);
  const days = (rating: "easy" | "medium") => nextReviewDays(rating, state);
  const dayLabel = (n: number) => (n === 1 ? t("1 day") : t("{n} days").replace("{n}", String(n)));
  const kindLabel = isListenCard
    ? t("Listen card")
    : reversed
      ? t("Say it in English")
      : t("Question card");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Progress
          value={relearning ? 100 : (index / Math.max(cards.length, 1)) * 100}
          className="h-2 flex-1"
        />
        <span className="text-xs text-muted-foreground">
          {relearning ? (
            <>
              <span>{t("Practise again")}:</span> <span>{again.length}</span>
            </>
          ) : (
            `${index + 1}/${cards.length}`
          )}
        </span>
        {(index > 0 || relearning) && (
          <Button variant="ghost" size="sm" className="text-xs" onClick={restart}>
            <RotateCcw className="size-3" /> {t("Start over")}
          </Button>
        )}
      </div>

      <div className="relative mx-auto flex min-h-72 w-full max-w-3xl items-center justify-center overflow-hidden rounded-xl border border-primary/30 bg-primary/10 p-5 shadow-[var(--shadow-soft)] sm:min-h-96 sm:p-8">
        {!flipped ? (
          <button
            type="button"
            onClick={() => setFlipped(true)}
            className="relative z-10 flex min-h-72 w-full max-w-md flex-col items-center justify-center gap-4 rounded-xl border-4 border-black/15 bg-white p-6 text-center text-black shadow-[var(--shadow-lift)] transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:aspect-[4/3] sm:min-h-0"
          >
            <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-black/10 px-2 py-1 text-[0.65rem] font-bold uppercase text-black">
              {isListenCard ? <Headphones className="size-3" /> : <RotateCcw className="size-3" />}
              {kindLabel}
            </span>

            <p
              className={cn(
                "max-w-xs text-xl font-black leading-tight sm:text-2xl",
                !reversed && "uppercase",
              )}
              translate="no"
            >
              {prompt}
            </p>
            <p className="text-xs font-medium uppercase text-black/60">
              {reversed ? t("Say the English word, then tap") : t("Tap to see the answer")}
            </p>
          </button>
        ) : (
          <div
            className={cn(
              "relative z-10 min-h-72 w-full max-w-md overflow-hidden rounded-xl border-4 bg-white text-center text-black shadow-[var(--shadow-lift)] transition-colors sm:aspect-[4/3] sm:min-h-0",
              feedback === "easy" && "border-success",
              feedback === "hard" && "border-amber-500",
              feedback === "again" && "border-destructive",
              !feedback && "border-black/15",
            )}
          >
            <span className="pointer-events-none absolute left-4 top-4 z-20 inline-flex items-center gap-1 rounded-full bg-black/10 px-2 py-1 text-[0.65rem] font-bold uppercase text-black">
              {isListenCard ? <Headphones className="size-3" /> : <RotateCcw className="size-3" />}
              {kindLabel}
            </span>

            <div className="flex min-h-72 w-full flex-col items-center justify-center gap-3 overflow-y-auto px-6 pb-6 pt-14 sm:min-h-full">
              <p className="max-w-sm text-lg font-bold leading-snug sm:text-xl" translate="no">
                {answerText}
              </p>
              {/* The meaning in Portuguese (owner request, 2026-10-30: it was stored but never shown). */}
              {!reversed && card.translation?.trim() ? (
                <p className="text-sm font-medium text-black/70" translate="no">
                  {card.translation}
                </p>
              ) : null}
              {card.example && card.example !== answerText && (
                <p className="max-w-sm text-sm italic text-black/70" translate="no">
                  “{card.example}”
                </p>
              )}
              {card.pronunciation && <p className="text-xs text-black/60">{card.pronunciation}</p>}
              <div className="flex flex-wrap justify-center gap-2">
                {isListenCard && listenText ? (
                  <Button
                    size="sm"
                    onClick={() => void speak(listenText)}
                    disabled={isPlaying}
                    aria-label={t("Listen to the answer")}
                    className="border-2 border-black/20 bg-white text-black hover:bg-black/5"
                  >
                    <Volume2 className="size-4" /> {t("Listen")}
                  </Button>
                ) : (
                  // Every card can be heard (owner request, 2026-10-30).
                  <Button
                    size="sm"
                    onClick={() => void speak(card.word)}
                    disabled={isPlaying}
                    aria-label={t("Hear the word")}
                    className="border-2 border-black/20 bg-white text-black hover:bg-black/5"
                  >
                    <Volume2 className="size-4" /> {t("Hear the word")}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFlipped(false)}
                  disabled={feedback !== null}
                  className="text-black hover:bg-black/5 hover:text-black"
                >
                  {t("See question")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {flipped && (
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              {
                rating: "again" as const,
                label: t("Again"),
                when: relearning ? t("Comes back now") : t("Now and tomorrow"),
                icon: X,
                tone: "bg-destructive text-destructive-foreground",
              },
              {
                rating: "hard" as const,
                label: t("Hard"),
                when: relearning ? t("Practice only") : dayLabel(days("medium")),
                icon: Check,
                tone: "bg-amber-500 text-black",
              },
              {
                rating: "easy" as const,
                label: t("Easy"),
                when: relearning ? t("Practice only") : dayLabel(days("easy")),
                icon: Check,
                tone: "bg-success text-success-foreground",
              },
            ] satisfies {
              rating: Rating;
              label: string;
              when: string;
              icon: typeof Check;
              tone: string;
            }[]
          ).map(({ rating, label, when, icon: Icon, tone }) => (
            <Button
              key={rating}
              onClick={() => void rate(rating)}
              disabled={feedback !== null || (isListenCard && !hasListened)}
              className={cn(
                "flex h-auto flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.02]",
                tone,
              )}
            >
              <span className="flex items-center gap-1.5">
                <Icon className="size-4" aria-hidden="true" /> {label}
              </span>
              <span className="text-[10px] font-medium opacity-80">{when}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
