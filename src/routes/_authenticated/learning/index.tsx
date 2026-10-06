import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, RotateCcw } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { CurriculumPath } from "@/components/LearningPathCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useLessons } from "@/hooks/useLearning";
import { useProfile } from "@/hooks/useProfile";
import { LEVELS, findLevel, isReviewLevel } from "@/lib/level";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/learning/")({
  // ?review=a2 opens an earlier level for review; the student's level stays.
  validateSearch: (search: Record<string, unknown>): { review?: string } =>
    typeof search["review"] === "string" ? { review: search["review"] } : {},
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · Learning Center" },
      {
        name: "description",
        content: "A structured English course of 33 lessons in 6 units for your CEFR level.",
      },
      { property: "og:title", content: "Evoluir+ English AI · Learning Center" },
      {
        property: "og:description",
        content: "33 lessons in 6 units with videos, flashcards, quizzes and review.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LearningCenter,
});

function LearningCenter() {
  const { isLoading } = useLessons();
  const { data: profile } = useProfile();
  const { review } = Route.useSearch();

  const current = findLevel(profile?.level);
  const highest = findLevel(profile?.max_level || profile?.level);
  // Only levels already conquered (below the highest reached) can be reviewed.
  const reviewLevels = LEVELS.filter(
    (level) => level !== current && isReviewLevel(level.value, highest.value),
  );
  const reviewLevel =
    review && reviewLevels.some((level) => level.value === review) ? findLevel(review) : null;

  const tab =
    "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60";

  return (
    <AppShell>
      <div className="space-y-5 lg:space-y-4">
        <header className="animate-rise">
          <p className="text-sm text-muted-foreground">Learning Center</p>
          <h1 className="text-3xl font-bold">
            {reviewLevel ? <span>Review an earlier level</span> : <span>Your learning path</span>}
          </h1>
          {reviewLevel ? (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              <span>Reviewing</span> <span>{reviewLevel.label}</span>. <span>Your level stays</span>{" "}
              <span>{current.value.toUpperCase()}</span>
              <span>: AI practice, words and the weekly league are not affected.</span>
            </p>
          ) : (
            <p className="mt-2 max-w-xl text-sm text-muted-foreground lg:hidden">
              A complete course for your level: 30 core lessons plus 3 optional review lessons, with
              video, summary, flashcards, quiz and guided practice. Each lesson unlocks when you
              finish the one before it.
            </p>
          )}

          {profile && reviewLevels.length > 0 && (
            <nav className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Levels">
              <Link
                to="/learning"
                search={{}}
                aria-current={!reviewLevel ? "page" : undefined}
                className={cn(
                  tab,
                  !reviewLevel
                    ? "border-transparent bg-brand-green text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <span>My level</span> · <span>{current.value.toUpperCase()}</span>
              </Link>
              <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <RotateCcw className="size-3.5" aria-hidden="true" />
                <span>Review</span>
              </span>
              {reviewLevels.map((level) => {
                const active = reviewLevel?.value === level.value;
                return (
                  <Link
                    key={level.value}
                    to="/learning"
                    search={{ review: level.value }}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      tab,
                      active
                        ? "border-brand-green/60 bg-brand-green/15 text-brand-green"
                        : "border-brand-green/25 text-brand-green/85 hover:border-brand-green/60 hover:bg-brand-green/10",
                    )}
                  >
                    <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                    {level.value.toUpperCase()}
                  </Link>
                );
              })}
            </nav>
          )}
        </header>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : (
          <CurriculumPath
            key={reviewLevel?.value ?? "mine"}
            reviewLevel={reviewLevel?.value ?? null}
          />
        )}
      </div>
    </AppShell>
  );
}
