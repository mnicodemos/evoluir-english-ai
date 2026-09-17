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
        content: "A structured English course of 33 lessons in 6 units for your CEFR level.",
      },
      { property: "og:title", content: "Evoluir+ English AI · Learning Center" },
      { property: "og:description", content: "33 lessons in 6 units with videos, flashcards, quizzes and review." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LearningCenter,
});

function LearningCenter() {
  const { isLoading } = useLessons();



  return (
    <AppShell>
      <div className="space-y-5 lg:space-y-6">
        <header className="animate-rise">
          <p className="text-sm text-muted-foreground">Learning Center</p>
          <h1 className="text-3xl font-bold">Your learning path</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            A complete course for your level: 30 core lessons plus 3 optional review lessons, with video, summary,
            flashcards, quiz and guided practice. Each lesson unlocks when you finish the one before it.
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
