import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Circle,
  Layers,
  ListChecks,
  MessageSquareText,
  Video,
} from "lucide-react";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { EvoGuide } from "@/components/EvoGuide";
import { FlashcardDeck } from "@/components/FlashcardDeck";
import { LessonQuiz } from "@/components/LessonQuiz";
import { LessonVideo } from "@/components/LessonVideo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  completeLesson,
  saveVideoProgress,
  useLesson,
  useUserFlashcards,
} from "@/hooks/useLearning";
import { useLessonRound } from "@/hooks/useLessonRound";
import { useProfile } from "@/hooks/useProfile";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useLogTimeOnExit, useTimeSpent } from "@/hooks/useTimeSpent";
import { vocabularyGenerationFailureKey } from "@/lib/activityIndicators";
import { persistQuizLegacy } from "@/lib/legacyActivity.functions";
import { lessonChecklist } from "@/lib/lessonChecklist";
import { buildLessonGuide } from "@/lib/lessonGuide";
import { formatVideoDuration, videoReviewPoints } from "@/lib/lessonVideoDisplay";
import { finalizeLessonQuiz, lessonCompletionUnlocksVocabulary } from "@/lib/quizCompletion";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { dailyWords } from "@/lib/vocabularyPlan.functions";

export const Route = createFileRoute("/_authenticated/learning/$lessonId")({
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · Lesson" },
      {
        name: "description",
        content: "Watch the video, review the flashcards and take the quiz of this lesson.",
      },
      { property: "og:title", content: "Evoluir+ English AI · Lesson" },
      {
        property: "og:description",
        content: "Video, summary, flashcards and quiz in one English lesson.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LessonPage,
});

function LessonPage() {
  const { lessonId } = Route.useParams();
  const { lang } = useUiLang();
  const t = (text: string) => (lang === "pt" ? (uiPt[text] ?? text) : text);
  const { data, isLoading } = useLesson(lessonId);
  const { data: profile } = useProfile();
  const { data: lessonRound } = useLessonRound();
  const { data: cardStates } = useUserFlashcards();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const minutesSpent = useTimeSpent();
  const saveQuizLegacy = useServerFn(persistQuizLegacy);
  const generateVocabulary = useServerFn(dailyWords);
  useLogTimeOnExit({
    timer: minutesSpent,
    profile,
    type: "lesson_practice",
    title: "Lesson practice",
  });

  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  // Remember which tab the user was on so leaving mid-lesson brings them back.
  const [activeTab, setActiveTab] = usePersistentState<string>(`lesson-tab:${lessonId}`, "video");

  const lesson = data?.lesson;
  // Reinforcement copy comes from the lesson text that already exists.
  const reviewPoints = videoReviewPoints(lesson?.summary);
  const videoLength = formatVideoDuration(lesson?.video_duration_seconds);
  const progress = videoProgress ?? data?.userLesson?.video_progress ?? 0;
  const lessonSkill = lesson?.skill
    ? t(lesson.skill.charAt(0).toUpperCase() + lesson.skill.slice(1))
    : null;

  // The Learning Guide is built from lesson content already stored — no AI call.
  const guide = buildLessonGuide(
    {
      title: lesson?.title ?? "",
      objective: lesson?.objective ?? "",
      summary: lesson?.summary ?? "",
      skill: lesson?.skill,
      level: lesson?.level,
    },
    data?.flashcards ?? [],
  );

  const cardIds = new Set((data?.flashcards ?? []).map((card) => card.id));
  const reviewedCards = (cardStates ?? []).filter(
    (state) => cardIds.has(state.flashcard_id) && state.times_reviewed > 0,
  ).length;
  const checklist = lessonChecklist({
    hasVideo: !!lesson?.video_url,
    videoWatched: progress >= 100,
    cardsTotal: data?.flashcards.length ?? 0,
    cardsReviewed: reviewedCards,
    quizPassed: !!data?.userLesson?.completed_at,
  });

  async function handleProgress(percent: number) {
    setVideoProgress(percent);
    if (!profile) return;
    await saveVideoProgress(profile.id, lessonId, percent);
    queryClient.invalidateQueries({ queryKey: ["user-lessons"] });
    queryClient.invalidateQueries({ queryKey: ["study-snapshot"] });
  }

  async function finishLesson(score: number, attemptKey: string) {
    if (!profile) return;
    const wasAlreadyCompleted = !!data?.userLesson?.completed_at;
    const result = await finalizeLessonQuiz(score, {
      persistLegacy: async () => {
        // Lessons do not feed the Your progress bars: each bar comes from its own
        // module (Listening Lab, Vocabulary, AI Talking, Writing AI Corrector).
        await saveQuizLegacy({
          data: { attemptKey, activityType: "lesson", minutes: minutesSpent(1) },
        });
      },
      completeLesson: async () => completeLesson(profile.id, lessonId),
    });
    // A lesson only counts as completed with a quiz score of 70% or more.
    if (!result.passed) {
      queryClient.invalidateQueries({ queryKey: ["quiz-results"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["study-snapshot"] });
      queryClient.invalidateQueries({ queryKey: ["minutes-today"] });
      toast.info("Score below 70%. Review the lesson and retake the quiz to complete it.");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["user-lessons"] });
    queryClient.invalidateQueries({ queryKey: ["quiz-results"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    queryClient.invalidateQueries({ queryKey: ["study-snapshot"] });
    queryClient.invalidateQueries({ queryKey: ["minutes-today"] });
    // A completed lesson unlocks a new vocabulary batch: refresh it right away.
    queryClient.invalidateQueries({ queryKey: ["lesson-round"] });
    queryClient.invalidateQueries({ queryKey: ["daily-words"] });
    queryClient.invalidateQueries({ queryKey: ["vocabulary"] });
    queryClient.invalidateQueries({ queryKey: ["lesson", lessonId] });

    toast.success(`Lesson completed with ${score}%`);

    // Only a newly completed lesson unlocks a batch. Generate it now so the
    // Dashboard can advertise saved words before Vocabulary is ever opened.
    if (lessonCompletionUnlocksVocabulary({ passed: result.passed, wasAlreadyCompleted })) {
      const unlockedRound = lessonRound === undefined ? null : lessonRound + 1;
      const failureKey =
        unlockedRound === null ? null : vocabularyGenerationFailureKey(profile.id, unlockedRound);
      try {
        const words = await generateVocabulary({ data: { level: profile.level } });
        if (failureKey) window.localStorage.removeItem(failureKey);
        if (words.length > 0) {
          await queryClient.invalidateQueries({ queryKey: ["vocabulary-batch-progress"] });
        }
      } catch {
        if (failureKey) window.localStorage.setItem(failureKey, "1");
        // Lesson completion remains authoritative. Vocabulary keeps its existing
        // manual retry path when generation is temporarily unavailable.
      }
    }
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
        <Link
          to="/learning"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Learning Center
        </Link>

        <header className="animate-rise">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full bg-secondary px-2.5 py-1 capitalize text-foreground/70">
              {lesson.category}
            </span>
            <span className="rounded-full bg-secondary px-2.5 py-1 capitalize text-foreground/70">
              {lesson.level}
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-bold">{lesson.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{lesson.objective}</p>
        </header>

        <EvoGuide
          title={
            lessonSkill
              ? t("Let's practise {skill} in a new context.").replace("{skill}", lessonSkill)
              : t("Let's practise this skill in a new context.")
          }
          imageSize="lesson"
          contrast="inverse"
          className="card-soft bg-primary p-4 sm:p-5"
        />

        {data.userLesson?.completed_at && (
          <section className="card-soft flex flex-wrap items-center justify-between gap-3 border-success/40 bg-success/10 p-5">
            <div>
              <p className="text-sm font-semibold">Lesson completed</p>
              <p className="text-xs text-muted-foreground">
                Everything you did is saved. Want to practise again? Redo the flashcards or the
                quiz.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setActiveTab("flashcards")}>
                <Layers className="size-4" /> Flashcards
              </Button>
              <Button variant="outline" size="sm" onClick={() => setActiveTab("quiz")}>
                <ListChecks className="size-4" /> Quiz
              </Button>
            </div>
          </section>
        )}

        {!data.userLesson?.completed_at && (
          <section className="card-soft space-y-3 p-5" aria-label={t("Lesson checklist")}>
            <p className="text-sm font-semibold">
              {lang === "pt" ? "O que falta nesta lição" : "What is left in this lesson"}
            </p>
            <ul className="space-y-2">
              {checklist.items.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-sm">
                  {item.done ? (
                    <CheckCircle2
                      className="size-4 shrink-0 text-[oklch(0.55_0.15_150)]"
                      aria-hidden="true"
                    />
                  ) : (
                    <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                  <span className={item.done ? "text-muted-foreground line-through" : ""}>
                    {t(item.label)}
                  </span>
                  <span className="sr-only">{item.done ? t("done") : t("still to do")}</span>
                </li>
              ))}
            </ul>
            {checklist.onlyVideoPending && (
              <p className="text-xs text-muted-foreground">
                {lang === "pt"
                  ? 'Você já fez o resto — só falta tocar em "Eu assisti" no vídeo.'
                  : 'You did everything else — only the "I watched it" button on the video is left.'}
              </p>
            )}
          </section>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="video" aria-label="Video" className="gap-1.5">
              <Video className="size-4" /> <span className="hidden sm:inline">Video</span>
            </TabsTrigger>
            <TabsTrigger value="summary" aria-label="Summary" className="gap-1.5">
              <BookOpen className="size-4" /> <span className="hidden sm:inline">Summary</span>
            </TabsTrigger>
            <TabsTrigger value="flashcards" aria-label="Flashcards" className="gap-1.5">
              <Layers className="size-4" /> <span className="hidden sm:inline">Flashcards</span>
            </TabsTrigger>
            <TabsTrigger value="quiz" aria-label="Quiz" className="gap-1.5">
              <ListChecks className="size-4" /> <span className="hidden sm:inline">Quiz</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="video" className="mt-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Video reinforcement</h2>
              <p className="text-sm text-muted-foreground">
                Watch this short explanation before you practise.
                {videoLength ? ` About ${videoLength}.` : ""}
              </p>
            </div>
            <LessonVideo url={lesson.video_url} progress={progress} onProgress={handleProgress} />
            <p className="text-xs text-muted-foreground">
              Turn on the video subtitles (CC) to follow along while you watch.
            </p>

            {reviewPoints.length > 0 && (
              <section className="card-soft space-y-2 p-5">
                <h3 className="text-sm font-semibold">What you just reviewed</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {reviewPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </section>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => setActiveTab("quiz")}>
                <ListChecks className="size-4" /> Now practise
              </Button>
              <Button size="sm" variant="outline" onClick={() => setActiveTab("flashcards")}>
                <Layers className="size-4" /> Review the flashcards
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="summary" className="mt-5">
            <div className="card-soft space-y-5 p-6">
              <div>
                <h2 className="text-lg font-semibold">
                  {lang === "pt" ? "Guia de Aprendizagem" : "Learning Guide"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {lang === "pt"
                    ? "Tudo o que você precisa desta lição, direto ao ponto."
                    : "Everything you need from this lesson, straight to the point."}
                </p>
              </div>
              {guide.map((section) => (
                <section key={section.id} className="space-y-2">
                  <h3 className="text-sm font-semibold">
                    <span aria-hidden="true">{section.emoji}</span> {t(section.title)}
                  </h3>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {section.items.map((item) => (
                      <li key={item} className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
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
          <h2 className="mt-1 text-xl font-semibold">
            Use what you just learned in a real conversation
          </h2>
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
