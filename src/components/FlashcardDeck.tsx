import { Check, Headphones, RotateCcw, Volume2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { reviewFlashcard, type Flashcard, type UserFlashcard } from "@/hooks/useLearning";
import { usePersistentState } from "@/hooks/usePersistentState";
import { speakEnglish } from "@/lib/speech";
import { cn } from "@/lib/utils";

/**
 * English-only flip-card deck for the lesson vocabulary. The student recalls the
 * meaning in English, flips the card and then says whether they got it right.
 * Progress is saved, so leaving in the middle keeps the place in the deck.
 */
export function FlashcardDeck({
  cards,
  userId,
  states,
  storageKey,
  onFinished,
  onRated,
}: {
  cards: Flashcard[];
  userId?: string | undefined;
  states: UserFlashcard[];
  storageKey?: string | null;
  onFinished?: () => void;
  onRated?: () => void;
}) {
  const [saved, setSaved, clearSaved] = usePersistentState(storageKey ?? null, { index: 0, done: false });
  const [flipped, setFlipped] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const index = Math.min(saved.index, Math.max(0, cards.length - 1));
  const card = cards[index];

  async function speak(text: string) {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
      await speakEnglish(text);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not play this audio.");
    } finally {
      setIsPlaying(false);
    }
  }

  async function answer(correct: boolean) {
    if (!card) return;
    if (userId) {
      await reviewFlashcard(
        userId,
        card.id,
        correct ? "easy" : "hard",
        states.find((s) => s.flashcard_id === card.id),
      );
      onRated?.();
    }
    setFlipped(false);
    if (index + 1 >= cards.length) {
      setSaved({ index, done: true });
      onFinished?.();
    } else {
      setSaved({ index: index + 1, done: false });
    }
  }

  function restart() {
    clearSaved();
    setSaved({ index: 0, done: false });
    setFlipped(false);
  }

  if (saved.done || !card) {
    return (
      <div className="card-soft p-8 text-center">
        <p className="text-lg font-semibold">Review finished 🎉</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The words you missed will come back sooner in your next review.
        </p>
        {cards.length > 0 && (
          <Button variant="outline" size="sm" className="mt-4" onClick={restart}>
            Review again
          </Button>
        )}
      </div>
    );
  }

  const prompt = card.prompt?.trim() || card.word;
  const answerText = card.answer?.trim() || card.definition?.trim() || card.example?.trim() || card.word;
  const listenText = card.listen_text?.trim() || (card.card_type === "listen" ? card.example?.trim() : "");
  const isListenCard = card.card_type === "listen";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Progress value={(index / cards.length) * 100} className="h-2 flex-1" />
        <span className="text-xs text-muted-foreground">
          {index + 1}/{cards.length}
        </span>
      </div>

      <div className="relative mx-auto flex min-h-72 w-full max-w-3xl items-center justify-center overflow-hidden rounded-xl border border-border bg-primary p-5 shadow-[var(--shadow-soft)] sm:min-h-96 sm:p-8">
        <div className="absolute left-5 hidden h-44 w-28 -rotate-6 rounded-xl border border-primary/25 bg-card/55 shadow-[var(--shadow-soft)] sm:block" />
        <div className="absolute right-5 hidden h-44 w-28 rotate-6 rounded-xl border border-primary/25 bg-card/55 shadow-[var(--shadow-soft)] sm:block" />

        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className={cn(
            "relative z-10 flex aspect-[4/3] w-full max-w-md flex-col items-center justify-center gap-4 rounded-xl border-4 border-primary/40 bg-card p-6 text-center text-card-foreground shadow-[var(--shadow-lift)] transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            flipped && "border-success/70",
          )}
        >
          <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-[0.65rem] font-bold uppercase text-muted-foreground">
            {isListenCard ? <Headphones className="size-3" /> : <RotateCcw className="size-3" />}
            {isListenCard ? "Listen card" : "Question card"}
          </span>

          {!flipped ? (
            <>
              <p className="max-w-xs text-xl font-black uppercase leading-tight sm:text-2xl">{prompt}</p>
              <p className="text-xs font-medium uppercase text-muted-foreground">Tap to see the answer</p>
            </>
          ) : (
            <>
              <p className="max-w-sm text-lg font-bold leading-snug sm:text-xl">{answerText}</p>
              {card.example && card.example !== answerText && (
                <p className="max-w-sm text-sm italic text-muted-foreground">“{card.example}”</p>
              )}
              {card.pronunciation && <p className="text-xs text-muted-foreground">{card.pronunciation}</p>}
              {isListenCard && listenText && (
                <Button
                  variant={isPlaying ? "default" : "outline"}
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    void speak(listenText);
                  }}
                  disabled={isPlaying}
                  aria-label="Listen to the answer"
                  className={isPlaying ? "bg-success text-success-foreground hover:bg-success/90" : undefined}
                >
                  <Volume2 className="size-4" /> Listen
                </Button>
              )}
            </>
          )}
        </button>
      </div>

      {flipped && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="default"
            onClick={() => answer(true)}
            className="flex items-center justify-center gap-2 rounded-lg bg-success px-3 py-3 text-sm font-semibold text-success-foreground transition-transform hover:scale-[1.02]"
          >
            <Check className="size-4" /> Acerto
          </Button>
          <Button
            variant="destructive"
            onClick={() => answer(false)}
            className="flex items-center justify-center gap-2 rounded-lg bg-destructive px-3 py-3 text-sm font-semibold text-destructive-foreground transition-transform hover:scale-[1.02]"
          >
            <X className="size-4" /> Erro
          </Button>
        </div>
      )}
    </div>
  );
}
