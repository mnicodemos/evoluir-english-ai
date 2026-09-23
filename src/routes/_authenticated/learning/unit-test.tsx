import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Trophy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/AppShell";
import { LessonQuiz } from "@/components/LessonQuiz";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLearningPath, useOpenUnitTest } from "@/hooks/useCurriculum";
import { completeLesson, useLesson } from "@/hooks/useLearning";
import { useProfile } from "@/hooks/useProfile";
import { useLogTimeOnExit, useTimeSpent } from "@/hooks/useTimeSpent";
import { persistQuizLegacy } from "@/lib/legacyActivity.functions";
import { LESSON_QUIZ_PASS_SCORE } from "@/lib/quizCompletion";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { refreshAfterActivity } from "@/lib/refreshKeys";

const searchSchema = z.object({ unit: z.coerce.number().int().min(1).max(5).catch(1) });

export const Route = createFileRoute("/_authenticated/learning/unit-test")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · Unit Final Test" },
      {
        name: "description",
        content:
          "Take the integrated Final Test of the unit and show you can use every lesson together.",
      },
      { property: "og:title", content: "Evoluir+ English AI · Unit Final Test" },
      {
        property: "og:description",
        content: "One integrated test that combines the six lessons of the unit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UnitTestPage,
});

function UnitTestPage() {
  const { lang } = useUiLang();
  const t = (text: string) => (lang === "pt" ? (uiPt[text] ?? text) : text);
  const { unit } = Route.useSearch();
  const path = useLearningPath();
  const { data: profile } = useProfile();
  const openTest = useOpenUnitTest();
  const queryClient = useQueryClient();
  const minutesSpent = useTimeSpent();
  const saveQuizLegacy = useServerFn(persistQuizLegacy);
  useLogTimeOnExit({
    timer: minutesSpent,
    profile,
    type: "lesson_practice",
    title: `Unit ${unit} final test`,
  });

  const state = path.unitTests.find((test) => test.unit === unit);
  const [lessonId, setLessonId] = useState<string | null>(state?.lessonId ?? null);
  const id = lessonId ?? state?.lessonId ?? null;
  const { data } = useLesson(id ?? "");

  const start = async () => {
    try {
      const result = await openTest.mutateAsync({ level: path.level, unit });
      setLessonId(result.lessonId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Could not open the Final Test."));
    }
  };

  const finish = async (score: number, attemptKey: string) => {
    if (!profile || !id) return;
    await saveQuizLegacy({
      data: { attemptKey, activityType: "lesson", minutes: minutesSpent(1) },
    });

    if (score < LESSON_QUIZ_PASS_SCORE) {
      queryClient.invalidateQueries({ queryKey: ["quiz-results"] });
      toast.info(
        lang === "pt"
          ? `Você fez ${score}%. É necessário ${LESSON_QUIZ_PASS_SCORE}% — revise a unidade e refaça o teste.`
          : `You scored ${score}%. You need ${LESSON_QUIZ_PASS_SCORE}% — review the unit and take it again.`,
      );
      return;
    }

    await completeLesson(profile.id, id);
    await refreshAfterActivity(queryClient);
    toast.success(
      lang === "pt"
        ? `Unidade ${unit} concluída com ${score}%!`
        : `Unit ${unit} completed with ${score}%!`,
    );
  };

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
          <p className="text-sm text-muted-foreground">
            <span>{lang === "pt" ? `Unidade ${unit}` : `Unit ${unit}`}</span> ·{" "}
            <span className="uppercase">{path.level}</span>
          </p>
          <h1 className="mt-1 text-3xl font-bold">
            {lang === "pt" ? "Teste Final da Unidade" : "Unit Final Test"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {lang === "pt"
              ? `Questões que juntam as seis lições da unidade. ${LESSON_QUIZ_PASS_SCORE}% ou mais para concluir.`
              : `Questions that combine the six lessons of this unit. ${LESSON_QUIZ_PASS_SCORE}% or more to pass.`}
          </p>
        </header>

        {!state?.unlocked ? (
          <div className="card-soft p-6 text-sm text-muted-foreground">
            {lang === "pt"
              ? "Conclua as seis lições desta unidade para liberar o Teste Final da Unidade."
              : "Finish the six lessons of this unit to unlock its Final Test."}
          </div>
        ) : !id ? (
          <div className="card-soft space-y-4 p-6">
            <span className="grid size-12 place-items-center rounded-xl bg-accent">
              <Trophy className="size-6 text-accent-foreground" />
            </span>
            <p className="text-sm text-muted-foreground">
              {lang === "pt"
                ? "A IA vai escrever o seu teste agora. Faça em uma única sessão."
                : "The AI will write your test now. Take it in one sitting."}
            </p>
            <Button onClick={() => void start()} disabled={openTest.isPending}>
              {openTest.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trophy className="size-4" />
              )}
              {lang === "pt" ? "Começar o teste" : "Start unit test"}
            </Button>
          </div>
        ) : !data ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <LessonQuiz questions={data.quiz} userId={profile?.id} lessonId={id} onFinished={finish} />
        )}
      </div>
    </AppShell>
  );
}
