import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Crown,
  Download,
  Loader2,
  Lock,
  MessageSquareText,
  Play,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLessons, useUserLessons } from "@/hooks/useLearning";
import { useProfile } from "@/hooks/useProfile";
import {
  BUSINESS_FREE_LESSONS,
  businessLevelAllowed,
  businessRolePlays,
  getBusinessUnits,
} from "@/lib/businessCourse";
import { loadBusinessAccess, openBusinessLesson } from "@/lib/businessCourse.functions";
import { findLevel } from "@/lib/level";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/business")({
  head: () => ({
    meta: [
      { title: "Business English - Evoluir+ English AI" },
      {
        name: "description",
        content:
          "Meetings, e-mails, presentations, interviews and negotiation in English, at your level.",
      },
    ],
  }),
  component: BusinessPage,
});

function BusinessPage() {
  const { data: profile } = useProfile();
  const { data: lessons } = useLessons();
  const { data: mine } = useUserLessons();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const open = useServerFn(openBusinessLesson);
  const access = useServerFn(loadBusinessAccess);
  const [opening, setOpening] = useState<string | null>(null);
  // "all" or the unit number whose PDF is being built.
  const [downloading, setDownloading] = useState<number | "all" | null>(null);
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);

  const level = profile?.max_level || profile?.level;
  const allowed = businessLevelAllowed(level);
  const { data: premium = false } = useQuery({
    queryKey: ["business-access", profile?.id],
    enabled: !!profile?.id && allowed,
    queryFn: async () => (await access()).premium,
  });

  const units = useMemo(() => {
    const byKey = new Map(
      (lessons ?? []).map((row) => [
        (row as { curriculum_key?: string | null }).curriculum_key ?? "",
        row,
      ]),
    );
    const doneIds = new Set(
      (mine ?? []).filter((row) => row.completed_at).map((row) => row.lesson_id),
    );
    let previousDone = true;
    return getBusinessUnits(level).map((unit) => ({
      ...unit,
      lessons: unit.lessons.map((plan) => {
        const row = byKey.get(plan.key);
        const lessonId = (row?.id as string | undefined) ?? null;
        const completed = !!lessonId && doneIds.has(lessonId);
        const premiumLocked = !premium && plan.index >= BUSINESS_FREE_LESSONS && !lessonId;
        const item = { ...plan, lessonId, completed, locked: !previousDone, premiumLocked };
        previousDone = completed;
        return item;
      }),
    }));
  }, [lessons, mine, level, premium]);
  const all = units.flatMap((unit) => unit.lessons);
  const completedCount = all.filter((lesson) => lesson.completed).length;
  const percent = all.length ? Math.round((completedCount / all.length) * 100) : 0;
  // Same "current lesson" as the learning path: the first one not done yet.
  const next = all.find((lesson) => !lesson.completed) ?? null;
  // Units without the next lesson collapse into a row until opened.
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const toggleUnit = (unit: number) =>
    setExpanded((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(unit)) nextSet.delete(unit);
      else nextSet.add(unit);
      return nextSet;
    });

  async function downloadPdf(unit?: number) {
    setDownloading(unit ?? "all");
    try {
      // The PDF library loads only when a download is requested.
      const { downloadBusinessCourse } = await import("@/lib/businessCourseReport");
      const saved = await downloadBusinessCourse({
        level: level ?? "b1",
        ...(unit ? { unit } : {}),
      });
      if (saved) toast.success(t("Your PDF is downloading."));
      else
        toast.info(
          t(
            "Downloads are blocked inside the editor preview. Open the app in its own browser tab and tap the button again.",
          ),
        );
    } catch {
      toast.error(t("Could not build the PDF. Please try again."));
    } finally {
      setDownloading(null);
    }
  }

  const openLesson = useMutation({
    mutationFn: async (key: string) => {
      setOpening(key);
      return open({ data: { key } });
    },
    onSuccess: ({ lessonId }) => {
      void queryClient.invalidateQueries({ queryKey: ["lessons"] });
      void navigate({ to: "/learning/$lessonId", params: { lessonId } });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not open this lesson."),
    onSettled: () => setOpening(null),
  });

  function start(lesson: (typeof all)[number]) {
    if (lesson.lessonId) {
      void navigate({ to: "/learning/$lessonId", params: { lessonId: lesson.lessonId } });
    } else if (lesson.premiumLocked) {
      toast.info(t("The first lesson is free. Premium opens all 36 Business lessons."));
    } else if (lesson.locked) {
      toast.info(t("Finish the previous lesson first to unlock this one."));
    } else {
      openLesson.mutate(lesson.key);
    }
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <header className="animate-rise">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-[11px] font-semibold text-warning">
            <Crown className="size-3.5" aria-hidden="true" />
            <span>Premium bonus</span>
          </p>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold lg:text-3xl">
            <Briefcase className="size-6 text-brand-green" aria-hidden="true" />
            Business English
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Meetings, e-mails, presentations, interviews, negotiation and networking, written at
            your level.
          </p>
        </header>

        {!profile ? null : !allowed ? (
          <section className="card-soft space-y-3 p-5 text-center">
            <Lock className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-semibold">Business English opens at level B1.</p>
            <p className="text-sm text-muted-foreground">
              <span>You are at</span> <span>{findLevel(level).value.toUpperCase()}</span>.{" "}
              <span>Keep going in your learning path to unlock it.</span>
            </p>
            <Button asChild>
              <Link to="/learning">Go to my learning path</Link>
            </Button>
          </section>
        ) : (
          <>
            {!premium && (
              <section className="flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm">
                  The first lesson is free. Premium opens all 36 Business lessons.
                </p>
                <Button asChild size="sm" className="shrink-0">
                  <Link to="/premium">See plans</Link>
                </Button>
              </section>
            )}

            {/* Same layout as the learning path (user request): progress and the
                next lesson on top, the unit with the next lesson open on the left
                and the other units as rows that open on tap. */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-4">
              <section className="card-soft p-4" aria-labelledby="business-path-heading">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[oklch(0.28_0.045_200)]">
                    <Briefcase className="size-5 text-[oklch(0.72_0.13_185)]" aria-hidden="true" />
                  </span>
                  <h2
                    id="business-path-heading"
                    className="min-w-0 flex-1 truncate text-sm font-semibold"
                  >
                    <span>Business English</span> <span>·</span>{" "}
                    <span>{findLevel(level).label}</span>
                  </h2>
                  <p className="shrink-0 text-xs font-semibold text-muted-foreground">
                    {completedCount}/{all.length} · {percent}%
                  </p>
                </div>
                <Progress value={percent} className="mt-3 h-2" aria-label={t("Course progress")} />
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  disabled={downloading !== null}
                  onClick={() => void downloadPdf()}
                >
                  {downloading === "all" ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="size-4" aria-hidden="true" />
                  )}
                  {t("Download all units (PDF)")}
                </Button>
              </section>

              {!next ? (
                <section className="card-soft p-4" aria-label={t("All Business lessons completed")}>
                  <p className="text-sm font-semibold">{t("All Business lessons completed")}</p>
                </section>
              ) : (
                <section
                  className="card-soft border-[1.5px] border-[rgb(0_245_206)]/45 p-4"
                  aria-label={t("Next lesson")}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[oklch(0.72_0.13_185)]">
                    {t("Next lesson")} · {t("Unit")} {next.unit}, {t("Lesson")} {next.position}
                  </p>
                  <h3 className="mt-1 truncate text-sm font-semibold" translate="no" lang="en">
                    {next.title}
                  </h3>
                  <p
                    className="mt-1 line-clamp-2 text-xs text-muted-foreground"
                    translate="no"
                    lang="en"
                  >
                    {next.objective}
                  </p>
                  {next.premiumLocked ? (
                    <Button
                      asChild
                      className="mt-3 min-h-12 w-full bg-warning text-[#2a1d00] hover:bg-warning/90 lg:min-h-10"
                    >
                      <Link to="/premium">
                        <Crown className="size-4" aria-hidden="true" />
                        <span>See plans</span>
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      className="mt-3 min-h-12 w-full bg-[rgb(0_245_206)] text-[#03231f] hover:bg-[rgb(0_220_186)] lg:min-h-10"
                      onClick={() => start(next)}
                      disabled={!!opening}
                    >
                      {opening === next.key ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Play className="size-4" aria-hidden="true" />
                      )}
                      <span>{next.lessonId ? t("Continue lesson") : t("Start lesson")}</span>
                    </Button>
                  )}
                </section>
              )}
            </div>

            <div className="grid grid-cols-1 items-start gap-5 md:grid-flow-dense md:grid-cols-2 md:gap-y-3 lg:gap-x-4 lg:gap-y-2.5">
              {units.map((unit) => {
                const done = unit.lessons.filter((lesson) => lesson.completed).length;
                const allDone = done === unit.lessons.length;
                const collapsible = next?.unit !== unit.unit;
                const isExpanded = collapsible && expanded.has(unit.unit);
                const placement = !next
                  ? ""
                  : collapsible
                    ? "md:col-start-2 md:py-2 lg:py-0.5"
                    : "md:col-start-1 md:row-span-6 md:row-start-1";
                const pdfButton = (
                  <button
                    type="button"
                    onClick={() => void downloadPdf(unit.unit)}
                    disabled={downloading !== null}
                    aria-label={`${t("Download PDF")} · ${t(unit.title)}`}
                    title={t("Download PDF")}
                    className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-brand-green/50 hover:text-brand-green disabled:opacity-50"
                  >
                    {downloading === unit.unit ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Download className="size-4" aria-hidden="true" />
                    )}
                  </button>
                );
                return (
                  <section
                    key={unit.unit}
                    className={`card-soft p-4 ${placement}`}
                    aria-label={unit.title}
                  >
                    {collapsible ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleUnit(unit.unit)}
                          aria-expanded={isExpanded}
                          aria-label={unit.title}
                          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl text-left lg:min-h-10"
                        >
                          {allDone ? (
                            <CheckCircle2 className="size-4 shrink-0 text-[oklch(0.55_0.15_150)]" />
                          ) : (
                            <Lock className="size-4 shrink-0 text-muted-foreground" />
                          )}
                          <span className="w-0 min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
                            {unit.title}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {done}/{unit.lessons.length}
                          </span>
                          {isExpanded ? (
                            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                          )}
                        </button>
                        {pdfButton}
                      </div>
                    ) : (
                      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
                        <h3 className="font-semibold">{unit.title}</h3>
                        <span className="text-xs text-muted-foreground">
                          {done}/{unit.lessons.length}
                        </span>
                        {pdfButton}
                      </div>
                    )}
                    {(isExpanded || !collapsible) && (
                      <ul className="mt-4 space-y-2 lg:mt-3 lg:space-y-1.5">
                        {unit.lessons.map((lesson) => {
                          const busy = opening === lesson.key;
                          const isCurrent = next?.key === lesson.key;
                          const blocked = lesson.locked || lesson.premiumLocked;
                          return (
                            <li key={lesson.key}>
                              <button
                                type="button"
                                onClick={() => start(lesson)}
                                disabled={busy || !!opening}
                                aria-label={lesson.title}
                                title={lesson.objective}
                                aria-current={isCurrent ? "true" : undefined}
                                className={cn(
                                  "flex w-full items-center gap-3 rounded-xl border-[1.5px] p-3 text-left transition-shadow hover:shadow-[var(--shadow-lift)] lg:py-1.5",
                                  isCurrent
                                    ? "border-[rgb(0_245_206)]/45 bg-[rgb(0_245_206)]/10"
                                    : "border-border",
                                  blocked && !isCurrent && "opacity-80",
                                )}
                              >
                                <span
                                  className={cn(
                                    "grid size-8 shrink-0 place-items-center rounded-lg text-xs font-semibold",
                                    isCurrent
                                      ? "bg-[rgb(0_245_206)] text-[#03231f]"
                                      : "bg-secondary text-muted-foreground",
                                  )}
                                >
                                  {lesson.position}
                                </span>
                                <span className="min-w-0 flex-1" translate="no" lang="en">
                                  <span
                                    className={cn(
                                      "block truncate text-sm",
                                      isCurrent
                                        ? "font-bold"
                                        : lesson.completed
                                          ? "text-muted-foreground"
                                          : "font-medium",
                                    )}
                                  >
                                    {lesson.title}
                                  </span>
                                  <span className="mt-1 block text-xs text-muted-foreground lg:hidden">
                                    {lesson.objective}
                                  </span>
                                </span>
                                {busy ? (
                                  <Loader2 className="size-4 shrink-0 animate-spin" />
                                ) : lesson.completed ? (
                                  <CheckCircle2 className="size-4 shrink-0 text-[oklch(0.55_0.15_150)]" />
                                ) : lesson.premiumLocked ? (
                                  <Crown className="size-4 shrink-0 text-warning" />
                                ) : isCurrent ? (
                                  <Play className="size-4 shrink-0 fill-current text-[rgb(0_245_206)]" />
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
                    )}
                  </section>
                );
              })}
            </div>

            <section className="card-soft space-y-3 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold">Practise with EVO</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Real work situations: EVO plays the other person.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {businessRolePlays.map((play) => (
                  <div
                    key={play.id}
                    className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-border p-2.5"
                  >
                    <span className="min-w-0 truncate text-sm font-medium">{play.label}</span>
                    <span className="flex shrink-0 gap-1">
                      <Button asChild size="sm" variant="secondary" className="h-8 gap-1 px-2.5">
                        <Link to="/coach" search={{ business: play.id }} aria-label={t("Talk")}>
                          <MessageSquareText className="size-3.5" aria-hidden="true" />
                          <span className="hidden sm:inline">Talk</span>
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="secondary" className="h-8 gap-1 px-2.5">
                        <Link to="/call" search={{ business: play.id }} aria-label={t("Call")}>
                          <Video className="size-3.5" aria-hidden="true" />
                          <span className="hidden sm:inline">Call</span>
                        </Link>
                      </Button>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
