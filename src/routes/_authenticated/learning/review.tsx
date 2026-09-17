import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, RotateCcw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { FlashcardDeck } from "@/components/FlashcardDeck";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserFlashcards, useUserLessons, type Flashcard } from "@/hooks/useLearning";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/learning/review")({
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · Smart review" },
      { name: "description", content: "Review your hardest English words first with spaced repetition." },
      { property: "og:title", content: "Evoluir+ English AI · Smart review" },
      { property: "og:description", content: "Spaced repetition review of your English flashcards." },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const { data: profile } = useProfile();
  const { data: states } = useUserFlashcards();
  const { data: userLessons } = useUserLessons();

  const queryClient = useQueryClient();
  const [round, setRound] = useState(0);

  const { data: cards, isLoading } = useQuery({
    queryKey: ["all-flashcards"],
    queryFn: async (): Promise<Flashcard[]> => {
      const { data } = await supabase.from("flashcards").select("*").order("sort_order").order("created_at");
      return (data ?? []) as Flashcard[];
    },
  });

  const today = new Date().toISOString().slice(0, 10);

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
        <Link to="/learning" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Learning Center
        </Link>

        <header>
          <p className="text-sm text-muted-foreground">Smart review</p>
          <h1 className="text-3xl font-bold">Your hardest words first</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Cards you rate as <strong>Hard</strong> come back tomorrow, <strong>Medium</strong> in a few days and{" "}
            <strong>Easy</strong> much later.
          </p>
        </header>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : queue.length === 0 ? (
          <p className="card-soft p-6 text-sm text-muted-foreground">
            <Sparkles className="mb-2 size-5" /> No cards yet — open a lesson to start building your deck.
          </p>
        ) : (
          <FlashcardDeck
            key={round}
            cards={queue}
            userId={profile?.id}
            states={states ?? []}
            onRated={() => {
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
