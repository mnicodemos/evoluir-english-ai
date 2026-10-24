import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Repeat, RotateCcw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { AppShell } from "@/components/AppShell";
import { FlashcardDeck } from "@/components/FlashcardDeck";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserFlashcards, useUserLessons, type Flashcard } from "@/hooks/useLearning";
import { useProfile } from "@/hooks/useProfile";
import { useLogTimeOnExit, useTimeSpent } from "@/hooks/useTimeSpent";

import { supabase } from "@/integrations/supabase/client";
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
    () =>
      new Set(
        (userLessons ?? [])
          .filter((l) => l.video_progress > 0 || l.progress > 0 || l.completed_at)
          .map((l) => l.lesson_id),
      ),
    [userLessons],
  );

  const queue = useMemo(() => {
    // Only cards from lessons already opened (or already answered), and only the ones due today.
    const list = (cards ?? []).filter((c) => {
      const state = (states ?? []).find((s) => s.flashcard_id === c.id);
      const unlocked = !c.lesson_id || startedLessonIds.has(c.lesson_id) || Boolean(state);
      if (!unlocked) return false;
      return !state || state.next_review_date <= today;
    });
    const weight = (c: Flashcard) => {
      const s = (states ?? []).find((x) => x.flashcard_id === c.id);
      if (!s) return c.difficulty === "hard" ? 0 : c.difficulty === "medium" ? 1 : 2;
      return s.mastery_level / 25;
    };
    return [...list].sort((a, b) => weight(a) - weight(b));
  }, [cards, states, today, startedLessonIds]);

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
          icon={Repeat}
          accent="violet"
          eyebrow={<>Smart review</>}
          title={<>Your hardest words first</>}
          description={
            <>
              Cards marked as <strong>Incorrect</strong> come back sooner. Cards marked as{" "}
              <strong>Correct</strong> move forward.
            </>
          }
        />

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : queue.length === 0 ? (
          <p className="card-soft p-6 text-sm text-muted-foreground">
            <Sparkles className="mb-2 size-5" /> No cards yet — open a lesson to start building your
            deck.
          </p>
        ) : (
          <FlashcardDeck
            key={round}
            cards={queue}
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

        <button
          type="button"
          onClick={() => setRound((r) => r + 1)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-4" /> Start a new round
        </button>
      </div>
    </AppShell>
  );
}
