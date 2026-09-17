import { Check, Volume2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { reviewFlashcard, type Flashcard, type UserFlashcard } from "@/hooks/useLearning";
import { usePersistentState } from "@/hooks/usePersistentState";
import { speakEnglish } from "@/lib/speech";

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

  async function speak(word: string) {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
      await speakEnglish(word);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not play this pronunciation.");
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

  const meaning = card.definition?.trim() || card.example?.trim() || "";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Progress value={(index / cards.length) * 100} className="h-2 flex-1" />
        <span className="text-xs text-muted-foreground">
          {index + 1}/{cards.length}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="card-soft flex min-h-56 w-full flex-col items-center justify-center gap-3 p-8 text-center"
      >
        {!flipped ? (
          <>
            <p className="text-2xl font-bold uppercase tracking-wide">{card.word}</p>
            {card.pronunciation && <p className="text-sm text-muted-foreground">{card.pronunciation}</p>}
            <p className="text-xs text-muted-foreground">Say the meaning in English, then tap to check</p>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold">{meaning}</p>
            {card.example && <p className="text-sm italic text-muted-foreground">“{card.example}”</p>}
          </>
        )}
      </button>

      <div className="flex items-center justify-center gap-2">
        <Button
          variant={isPlaying ? "default" : "ghost"}
          size="sm"
          onClick={() => speak(card.word)}
          disabled={isPlaying}
          aria-label="Listen to the pronunciation"
          className={isPlaying ? "bg-success text-success-foreground hover:bg-success/90" : undefined}
        >
          <Volume2 className="size-4" /> Listen
        </Button>
      </div>

      {flipped && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => answer(true)}
            className="flex items-center justify-center gap-2 rounded-lg bg-success px-3 py-3 text-sm font-semibold text-success-foreground transition-transform hover:scale-[1.02]"
          >
            <Check className="size-4" /> Acerto
          </button>
          <button
            type="button"
            onClick={() => answer(false)}
            className="flex items-center justify-center gap-2 rounded-lg bg-destructive px-3 py-3 text-sm font-semibold text-destructive-foreground transition-transform hover:scale-[1.02]"
          >
            <X className="size-4" /> Erro
          </button>
        </div>
      )}
    </div>
  );
}
