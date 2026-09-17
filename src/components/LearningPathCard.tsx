import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Download, Loader2, Lock, Play, Sparkles, Trophy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLearningPath, useOpenPathLesson, type PathLesson } from "@/hooks/useCurriculum";
import { useUserLessons } from "@/hooks/useLearning";
import { useProfile } from "@/hooks/useProfile";
import { downloadCoursePlan } from "@/lib/coursePlanReport";
import { downloadDailyReport } from "@/lib/dailyReport";
import { findLevel } from "@/lib/level";
import { supabase } from "@/integrations/supabase/client";
import { useUiLang } from "@/lib/uiLang";
import { uiPt } from "@/lib/uiDictionary";



function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

/** The 30-lesson core path plus its optional 3-lesson review unit. */
export function CurriculumPath() {
  const { lang } = useUiLang();
  const t = (text: string) => (lang === "pt" ? uiPt[text] ?? text : text);
  const path = useLearningPath();
  const open = useOpenPathLesson();
  const navigate = useNavigate();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const { data: profile } = useProfile();
  const [planLoading, setPlanLoading] = useState(false);

  const downloadPlan = async () => {
    setPlanLoading(true);
    try {
      const saved = await downloadCoursePlan({
        name: profile?.name ?? "",
        level: path.level,
      });
      if (saved) toast.success(t("Your course plan is downloading."));
      else
        toast.info(
          t("Downloads are blocked inside the editor preview. Open the app in its own browser tab and tap the button again."),
        );
    } catch {
      toast.error(t("Could not build the course PDF. Please try again."));
    } finally {
      setPlanLoading(false);
    }
  };

  const start = async (lesson: PathLesson) => {
    if (lesson.locked) {
      toast.info(t("Finish the previous lesson first to unlock this one."));
      return;
    }
    if (lesson.lessonId) {
      navigate({ to: "/learning/$lessonId", params: { lessonId: lesson.lessonId } });
      return;
    }
    setBusyKey(lesson.key);
    try {
      const { lessonId } = await open.mutateAsync(lesson.key);
      navigate({ to: "/learning/$lessonId", params: { lessonId } });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-5">
      <section className="card-soft p-6" aria-labelledby="path-heading">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-accent">
            <Sparkles className="size-5 text-accent-foreground" />
          </span>
          <div className="flex-1">
            <h2 id="path-heading" className="text-lg font-semibold">
              <span>Course</span>
              <span> - </span>
              <span>{findLevel(path.level).label}</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              <span>33 lessons in 6 units, including an optional review unit with a 10-question test.</span>
            </p>
          </div>
          <p className="text-sm font-semibold">
            {path.completed}/{path.total}
          </p>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Completed</span>
            <span className="text-muted-foreground">{Math.round((path.completed / path.total) * 100)}%</span>
          </div>
          <Progress value={Math.round((path.completed / path.total) * 100)} className="mt-2 h-2" />
        </div>

        <Button
          variant="outline"
          size="sm"
          className="mt-4 w-full sm:w-auto"
          onClick={() => void downloadPlan()}
          disabled={planLoading}
        >
          {planLoading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Download course
        </Button>
      </section>

      <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
        {path.units.map((unit) => (
          <section key={unit.unit} className="card-soft p-5" aria-label={unit.title}>
            <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">{unit.title}</h3>
              {unit.unit === 6 && <p className="text-xs text-muted-foreground">Optional review · does not block the Final Test</p>}
            </div>
              <span className="text-xs text-muted-foreground">
                {unit.completed}/{unit.lessons.length}
              </span>
            </div>
            <ul className="mt-4 space-y-2">
              {unit.lessons.map((lesson) => {
                const busy = busyKey === lesson.key;
                return (
                  <li key={lesson.key}>
                    <button
                      type="button"
                      onClick={() => void start(lesson)}
                      disabled={busy || open.isPending}
                      aria-label={lesson.title}
                      className={`flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-shadow hover:shadow-[var(--shadow-lift)] ${
                        lesson.locked ? "opacity-60" : ""
                      }`}
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-semibold">
                        {lesson.position}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{lesson.title}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">{lesson.objective}</span>
                      </span>
                      {busy ? (
                        <Loader2 className="size-4 shrink-0 animate-spin" />
                      ) : lesson.completed ? (
                        <CheckCircle2 className="size-4 shrink-0 text-[oklch(0.55_0.15_150)]" />
                      ) : lesson.locked ? (
                        <Lock className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <Play className="size-4 shrink-0 text-[oklch(0.45_0.11_255)]" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <section className="card-soft p-5" aria-label="Final Test">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent">
            <Trophy className="size-5 text-accent-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">
              <span>Final Test</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              <span>30 questions. Score 70% or more to move up to the next level.</span>
            </p>
          </div>
          {path.finalTest.passed && <CheckCircle2 className="size-5 shrink-0 text-[oklch(0.55_0.15_150)]" />}
        </div>
        <Button
          className="mt-4 w-full"
          disabled={!path.finalTest.unlocked}
          onClick={() => navigate({ to: "/learning/final-test" })}
        >
          {path.finalTest.unlocked ? (
            <>
              <Trophy className="size-4" /> <span>Take the final test</span>
            </>
          ) : (
            <>
              <Lock className="size-4" /> <span>Finish the 30 lessons in Units 1–5 to unlock</span>
            </>
          )}
        </Button>
      </section>
    </div>
  );
}

/** Dashboard card: course progress + skill scores. */
export function PathProgressCard() {
  const { lang } = useUiLang();
  const t = (text: string) => (lang === "pt" ? uiPt[text] ?? text : text);
  const path = useLearningPath();
  const { data: profile } = useProfile();
  const { data: mine } = useUserLessons();
  const [downloading, setDownloading] = useState(false);

  // Only the lessons of the level the student is on now.
  const levelLessonIds = new Set(path.lessons.map((l) => l.lessonId).filter(Boolean) as string[]);
  const studied = (mine ?? []).filter((l) => Boolean(l.completed_at) && levelLessonIds.has(l.lesson_id));

  const { data: latest } = useQuery({
    queryKey: ["progress-latest", profile?.id, profile?.level],
    enabled: !!profile,
    queryFn: async () => {
      const { data } = await supabase
        .from("progress")
        .select("*")
        .eq("level", profile!.level)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const skills = [
    { label: "Listening", value: latest?.listening_score ?? 0 },
    { label: "Reading", value: latest?.reading_score ?? 0 },
    { label: "Talking", value: latest?.speaking_score ?? 0 },
    { label: "Writing", value: latest?.writing_score ?? 0 },
  ];

  const download = async () => {
    if (!profile) return;
    setDownloading(true);
    try {
      const saved = await downloadDailyReport(profile.id, {
        name: profile.name,
        level: profile.level,
        lessonIds: studied.map((l) => l.lesson_id),
      });
      if (saved) toast.success(t("Your study content is downloading."));
      else
        toast.info(
          t("Downloads are blocked inside the editor preview. Open the app in its own browser tab and tap the button again."),
        );
    } catch {
      toast.error(t("Could not build your summary. Please try again."));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="card-soft bg-card p-6 text-card-foreground" aria-labelledby="path-progress-heading">
      <h2 id="path-progress-heading" className="text-xl font-semibold">
        Your progress
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        <span>Your English level</span>
        <span> · </span>
        <span className="uppercase">{path.level}</span>
        <span> · </span>
        <span>Lesson</span> <span>{path.completed}</span> <span>of</span> <span>{path.total}</span>{" "}
        <span>completed</span>
      </p>
      {path.next ? (
        <p className="mt-3 text-sm">
          <span>Next lesson:</span> {path.next.title}
        </p>
      ) : (
        <p className="mt-3 text-sm">
          <span>You finished every lesson. Take the Final Test to move up a level.</span>
        </p>
      )}
      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Completed</span>
          <span className="text-muted-foreground">{Math.round((path.completed / path.total) * 100)}%</span>
        </div>
        <Progress value={Math.round((path.completed / path.total) * 100)} className="mt-2 h-2" />
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">

        {skills.map((s) => (
          <div key={s.label}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{s.label}</span>
              <span className="text-muted-foreground">{s.value}%</span>
            </div>
            <Progress value={s.value} className="mt-2 h-2" />
          </div>
        ))}
      </div>

      {!latest && (
        <p className="mt-5 text-sm text-muted-foreground">
          Finish your first conversation or writing task to unlock your scores.
        </p>
      )}

      {studied.length > 0 && (
        <Button variant="outline" size="sm" className="mt-5" onClick={() => void download()} disabled={downloading}>
          {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Download your progress
        </Button>
      )}
    </section>
  );
}
