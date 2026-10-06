import { useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Lock,
  Play,
  Trophy,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLearningPath, useOpenPathLesson, type PathLesson } from "@/hooks/useCurriculum";
import { useProfile } from "@/hooks/useProfile";
import { findLevel } from "@/lib/level";
import { useUiLang } from "@/lib/uiLang";
import { uiPt } from "@/lib/uiDictionary";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

/** The 30-lesson core path plus its optional 3-lesson review unit. */
/**
 * The learning path of the student's level, or, with `reviewLevel`, of an
 * earlier level opened for review: every lesson open and no unit or final
 * tests, since those move the student's own level.
 */
export function CurriculumPath({ reviewLevel }: { reviewLevel?: string | null } = {}) {
  const { lang } = useUiLang();
  const t = (text: string) => (lang === "pt" ? (uiPt[text] ?? text) : text);
  const path = useLearningPath(reviewLevel);
  const review = path.review;
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
    <div className="space-y-5 lg:space-y-3">
      <div className="grid gap-5 lg:grid-cols-2 lg:gap-4">
        <section className="card-soft p-4" aria-labelledby="path-heading">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[oklch(0.28_0.045_200)]">
              <BookOpen className="size-5 text-[oklch(0.72_0.13_185)]" />
            </span>
            <h2 id="path-heading" className="min-w-0 flex-1 truncate text-sm font-semibold">
              {review && (
                <>
                  <span>Review</span>
                  <span> · </span>
                </>
              )}
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
                {!review && path.finalTest.unlocked && (
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
                {review ? t("Review") : t("Next lesson")} · {t("Unit")} {next.unit}, {t("Lesson")}{" "}
                {next.position}
              </p>
              <h3 className="mt-1 truncate text-sm font-semibold">{next.title}</h3>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{next.objective}</p>
              <Button
                className="mt-3 min-h-12 w-full lg:min-h-10 bg-[rgb(0_245_206)] text-[#03231f] hover:bg-[rgb(0_220_186)]"
                onClick={() => void start(next)}
                disabled={busy || open.isPending}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                <span>{review && !next.started ? t("Start lesson") : t("Continue lesson")}</span>
              </Button>
            </section>
          );
        })()}
      </div>

      {/* The open unit fills the left column; the collapsed ones stack on the right. */}
      <div className="grid items-start gap-5 md:grid-flow-dense md:grid-cols-2 md:gap-y-3 lg:gap-x-4 lg:gap-y-2.5">
        {path.units.map((unit) => {
          const allDone = unit.lessons.length > 0 && unit.completed === unit.lessons.length;
          const containsNext = nextLesson?.unit === unit.unit;
          // Only the unit with the next lesson stays open, so the path fits one
          // screen; finished and upcoming units collapse into a row that opens
          // on tap.
          const collapsible = !containsNext;
          const isExpanded = collapsible && expandedUnits.has(unit.unit);
          const test = path.unitTests.find((item) => item.unit === unit.unit);
          const unitLocked = unit.lessons.every((lesson) => lesson.locked);
          const placement = !nextLesson
            ? ""
            : collapsible
              ? "md:col-start-2 md:py-2 lg:py-0.5"
              : "md:col-start-1 md:row-span-6 md:row-start-1";

          // The optional review unit stays a discreet locked row until it unlocks.
          if (unit.unit === 6 && unitLocked && !isExpanded) {
            return (
              <section
                key={unit.unit}
                className={`card-soft p-4 opacity-70 lg:flex lg:items-center lg:gap-3 ${placement}`}
                aria-label={unit.title}
              >
                <div className="flex min-h-12 items-center gap-3 lg:min-h-10 lg:shrink-0">
                  <Lock className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm lg:flex-none text-muted-foreground">
                    {unit.title}
                  </span>
                </div>
                <p
                  className="text-xs text-muted-foreground lg:min-w-0 lg:flex-1 lg:truncate lg:text-right"
                  title={t("Optional review · does not block the Final Test")}
                >
                  {t("Optional review · does not block the Final Test")}
                </p>
              </section>
            );
          }

          const lessonsList = (
            <ul className="mt-4 space-y-2 lg:mt-3 lg:space-y-1.5">
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
                      title={lesson.objective}
                      aria-current={isCurrent ? "true" : undefined}
                      className={`flex w-full items-center gap-3 rounded-xl border-[1.5px] p-3 text-left transition-shadow lg:py-1.5 hover:shadow-[var(--shadow-lift)] ${
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
                          className={`mt-1 block text-xs lg:hidden ${
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

          const testButton =
            test && !review ? (
              <Button
                variant={test.unlocked && !test.passed ? "default" : "outline"}
                size="sm"
                className={`mt-4 w-full lg:mt-2.5 ${
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
            <section
              key={unit.unit}
              className={`card-soft p-4 ${placement}`}
              aria-label={unit.title}
            >
              {collapsible ? (
                <button
                  type="button"
                  onClick={() => toggleUnit(unit.unit)}
                  aria-expanded={isExpanded}
                  aria-label={`${t("Unit")} ${unit.unit} · ${unit.title}`}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl text-left lg:min-h-10"
                >
                  {allDone ? (
                    <CheckCircle2 className="size-4 shrink-0 text-[oklch(0.55_0.15_150)]" />
                  ) : review ? (
                    <BookOpen className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <Lock className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
                    {unit.title}
                  </span>
                  {!allDone || review ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {unit.completed}/{unit.lessons.length}
                    </span>
                  ) : test?.passed ? (
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

        {!review && (
          <section
            className={`card-soft p-5 lg:p-4 ${nextLesson ? "md:col-start-2" : "md:col-span-2"}`}
            aria-label="Final Test"
          >
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
              className="mt-4 w-full whitespace-normal lg:mt-3"
              disabled={!path.finalTest.unlocked}
              onClick={() => navigate({ to: "/learning/final-test" })}
            >
              {path.finalTest.unlocked ? (
                <>
                  <Trophy className="size-4" /> <span>Take the final test</span>
                </>
              ) : (
                <>
                  <Lock className="size-4" />{" "}
                  <span>Finish the 30 lessons in Units 1–5 to unlock</span>
                </>
              )}
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}
