import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Briefcase,
  CheckCircle2,
  Crown,
  Download,
  Loader2,
  Lock,
  MessageSquareText,
  PlayCircle,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
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

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                <span>{completedCount}</span>/<span>{all.length}</span>{" "}
                <span>lessons completed</span>
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5"
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
            </div>

            {/* Six units: three columns in two rows on wide screens. */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {units.map((unit) => (
                <section key={unit.unit} className="card-soft flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-semibold">{unit.title}</h2>
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
                  </div>
                  <ol className="space-y-1.5">
                    {unit.lessons.map((lesson) => {
                      const blocked = lesson.locked || lesson.premiumLocked;
                      const busy = opening === lesson.key;
                      return (
                        <li key={lesson.key}>
                          <button
                            type="button"
                            disabled={blocked || !!opening}
                            onClick={() =>
                              lesson.lessonId
                                ? void navigate({
                                    to: "/learning/$lessonId",
                                    params: { lessonId: lesson.lessonId },
                                  })
                                : openLesson.mutate(lesson.key)
                            }
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                              blocked
                                ? "border-border/60 text-muted-foreground"
                                : "border-border hover:bg-secondary",
                            )}
                          >
                            {busy ? (
                              <Loader2
                                className="size-4 shrink-0 animate-spin"
                                aria-hidden="true"
                              />
                            ) : lesson.completed ? (
                              <CheckCircle2
                                className="size-4 shrink-0 text-brand-green"
                                aria-hidden="true"
                              />
                            ) : lesson.premiumLocked ? (
                              <Crown className="size-4 shrink-0 text-warning" aria-hidden="true" />
                            ) : blocked ? (
                              <Lock className="size-4 shrink-0" aria-hidden="true" />
                            ) : (
                              <PlayCircle
                                className="size-4 shrink-0 text-brand-green"
                                aria-hidden="true"
                              />
                            )}
                            <span className="min-w-0 flex-1 truncate" translate="no" lang="en">
                              {lesson.title}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
