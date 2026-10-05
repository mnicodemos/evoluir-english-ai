import { Check, Loader2, Mic, Square, Volume2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LEARNED_MASTERY, isDue, type ReviewState } from "@/lib/vocabularyReview";

export type Word = {
  id: string;
  word: string;
  translation: string;
  meaning: string;
  pronunciation: string;
  example: string;
  category: string;
  difficulty: string;
};

/** State and actions the page shares with every word list. */
export type VocabularyListContext = {
  t: (text: string) => string;
  byWord: Map<string, ReviewState>;
  knownNow: (id: string) => boolean;
  busy: string | null;
  recordingId: string | null;
  checkingId: string | null;
  playingKey: string | null;
  onSpeak: (key: string, word: string) => void | Promise<void>;
  onMarkKnown: (wordId: string) => void | Promise<void>;
  onMarkForgotten: (wordId: string) => void | Promise<void>;
  onTogglePronunciation: (word: Word) => void | Promise<void>;
};

/**
 * One list of vocabulary cards (review, today or learned). Defined at module
 * level so React keeps the cards mounted between renders of the page.
 */
export function VocabularyWordList({
  items,
  showActions = true,
  highlightKnown = false,
  t,
  byWord,
  knownNow,
  busy,
  recordingId,
  checkingId,
  playingKey,
  onSpeak,
  onMarkKnown,
  onMarkForgotten,
  onTogglePronunciation,
}: VocabularyListContext & {
  items: Word[];
  showActions?: boolean;
  highlightKnown?: boolean;
}) {
  if (items.length === 0)
    return (
      <p className="mt-6 text-sm text-muted-foreground">Nothing here yet — keep practicing.</p>
    );
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {items.map((w) => {
        const isRecording = recordingId === w.id;
        const isChecking = checkingId === w.id;
        const state = byWord.get(w.id);
        const isKnown = highlightKnown && knownNow(w.id);
        const mastery = state?.mastery_level ?? 0;
        const isLearning = highlightKnown && !isKnown && mastery > 0 && mastery < LEARNED_MASTERY;
        return (
          <article key={w.id} className={`card-soft p-4 xl:p-3 ${isKnown ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 break-words">
                <h3 className="text-lg font-semibold">{w.word}</h3>
                <p className="text-sm text-muted-foreground">{w.translation}</p>
              </div>
              <div className="flex items-center gap-2">
                {isKnown && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">
                    <Check className="size-3" aria-hidden /> {t("Known")}
                  </span>
                )}
                {isLearning && (
                  <span className="rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning">
                    {t("Still learning")}
                  </span>
                )}
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                  {w.difficulty}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onSpeak(`daily-${w.id}`, w.word)}
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
            <p className="mt-1.5 text-sm">{w.meaning}</p>
            <p className="mt-1 text-sm text-muted-foreground">{w.pronunciation}</p>
            <p className="mt-1.5 rounded-lg bg-secondary/70 px-3 py-1.5 text-xs italic line-clamp-2">
              "{w.example}"
            </p>
            {showActions && (
              <div className="mt-3 flex gap-2">
                {!isKnown && (
                  <Button
                    size="sm"
                    className="min-h-11 flex-1"
                    disabled={busy === w.id || Boolean(recordingId) || Boolean(checkingId)}
                    onClick={() => onMarkKnown(w.id)}
                    aria-label="I know this word"
                    title="I know this word"
                  >
                    <Check className="size-4" /> {t("I know it")}
                  </Button>
                )}
                {!isKnown && isDue(state) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11 flex-1"
                    disabled={busy === w.id || Boolean(recordingId) || Boolean(checkingId)}
                    onClick={() => onMarkForgotten(w.id)}
                  >
                    <X className="size-4" /> {t("Not yet")}
                  </Button>
                )}
                <Button
                  className="min-h-11 flex-1"
                  variant={isRecording ? "destructive" : "outline"}
                  disabled={isChecking || Boolean(checkingId)}
                  onClick={() => onTogglePronunciation(w)}
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
                  {isRecording ? t("Stop") : t("Say it")}
                </Button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
