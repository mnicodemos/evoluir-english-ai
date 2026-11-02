import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Repeat, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { AppShell } from "@/components/AppShell";
import { FlashcardDeck } from "@/components/FlashcardDeck";
import { Skeleton } from "@/components/ui/skeleton";
import { useDueReviewState } from "@/hooks/useDueReviewCount";
import { useUserFlashcards, useUserLessons, type Flashcard } from "@/hooks/useLearning";
import { useProfile } from "@/hooks/useProfile";
import { useLogTimeOnExit, useTimeSpent } from "@/hooks/useTimeSpent";

import { supabase } from "@/integrations/supabase/client";
import { isFlashcardDue, lessonStarted } from "@/lib/flashcards";
import { studyToday } from "@/lib/today";

export const Route = createFileRoute("/_authenticated/learning/review")({
  head: () => ({
    meta: [
      { title: "Smart review - Evoluir+ English AI" },
      {
        name: "description",
        content: "Review your hardest English words first with spaced repetition.",
      },
      { property: "og:title", content: "Smart review - Evoluir+ English AI" },
      {
        property: "og:description",
        content: "Spaced repetition review of your English flashcards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const { data: profile } = useProfile();
  const { data: states } = useUserFlashcards();
  const { data: userLessons } = useUserLessons();
  const minutesSpent = useTimeSpent();
  // Time on this page counts only once a card was rated (audit, 2026-10-24:
  // opening the deck and leaving added minutes without any review).
  const [ratedCount, setRatedCount] = useState(0);
  useLogTimeOnExit({
    timer: minutesSpent,
    profile: ratedCount > 0 ? profile : null,
    type: "flashcards",
    title: "Flashcard review",
  });

  const queryClient = useQueryClient();
  const [round, setRound] = useState(0);
  // One word review (owner request, 2026-10-30): Vocabulary's words due are
  // the other part, one tap away.
  const { count: wordsDue } = useDueReviewState(profile?.id);

  const { data: cards, isLoading } = useQuery({
    queryKey: ["all-flashcards"],
    queryFn: async (): Promise<Flashcard[]> => {
      const { data } = await supabase
        .from("flashcards")
        .select("*")
        .order("sort_order")
        .order("created_at");
      return (data ?? []) as Flashcard[];
    },
  });

  const today = studyToday();

  const startedLessonIds = useMemo(
    () => new Set((userLessons ?? []).filter(lessonStarted).map((l) => l.lesson_id)),
    [userLessons],
  );

  const queue = useMemo(() => {
    // Only cards from lessons already opened (or already answered), and only the ones due today.
    // One rule with the Dashboard's count (isFlashcardDue).
    const list = (cards ?? []).filter((c) =>
      isFlashcardDue(
        c,
        (states ?? []).find((s) => s.flashcard_id === c.id),
        startedLessonIds,
        today,
      ),
    );
    const weight = (c: Flashcard) => {
      const s = (states ?? []).find((x) => x.flashcard_id === c.id);
      if (!s) return c.difficulty === "hard" ? 0 : c.difficulty === "medium" ? 1 : 2;
      return s.mastery_level / 25;
    };
    return [...list].sort((a, b) => weight(a) - weight(b));
  }, [cards, states, today, startedLessonIds]);

  // The round's cards are fixed when it starts: each rating refreshes the
  // states and a rated card leaves the due list, which used to shift the deck
  // and skip the next card (audit, 2026-10-30).
  const [frozen, setFrozen] = useState<Flashcard[] | null>(null);
  const ready =
    !isLoading && cards !== undefined && states !== undefined && userLessons !== undefined;
  useEffect(() => {
    if (frozen === null && ready) setFrozen(queue);
  }, [frozen, ready, queue]);
  const roundCards = frozen ?? queue;

  return (
    <AppShell>
      <div className="space-y-6">
        <Link
          to="/learning"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Learning Center
        </Link>

        <PageHeader
          guide="vocabulary"
          icon={Repeat}
          accent="vocabulary"
          eyebrow={<>Word review</>}
          title={<>Your hardest words first</>}
          description={
            <>
              Cards marked <strong>Again</strong> come back in this round and tomorrow;{" "}
              <strong>Hard</strong> and <strong>Easy</strong> move them further ahead.
            </>
          }
        />

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : roundCards.length === 0 ? (
          <p className="card-soft p-6 text-sm text-muted-foreground">
            <Sparkles className="mb-2 size-5" /> No cards yet — open a lesson to start building your
            deck.
          </p>
        ) : (
          <FlashcardDeck
            key={round}
            cards={roundCards}
            level={profile?.level}
            userId={profile?.id}
            states={states ?? []}
            onRated={() => {
              setRatedCount((count) => count + 1);
              queryClient.invalidateQueries({ queryKey: ["user-flashcards"] });
              queryClient.invalidateQueries({ queryKey: ["study-snapshot"] });
            }}
            onFinished={() => {
              queryClient.invalidateQueries({ queryKey: ["user-flashcards"] });
              queryClient.invalidateQueries({ queryKey: ["study-snapshot"] });
            }}
          />
        )}

        {wordsDue > 0 && (
          <Link
            to="/vocabulary"
            className="flex items-center justify-between gap-3 rounded-xl border border-brand-green/35 bg-brand-green/[0.07] p-3 text-sm font-medium hover:bg-brand-green/10"
          >
            <span>
              <span>Words to review</span> <span>({wordsDue})</span>
              <span className="block text-xs font-normal text-muted-foreground">
                The other part of your word review, in Vocabulary.
              </span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-brand-green" aria-hidden="true" />
          </Link>
        )}

        <button
          type="button"
          onClick={() => {
            setFrozen(null);
            setRound((r) => r + 1);
          }}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-4" /> Start a new round
        </button>
      </div>
    </AppShell>
  );
}
