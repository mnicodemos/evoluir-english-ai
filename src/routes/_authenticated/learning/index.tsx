import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { CurriculumPath } from "@/components/LearningPathCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useLessons } from "@/hooks/useLearning";

export const Route = createFileRoute("/_authenticated/learning/")({
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · Learning Center" },
      {
        name: "description",
        content: "A structured English course of 30 lessons in 5 units for your CEFR level.",
      },
      { property: "og:title", content: "Evoluir+ English AI · Learning Center" },
      { property: "og:description", content: "30 lessons in 5 units with videos, flashcards and quizzes." },
    ],
  }),
  component: LearningCenter,
});

function LearningCenter() {
  const { isLoading } = useLessons();



  return (
    <AppShell>
      <div className="space-y-7">
        <header className="animate-rise">
          <p className="text-sm text-muted-foreground">Learning Center</p>
          <h1 className="text-3xl font-bold">Your learning path</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            A complete course for your level: 30 lessons in 5 units, with video, summary, flashcards, quiz and guided
            practice. Each lesson unlocks when you finish the one before it.
          </p>
        </header>


        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : (
          <CurriculumPath />
        )}
      </div>
    </AppShell>
  );
}
