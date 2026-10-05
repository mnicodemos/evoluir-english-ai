import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Headphones,
  Loader2,
  Lock,
  Mic,
  PenLine,
  Play,
  Trophy,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLearningPath, useOpenPathLesson, type PathLesson } from "@/hooks/useCurriculum";
import { useUserLessons } from "@/hooks/useLearning";
import { useProfile } from "@/hooks/useProfile";
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
  const t = (text: string) => (lang === "pt" ? (uiPt[text] ?? text) : text);
  const path = useLearningPath();
  const open = useOpenPathLesson();
  const navigate = useNavigate();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  // Units whose lessons are all done collapse into a single row until expanded.
  const [expandedUnits, setExpandedUnits] = useState<Set<number>>(() => new Set());
  const { data: profile } = useProfile();
  const [planLoading, setPlanLoading] = useState(false);
  // Current lesson = same one the "Next lesson" card shows.
  const nextLesson =
    path.units
      .flatMap((unit) => unit.lessons)
      .find((lesson) => !lesson.completed && !lesson.locked) ?? null;

  const toggleUnit = (unitNumber: number) => {
    setExpandedUnits((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(unitNumber)) nextSet.delete(unitNumber);
      else nextSet.add(unitNumber);
      return nextSet;
    });
  };

  const downloadPlan = async () => {
    setPlanLoading(true);
    try {
      // The PDF library is loaded only when a download is requested, keeping
      // it out of the Dashboard bundle.
      const { downloadCoursePlan } = await import("@/lib/coursePlanReport");
      const saved = await downloadCoursePlan({
        name: profile?.name ?? "",
        level: path.level,
      });
      if (saved) toast.success(t("Your course plan is downloading."));
      else
        toast.info(
          t(
            "Downloads are blocked inside the editor preview. Open the app in its own browser tab and tap the button again.",
          ),
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
      <section className="card-soft p-4" aria-labelledby="path-heading">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[oklch(0.28_0.045_200)]">
            <BookOpen className="size-5 text-[oklch(0.72_0.13_185)]" />
          </span>
          <h2 id="path-heading" className="min-w-0 flex-1 truncate text-sm font-semibold">
            <span>{findLevel(path.level).label}</span>
          </h2>
          <p className="shrink-0 text-xs font-semibold text-muted-foreground">
            {path.completed}/{path.total} · {Math.round((path.completed / path.total) * 100)}%
          </p>
        </div>
        <Progress value={Math.round((path.completed / path.total) * 100)} className="mt-3 h-2" />

        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => void downloadPlan()}
          disabled={planLoading}
        >
          {planLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Download course
        </Button>
      </section>

      {(() => {
        const next = nextLesson;
        if (!next) {
          return (
            <section className="card-soft p-4" aria-label="All lessons completed">
              <p className="text-sm font-semibold">{t("All lessons completed")}</p>
              {path.finalTest.unlocked && (
                <Button
                  className="mt-3 min-h-12 w-full bg-[rgb(0_245_206)] text-[#03231f] hover:bg-[rgb(0_220_186)]"
                  onClick={() => navigate({ to: "/learning/final-test" })}
                >
                  <Trophy className="size-4" /> <span>{t("Take the final test")}</span>
                </Button>
              )}
            </section>
          );
        }
        const busy = busyKey === next.key;
        return (
          <section
            className="card-soft border-[1.5px] border-[rgb(0_245_206)]/45 p-4"
            aria-label="Next lesson"
          >
            <p className="text-[11px] font-semibold tracking-wider text-[oklch(0.72_0.13_185)] uppercase">
              {t("Next lesson")} · {t("Unit")} {next.unit}, {t("Lesson")} {next.position}
            </p>
            <h3 className="mt-1 truncate text-sm font-semibold">{next.title}</h3>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{next.objective}</p>
            <Button
              className="mt-3 min-h-12 w-full bg-[rgb(0_245_206)] text-[#03231f] hover:bg-[rgb(0_220_186)]"
              onClick={() => void start(next)}
              disabled={busy || open.isPending}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              <span>{t("Continue lesson")}</span>
            </Button>
          </section>
        );
      })()}

      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {path.units.map((unit) => {
          const allDone = unit.lessons.length > 0 && unit.completed === unit.lessons.length;
          const containsNext = nextLesson?.unit === unit.unit;
          const collapsible = allDone && !containsNext;
          const isExpanded = collapsible && expandedUnits.has(unit.unit);
          const test = path.unitTests.find((item) => item.unit === unit.unit);
          const unitLocked = unit.lessons.every((lesson) => lesson.locked);

          // The optional review unit stays a discreet locked row until it unlocks.
          if (unit.unit === 6 && unitLocked && !isExpanded) {
            return (
              <section key={unit.unit} className="card-soft p-4 opacity-70" aria-label={unit.title}>
                <div className="flex min-h-12 items-center gap-3">
                  <Lock className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {t("Unit")} {unit.unit} · {unit.title}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("Optional review · does not block the Final Test")}
                </p>
              </section>
            );
          }

          const lessonsList = (
            <ul className="mt-4 space-y-2">
              {unit.lessons.map((lesson) => {
                const busy = busyKey === lesson.key;
                const isCurrent = nextLesson?.key === lesson.key;
                const isDone = lesson.completed;
                return (
                  <li key={lesson.key}>
                    <button
                      type="button"
                      onClick={() => void start(lesson)}
                      disabled={busy || open.isPending}
                      aria-label={lesson.title}
                      aria-current={isCurrent ? "true" : undefined}
                      className={`flex w-full items-center gap-3 rounded-xl border-[1.5px] p-3 text-left transition-shadow hover:shadow-[var(--shadow-lift)] ${
                        isCurrent
                          ? "border-[rgb(0_245_206)]/45 bg-[rgb(0_245_206)]/10"
                          : "border-border"
                      } ${lesson.locked && !isCurrent ? "opacity-60" : ""}`}
                    >
                      <span
                        className={`grid size-8 shrink-0 place-items-center rounded-lg text-xs font-semibold ${
                          isCurrent
                            ? "bg-[rgb(0_245_206)] text-[#03231f]"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {lesson.position}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-sm ${
                            isCurrent
                              ? "font-bold"
                              : isDone
                                ? "text-muted-foreground"
                                : "font-medium"
                          }`}
                        >
                          {lesson.title}
                        </span>
                        <span
                          className={`mt-1 block text-xs ${
                            isDone && !isCurrent
                              ? "text-muted-foreground/70"
                              : "text-muted-foreground"
                          }`}
                        >
                          {lesson.objective}
                        </span>
                      </span>
                      {busy ? (
                        <Loader2 className="size-4 shrink-0 animate-spin" />
                      ) : isCurrent ? (
                        <Play className="size-4 shrink-0 fill-current text-[rgb(0_245_206)]" />
                      ) : isDone ? (
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
          );

          const testButton = test ? (
            <Button
              variant={test.unlocked && !test.passed ? "default" : "outline"}
              size="sm"
              className={`mt-4 w-full ${
                test.unlocked && !test.passed
                  ? "bg-[rgb(0_245_206)] text-[#03231f] hover:bg-[rgb(0_220_186)]"
                  : "text-muted-foreground"
              }`}
              disabled={!test.unlocked}
              onClick={() => navigate({ to: "/learning/unit-test", search: { unit: unit.unit } })}
            >
              {test.unlocked ? (
                <>
                  {test.passed ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <Trophy className="size-4" />
                  )}
                  <span>
                    {test.passed
                      ? t("Unit test passed")
                      : lang === "pt"
                        ? "Teste Final da Unidade"
                        : "Unit Final Test"}
                  </span>
                </>
              ) : (
                <>
                  <Lock className="size-4" />
                  <span>
                    {lang === "pt"
                      ? "Conclua as 6 lições para liberar"
                      : "Finish the 6 lessons to unlock"}
                  </span>
                </>
              )}
            </Button>
          ) : null;

          return (
            <section key={unit.unit} className="card-soft p-4" aria-label={unit.title}>
              {collapsible ? (
                <button
                  type="button"
                  onClick={() => toggleUnit(unit.unit)}
                  aria-expanded={isExpanded}
                  aria-label={`${t("Unit")} ${unit.unit} · ${unit.title}`}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl text-left"
                >
                  <CheckCircle2 className="size-4 shrink-0 text-[oklch(0.55_0.15_150)]" />
                  <span className="min-w-0 w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
                    {t("Unit")} {unit.unit} · {unit.title}
                  </span>
                  {test?.passed ? (
                    <span className="shrink-0 text-xs font-medium text-[oklch(0.55_0.15_150)]">
                      {t("Test passed")}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full border border-[rgb(0_245_206)]/50 px-2 py-0.5 text-xs font-medium text-[rgb(0_245_206)]">
                      {t("Take test")}
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
              ) : (
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold">{unit.title}</h3>
                    {unit.unit === 6 && (
                      <p className="text-xs text-muted-foreground">
                        Optional review · does not block the Final Test
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {unit.completed}/{unit.lessons.length}
                  </span>
                </div>
              )}
              {(isExpanded || !collapsible) && (
                <>
                  {lessonsList}
                  {testButton}
                </>
              )}
            </section>
          );
        })}
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
          {path.finalTest.passed && (
            <CheckCircle2 className="size-5 shrink-0 text-[oklch(0.55_0.15_150)]" />
          )}
        </div>
        <Button
          className="mt-4 w-full whitespace-normal"
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
export function PathProgressCard({
  embedded = false,
  compact = false,
}: {
  embedded?: boolean;
  compact?: boolean;
}) {
  const { lang } = useUiLang();
  const t = (text: string) => (lang === "pt" ? (uiPt[text] ?? text) : text);
  const path = useLearningPath();
  const { data: profile } = useProfile();
  const { data: mine } = useUserLessons();
  const [downloading, setDownloading] = useState(false);

  // Only the lessons of the level the student is on now.
  const levelLessonIds = new Set(path.lessons.map((l) => l.lessonId).filter(Boolean) as string[]);
  const studied = (mine ?? []).filter(
    (l) => Boolean(l.completed_at) && levelLessonIds.has(l.lesson_id),
  );

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
    {
      label: "Reading",
      value: latest?.reading_score ?? 0,
      icon: BookOpen,
    },
    {
      label: "Listening",
      value: latest?.listening_score ?? 0,
      icon: Headphones,
    },
    {
      label: "Writing",
      value: latest?.writing_score ?? 0,
      icon: PenLine,
    },
    {
      label: "Speaking",
      value: latest?.speaking_score ?? 0,
      icon: Mic,
    },
  ];

  const download = async () => {
    if (!profile) return;
    setDownloading(true);
    try {
      const { downloadDailyReport } = await import("@/lib/dailyReport");
      const saved = await downloadDailyReport(profile.id, {
        name: profile.name,
        level: profile.level,
        lessonIds: studied.map((l) => l.lesson_id),
      });
      if (saved) toast.success(t("Your study content is downloading."));
      else
        toast.info(
          t(
            "Downloads are blocked inside the editor preview. Open the app in its own browser tab and tap the button again.",
          ),
        );
    } catch {
      toast.error(t("Could not build your summary. Please try again."));
    } finally {
      setDownloading(false);
    }
  };

  const content = (
    <>
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
          <span className="text-muted-foreground">
            {Math.round((path.completed / path.total) * 100)}%
          </span>
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
        <Button
          variant="outline"
          size="sm"
          className="mt-5"
          onClick={() => void download()}
          disabled={downloading}
        >
          {downloading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Download your progress
        </Button>
      )}
    </>
  );

  if (compact) {
    return (
      <section
        className="card-soft flex h-full min-w-0 flex-col p-3 max-lg:py-2.5 xl:p-4"
        aria-labelledby="skills-progress-heading"
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <BarChart3
            className="size-[1.65rem] text-dashboard-cyan"
            strokeWidth={2.6}
            aria-hidden="true"
          />
          <h2 id="skills-progress-heading" className="font-display text-sm font-semibold">
            {t("Your English Skills")}
          </h2>
        </div>
        <div className="mt-2 grid flex-1 content-between gap-2 lg:mt-3 lg:gap-3 xl:mt-4 xl:gap-2">
          {skills.map((skill) => {
            const statusTone =
              skill.value >= 95
                ? {
                    text: "text-success",
                    bar: "[&>div]:bg-success",
                    badge: "bg-success/15 text-success",
                  }
                : skill.value >= 80
                  ? {
                      text: "text-dashboard-blue",
                      bar: "[&>div]:bg-dashboard-blue",
                      badge: "bg-dashboard-blue/15 text-dashboard-blue",
                    }
                  : {
                      text: "text-warning",
                      bar: "[&>div]:bg-warning",
                      badge: "bg-warning/15 text-warning",
                    };
            return (
              <div
                key={skill.label}
                className="grid min-w-0 grid-cols-[1.5rem_4.25rem_minmax(0,1fr)_2.25rem_4rem] items-center gap-2 text-xs sm:grid-cols-[1.75rem_5rem_minmax(0,1fr)_2.5rem_4.5rem] sm:gap-2.5"
              >
                <skill.icon
                  className={`size-[1.65rem] ${statusTone.text}`}
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                <span className="truncate font-medium">{t(skill.label)}</span>
                <Progress
                  value={skill.value}
                  className={`h-2.5 bg-secondary/80 ${statusTone.bar}`}
                />
                <span className="text-right font-semibold text-foreground">{skill.value}%</span>
                <span
                  className={`rounded-full px-2 py-1 text-center text-[10px] font-semibold ${statusTone.badge}`}
                >
                  {skill.value >= 95
                    ? t("Advanced")
                    : skill.value >= 80
                      ? t("Strong")
                      : t("Priority")}
                </span>
              </div>
            );
          })}
        </div>
        {!latest && (
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
            {t("Finish your first conversation or writing task to unlock your scores.")}
          </p>
        )}
      </section>
    );
  }

  if (embedded) {
    return (
      <section className="min-w-0" aria-labelledby="path-progress-heading">
        {content}
      </section>
    );
  }

  return (
    <section
      className="card-soft bg-card p-6 text-card-foreground"
      aria-labelledby="path-progress-heading"
    >
      {content}
    </section>
  );
}
