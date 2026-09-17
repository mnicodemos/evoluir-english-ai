import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Trophy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { LessonQuiz } from "@/components/LessonQuiz";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useLearningPath, useOpenFinalTest } from "@/hooks/useCurriculum";
import { completeLesson, useLesson } from "@/hooks/useLearning";
import { logActivity, useProfile } from "@/hooks/useProfile";
import { useLogTimeOnExit, useTimeSpent } from "@/hooks/useTimeSpent";
import { FINAL_TEST_PASS, FINAL_TEST_QUESTIONS, nextLevel } from "@/lib/level";
import { useUiLang } from "@/lib/uiLang";
import { uiPt } from "@/lib/uiDictionary";

export const Route = createFileRoute("/_authenticated/learning/final-test")({
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · Final Test" },
      {
        name: "description",
        content: "Take the 30-question final test of your level and move up to the next CEFR level with 70% or more.",
      },
      { property: "og:title", content: "Evoluir+ English AI · Final Test" },
      { property: "og:description", content: "30 questions to close your level and unlock the next one." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FinalTestPage,
});

function FinalTestPage() {
  const { lang } = useUiLang();
  const t = (text: string) => (lang === "pt" ? uiPt[text] ?? text : text);
  const path = useLearningPath();
  const { data: profile } = useProfile();
  const openTest = useOpenFinalTest();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const minutesSpent = useTimeSpent();
  useLogTimeOnExit({ timer: minutesSpent, profile, type: "final_test_practice", title: "Final test practice" });

  const [lessonId, setLessonId] = useState<string | null>(path.finalTest.lessonId);
  const [promoting, setPromoting] = useState(false);
  const id = lessonId ?? path.finalTest.lessonId;
  const { data } = useLesson(id ?? "");

  const upcoming = nextLevel(path.level);

  const start = async () => {
    try {
      const result = await openTest.mutateAsync(path.level);
      setLessonId(result.lessonId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Could not open the Final Test."));
    }
  };

  const finish = async (score: number) => {
    if (!profile || !id) return;
    await logActivity({
      userId: profile.id,
      type: "final_test",
      title: `Final Test ${path.level.toUpperCase()}`,
      minutes: minutesSpent(1),
      score,
      
      currentStreak: profile.streak_days,
      lastDate: profile.last_activity_date,
    });

    if (score < FINAL_TEST_PASS) {
      queryClient.invalidateQueries({ queryKey: ["quiz-results"] });
      toast.info(
        lang === "pt"
          ? `Você fez ${score}%. É necessário ${FINAL_TEST_PASS}% para avançar — revise e refaça o teste.`
          : `You scored ${score}%. You need ${FINAL_TEST_PASS}% to move up — review and take the test again.`,
      );
      return;
    }

    await completeLesson(profile.id, id);

    if (!upcoming) {
      toast.success(
        lang === "pt"
          ? `Você passou com ${score}%. Você está no nível máximo do CEFR!`
          : `You passed with ${score}%. You are at the top CEFR level!`,
      );
      queryClient.invalidateQueries();
      return;
    }

    setPromoting(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ level: upcoming.value, max_level: upcoming.value })
        .eq("id", profile.id);
      if (error) throw error;
      queryClient.invalidateQueries();
      toast.success(lang === "pt" ? `Você passou com ${score}%! Seu nível agora é ${upcoming.label}.` : `You passed with ${score}%! Your level is now ${upcoming.label}.`, {
        description: t("A new course with 30 core lessons and an optional review unit was unlocked — everything you finished before is kept."),
        duration: 9000,
      });
      navigate({ to: "/learning" });
    } catch {
      toast.error(t("Your test was saved, but the level change failed. Please try again."));
    } finally {
      setPromoting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <Link to="/learning" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Learning Center
        </Link>

        <header className="animate-rise">
          <p className="text-sm text-muted-foreground">
            <span>Final Test</span> · <span className="uppercase">{path.level}</span>
          </p>
          <h1 className="mt-1 text-3xl font-bold">
            <span>Final Test</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            <span>{FINAL_TEST_QUESTIONS}</span> <span>questions.</span>{" "}
            <span>Score</span> <span>{FINAL_TEST_PASS}%</span>{" "}
            <span>or more to move up to the next level.</span>
          </p>
        </header>

        {!path.finalTest.unlocked ? (
          <div className="card-soft p-6 text-sm text-muted-foreground">
            <span>Finish the 30 core lessons in Units 1–5 to unlock the Final Test. Unit 6 is optional.</span>
          </div>
        ) : !id ? (
          <div className="card-soft space-y-4 p-6">
            <span className="grid size-12 place-items-center rounded-xl bg-accent">
              <Trophy className="size-6 text-accent-foreground" />
            </span>
            <p className="text-sm text-muted-foreground">
              <span>The AI will write your test now. Take it in one sitting.</span>
            </p>
            <Button onClick={() => void start()} disabled={openTest.isPending}>
              {openTest.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trophy className="size-4" />}
              Start final test
            </Button>
          </div>
        ) : !data ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <>
            {promoting && (
              <p className="text-sm text-muted-foreground">
                <span>Setting up your next level…</span>
              </p>
            )}
            <LessonQuiz questions={data.quiz} userId={profile?.id} lessonId={id} onFinished={finish} />
          </>
        )}
      </div>
    </AppShell>
  );
}
