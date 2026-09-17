import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, Layers, ListChecks, MessageSquareText, Video } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { FlashcardDeck } from "@/components/FlashcardDeck";
import { LessonQuiz } from "@/components/LessonQuiz";
import { LessonVideo } from "@/components/LessonVideo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { completeLesson, saveVideoProgress, useLesson, useUserFlashcards } from "@/hooks/useLearning";
import { logActivity, useProfile } from "@/hooks/useProfile";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useLogTimeOnExit, useTimeSpent } from "@/hooks/useTimeSpent";


export const Route = createFileRoute("/_authenticated/learning/$lessonId")({
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · Lesson" },
      { name: "description", content: "Watch the video, review the flashcards and take the quiz of this lesson." },
      { property: "og:title", content: "Evoluir+ English AI · Lesson" },
      { property: "og:description", content: "Video, summary, flashcards and quiz in one English lesson." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LessonPage,
});

function LessonPage() {
  const { lessonId } = Route.useParams();
  const { data, isLoading } = useLesson(lessonId);
  const { data: profile } = useProfile();
  const { data: cardStates } = useUserFlashcards();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const minutesSpent = useTimeSpent();
  useLogTimeOnExit({ timer: minutesSpent, profile, type: "lesson_practice", title: "Lesson practice" });

  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  // Remember which tab the user was on so leaving mid-lesson brings them back.
  const [activeTab, setActiveTab] = usePersistentState<string>(`lesson-tab:${lessonId}`, "video");


  const lesson = data?.lesson;
  const progress = videoProgress ?? data?.userLesson?.video_progress ?? 0;

  async function handleProgress(percent: number) {
    setVideoProgress(percent);
    if (!profile) return;
    await saveVideoProgress(profile.id, lessonId, percent);
    queryClient.invalidateQueries({ queryKey: ["user-lessons"] });
    queryClient.invalidateQueries({ queryKey: ["study-snapshot"] });
  }

  async function finishLesson(score: number) {
    if (!profile) return;
    // A lesson only counts as completed with a quiz score of 70% or more.
    if (score < 70) {
      toast.info("Score below 70%. Review the lesson and retake the quiz to complete it.");
      return;
    }
    await completeLesson(profile.id, lessonId);
    // Lessons do not feed the Your progress bars: each bar comes from its own
    // module (Listening Lab, Vocabulary, AI Talking, Writing AI Corrector).
    await logActivity({
      userId: profile.id,
      type: "lesson",
      title: `Lesson: ${lesson?.title ?? ""}`,
      minutes: minutesSpent(1),
      score,
      currentStreak: profile.streak_days,
      lastDate: profile.last_activity_date,
    });
    queryClient.invalidateQueries({ queryKey: ["user-lessons"] });
    queryClient.invalidateQueries({ queryKey: ["quiz-results"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    queryClient.invalidateQueries({ queryKey: ["study-snapshot"] });
    queryClient.invalidateQueries({ queryKey: ["minutes-today"] });
    toast.success(`Lesson completed with ${score}%`);
  }

  if (isLoading || !lesson) {
    return (
      <AppShell>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">This lesson was not found.</p>
        )}
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <Link to="/learning" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Learning Center
        </Link>

        <header className="animate-rise">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full bg-secondary px-2.5 py-1 capitalize text-foreground/70">{lesson.category}</span>
            <span className="rounded-full bg-secondary px-2.5 py-1 capitalize text-foreground/70">{lesson.level}</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold">{lesson.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{lesson.objective}</p>
        </header>

        {data.userLesson?.completed_at && (
          <section className="card-soft flex flex-wrap items-center justify-between gap-3 border-success/40 bg-success/10 p-5">
            <div>
              <p className="text-sm font-semibold">Lesson completed</p>
              <p className="text-xs text-muted-foreground">
                Everything you did is saved. Want to practise again? Redo the flashcards or the quiz.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setActiveTab("flashcards")}>
                <Layers className="size-4" /> Flashcards
              </Button>
              <Button variant="outline" size="sm" onClick={() => setActiveTab("quiz")}>
                <ListChecks className="size-4" /> Quiz
              </Button>
            </div>
          </section>
        )}


        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="video" className="gap-1.5">
              <Video className="size-4" /> <span className="hidden sm:inline">Video</span>
            </TabsTrigger>
            <TabsTrigger value="summary" className="gap-1.5">
              <BookOpen className="size-4" /> <span className="hidden sm:inline">Summary</span>
            </TabsTrigger>
            <TabsTrigger value="flashcards" className="gap-1.5">
              <Layers className="size-4" /> <span className="hidden sm:inline">Flashcards</span>
            </TabsTrigger>
            <TabsTrigger value="quiz" className="gap-1.5">
              <ListChecks className="size-4" /> <span className="hidden sm:inline">Quiz</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="video" className="mt-5 space-y-4">
            <LessonVideo url={lesson.video_url} progress={progress} onProgress={handleProgress} />
            <p className="text-xs text-muted-foreground">
              Turn on the video subtitles (CC) to follow along while you watch.
            </p>
          </TabsContent>

          <TabsContent value="summary" className="mt-5">
            <div className="card-soft space-y-4 p-6">
              <h2 className="text-lg font-semibold">Lesson summary</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{lesson.summary}</p>
              <h3 className="pt-2 text-sm font-semibold">Key vocabulary</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.flashcards.map((f) => (
                  <li key={f.id} className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                    <strong>{f.word}</strong> — {f.answer || f.definition || f.example}
                  </li>
                ))}
              </ul>
            </div>
          </TabsContent>

          <TabsContent value="flashcards" className="mt-5">
            <FlashcardDeck
              cards={data.flashcards}
              userId={profile?.id}
              storageKey={profile?.id ? `lesson-cards:${profile.id}:${lessonId}` : null}
              states={cardStates ?? []}
              onRated={() => {
                queryClient.invalidateQueries({ queryKey: ["user-flashcards"] });
                queryClient.invalidateQueries({ queryKey: ["study-snapshot"] });
              }}
              onFinished={() => {
                queryClient.invalidateQueries({ queryKey: ["user-flashcards"] });
                queryClient.invalidateQueries({ queryKey: ["study-snapshot"] });
              }}
            />
          </TabsContent>

          <TabsContent value="quiz" className="mt-5">
            <LessonQuiz
              questions={data.quiz}
              userId={profile?.id}
              lessonId={lessonId}
              onFinished={finishLesson}
            />
          </TabsContent>
        </Tabs>

        <section className="card-soft bg-primary p-6 text-primary-foreground">
          <p className="text-sm text-primary-foreground/75">Practice with AI Talking</p>
          <h2 className="mt-1 text-xl font-semibold">Use what you just learned in a real conversation</h2>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => navigate({ to: "/coach", search: { lesson: lesson.title } })}
          >
            <MessageSquareText className="size-4" /> Start guided practice
          </Button>
        </section>
      </div>
    </AppShell>
  );
}
