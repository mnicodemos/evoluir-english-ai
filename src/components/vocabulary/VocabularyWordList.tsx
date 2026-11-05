import { ArrowRight, Check, Eye, Layers, Loader2, Mic, Square, Volume2, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { DoneSeal } from "@/components/DoneSeal";
import { highlightWord } from "@/components/vocabulary/highlightWord";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  /** Resolves true when the pronunciation passed (>= 70%). */
  onTogglePronunciation: (word: Word) => void | Promise<boolean | void>;
};

/**
 * One vocabulary card (owner request, 2026-11-02, a product review: the card
 * showed the answer before the question, so "I know it" was recognition, not
 * memory). Words to practise show only the word and its audio; "Show meaning"
 * reveals the translation, meaning and example, and only then the rating
 * buttons appear. Known words and the Learned tab show everything at once.
 * The microphone is an icon beside the speaker, since saying the word is a
 * different exercise from remembering it.
 */
export function WordCard({
  w,
  showActions = true,
  highlightKnown = false,
  onSkip,
  className,
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
  w: Word;
  showActions?: boolean;
  highlightKnown?: boolean;
  /** Session only: "Not yet" on a word with no review due moves on without saving. */
  onSkip?: () => void;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const isRecording = recordingId === w.id;
  const isChecking = checkingId === w.id;
  const state = byWord.get(w.id);
  const isKnown = highlightKnown && knownNow(w.id);
  const mastery = state?.mastery_level ?? 0;
  const isLearning = highlightKnown && !isKnown && mastery > 0 && mastery < LEARNED_MASTERY;
  const hidden = showActions && !isKnown && !revealed;
  const locked = busy === w.id || Boolean(recordingId) || Boolean(checkingId);
  const due = isDue(state);
  // Learned tab: when the word comes back on the review ladder.
  const backIn = state?.next_review_at
    ? Math.ceil((new Date(state.next_review_at).getTime() - Date.now()) / 86_400_000)
    : null;
  return (
    <article
      className={cn(
        "group relative min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md xl:p-3",
        isKnown && "opacity-65",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1 break-words" translate="no">
          <h3 className="text-[1.05rem] font-semibold tracking-tight transition-colors group-hover:text-primary">
            {w.word}
          </h3>
          {!hidden && <p className="text-sm text-muted-foreground">{w.translation}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
          {w.category === "reading" && (
            <span className="rounded-full bg-chart-2/15 px-2.5 py-1 text-xs font-medium text-chart-2">
              {t("From reading")}
            </span>
          )}
          <span className="rounded-full border border-border/60 bg-secondary/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-secondary-foreground">
            {w.difficulty}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onSpeak(`daily-${w.id}`, w.word)}
            aria-label={t("Listen")}
            className={
              playingKey === `daily-${w.id}`
                ? "bg-success text-success-foreground hover:bg-success/90"
                : ""
            }
          >
            <Volume2 className="size-4" />
          </Button>
          {showActions && (
            <Button
              variant="ghost"
              size="icon"
              disabled={Boolean(checkingId)}
              onClick={() => onTogglePronunciation(w)}
              aria-label={
                isRecording ? t("Stop and check pronunciation") : t("Test your pronunciation")
              }
              title={isRecording ? t("Stop and check pronunciation") : t("Test your pronunciation")}
              className={
                isRecording ? "bg-destructive text-destructive-foreground hover:bg-destructive" : ""
              }
            >
              {isChecking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isRecording ? (
                <Square className="size-4" />
              ) : (
                <Mic className="size-4" />
              )}
            </Button>
          )}
        </div>
      </div>
      {hidden ? (
        <div className="mt-3 rounded-xl border border-dashed border-primary/20 bg-primary/[0.035] p-3.5 text-center transition-colors">
          <p className="text-xs text-muted-foreground">
            {t("Try to remember what it means, then check.")}
          </p>
          <Button
            variant="outline"
            className="mt-2 min-h-10 w-full rounded-xl border-primary/20 bg-background/70 text-sm transition-all hover:border-primary/40 hover:bg-primary/[0.06]"
            onClick={() => setRevealed(true)}
          >
            <Eye className="size-4" /> {t("Show meaning")}
          </Button>
        </div>
      ) : (
        <>
          <div translate="no">
            <p className="mt-2 text-sm leading-relaxed">{w.meaning}</p>
            <p className="mt-1.5 text-xs font-medium tracking-wide text-muted-foreground">
              {w.pronunciation}
            </p>
            <p className="mt-2.5 rounded-xl border border-border/50 bg-secondary/45 px-3 py-2 text-xs leading-relaxed italic text-muted-foreground line-clamp-2">
              "{highlightWord(w.example, w.word)}"
            </p>
          </div>
          {!showActions && backIn !== null && (
            <p className="mt-2 text-xs text-muted-foreground">
              {backIn <= 0 ? (
                t("Review due")
              ) : (
                <>
                  <span>{t("Back for review in")}</span> <span>{backIn}</span>{" "}
                  <span>{backIn === 1 ? t("day") : t("days")}</span>
                </>
              )}
            </p>
          )}
          {showActions && !isKnown && (
            <div className="mt-3 flex gap-2 border-t border-border/50 pt-3">
              <Button
                size="sm"
                className="min-h-10 flex-1 rounded-xl text-sm shadow-sm"
                disabled={locked}
                onClick={() => onMarkKnown(w.id)}
              >
                <Check className="size-4" /> {t("I know it")}
              </Button>
              {(due || onSkip) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-10 flex-1 rounded-xl text-sm"
                  disabled={locked}
                  onClick={() => (due ? onMarkForgotten(w.id) : onSkip?.())}
                >
                  <X className="size-4" /> {t("Not yet")}
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </article>
  );
}

/**
 * One list of vocabulary cards (review, today or learned). Defined at module
 * level so React keeps the cards mounted between renders of the page.
 */
export function VocabularyWordList({
  items,
  showActions = true,
  highlightKnown = false,
  ...ctx
}: VocabularyListContext & {
  items: Word[];
  showActions?: boolean;
  highlightKnown?: boolean;
}) {
  if (items.length === 0)
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        {ctx.t("Nothing here yet — keep practicing.")}
      </p>
    );
  return (
    <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
      {items.map((w) => (
        <WordCard
          key={w.id}
          w={w}
          showActions={showActions}
          highlightKnown={highlightKnown}
          {...ctx}
        />
      ))}
    </div>
  );
}

/**
 * Review session (owner request, 2026-11-02): one word at a time, from the
 * words whose review is due and today's open words, frozen when the session
 * starts so rating a word never skips the next one. Each word is remembered,
 * revealed and rated; "Not yet" on a new word just moves on. The end shows a
 * done seal and, when lesson cards are due, the way to them.
 */
export function VocabularySession({
  queue,
  cardsDue,
  onClose,
  ...ctx
}: VocabularyListContext & {
  queue: Word[];
  cardsDue: number;
  onClose: () => void;
}) {
  const { t } = ctx;
  const [index, setIndex] = useState(0);
  const [rated, setRated] = useState(0);
  const done = index >= queue.length;
  const next = () => setIndex((i) => i + 1);
  const word = queue[index];

  if (done || !word)
    return (
      <section className="card-soft mt-4 flex flex-col items-center gap-2 p-6 text-center">
        <DoneSeal />
        <h2 className="font-display text-base font-semibold">{t("Review done")}</h2>
        <p className="text-sm text-muted-foreground">
          <span>{t("Words you knew")}</span>: <span>{rated}</span> <span>/</span>{" "}
          <span>{queue.length}</span>
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {cardsDue > 0 && (
            <Button asChild size="sm">
              <Link to="/learning/review">
                <Layers className="size-4" /> {t("Review cards")} <span>({cardsDue})</span>
              </Link>
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onClose}>
            {t("Back to the list")}
          </Button>
        </div>
      </section>
    );

  return (
    <section className="mt-4" aria-label={t("Review session")}>
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          <span>{t("Word")}</span> <span>{index + 1}</span> <span>/</span>{" "}
          <span>{queue.length}</span>
        </span>
        <button type="button" onClick={onClose} className="hover:text-foreground">
          {t("End review")}
        </button>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-[oklch(0.62_0.18_300)] transition-all"
          style={{ width: `${Math.round((index / queue.length) * 100)}%` }}
        />
      </div>
      <div className="mx-auto mt-4 max-w-xl">
        <WordCard
          key={word.id}
          w={word}
          className="p-5 xl:p-5"
          {...ctx}
          onMarkKnown={async (id) => {
            await ctx.onMarkKnown(id);
            setRated((n) => n + 1);
            next();
          }}
          onMarkForgotten={async (id) => {
            await ctx.onMarkForgotten(id);
            next();
          }}
          onSkip={next}
          // A passed pronunciation also knows the word: on to the next one
          // (owner request, 2026-11-02), as the "Next word!" toast says.
          onTogglePronunciation={async (w) => {
            if (await ctx.onTogglePronunciation(w)) {
              setRated((n) => n + 1);
              next();
            }
          }}
        />
        <button
          type="button"
          onClick={next}
          className="mx-auto mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {t("Skip")} <ArrowRight className="size-3.5" aria-hidden />
        </button>
      </div>
    </section>
  );
}
