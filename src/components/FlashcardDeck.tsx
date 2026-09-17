import { Volume2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { reviewFlashcard, type Flashcard, type UserFlashcard } from "@/hooks/useLearning";
import { speakEnglish } from "@/lib/speech";

const ratings = [
  { id: "hard", label: "Hard", className: "bg-[oklch(0.95_0.05_25)] text-[oklch(0.5_0.16_25)]" },
  { id: "medium", label: "Medium", className: "bg-[oklch(0.95_0.06_85)] text-[oklch(0.45_0.12_75)]" },
  { id: "easy", label: "Easy", className: "bg-[oklch(0.94_0.06_158)] text-[oklch(0.42_0.12_158)]" },
] as const;

async function speak(word: string) {
  try {
    await speakEnglish(word);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Could not play this pronunciation.");
  }
}


/** Flip-card deck with Hard/Medium/Easy rating feeding the spaced-repetition schedule. */
export function FlashcardDeck({
  cards,
  userId,
  states,
  onFinished,
  onRated,
}: {
  cards: Flashcard[];
  userId?: string | undefined;
  states: UserFlashcard[];
  onFinished?: () => void;
  onRated?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);

  const card = cards[index];

  async function rate(rating: "easy" | "medium" | "hard") {
    if (!card) return;
    if (userId) {
      await reviewFlashcard(userId, card.id, rating, states.find((s) => s.flashcard_id === card.id));
      onRated?.();
    }
    setFlipped(false);
    if (index + 1 >= cards.length) {
      setDone(true);
      onFinished?.();
    } else {
      setIndex(index + 1);
    }
  }

  if (done || !card) {
    return (
      <div className="card-soft p-8 text-center">
        <p className="text-lg font-semibold">Review finished 🎉</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your hardest cards were scheduled to come back sooner.
        </p>
      </div>
    );
  }

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
            <p className="text-xs text-muted-foreground">Tap to see the meaning</p>
          </>
        ) : (
          <>
            <p className="text-xl font-semibold">{card.translation}</p>
            {card.example && <p className="text-sm italic text-muted-foreground">“{card.example}”</p>}
          </>
        )}
      </button>

      <div className="flex items-center justify-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => speak(card.word)}
          aria-label="Listen to the pronunciation"
        >
          <Volume2 className="size-4" /> Listen
        </Button>
      </div>

      {flipped && (
        <div className="grid grid-cols-3 gap-2">
          {ratings.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => rate(r.id)}
              className={`rounded-lg px-3 py-3 text-sm font-semibold transition-transform hover:scale-[1.02] ${r.className}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
