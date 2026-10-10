import { Link } from "@tanstack/react-router";
import { Briefcase, ChevronRight, Crown } from "lucide-react";
import { useMemo } from "react";

import { useLessons, useUserLessons } from "@/hooks/useLearning";
import { useProfile } from "@/hooks/useProfile";
import { getBusinessCourse } from "@/lib/businessCourse";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

/**
 * Dashboard (desktop): Business English beside today's goals (user request:
 * a Premium bonus, so it left the sidebar). Shows the track's progress and
 * the next lesson; the track page opens from here.
 */
export function BusinessDashboardCard() {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const { data: profile } = useProfile();
  const { data: lessons } = useLessons();
  const { data: mine } = useUserLessons();

  const { completed, total, next } = useMemo(() => {
    const course = getBusinessCourse(profile?.max_level || profile?.level);
    const idByKey = new Map(
      (lessons ?? []).map((row) => [
        (row as { curriculum_key?: string | null }).curriculum_key ?? "",
        row.id as string,
      ]),
    );
    const doneIds = new Set(
      (mine ?? []).filter((row) => row.completed_at).map((row) => row.lesson_id),
    );
    const isDone = (key: string) => {
      const id = idByKey.get(key);
      return !!id && doneIds.has(id);
    };
    return {
      completed: course.filter((lesson) => isDone(lesson.key)).length,
      total: course.length,
      next: course.find((lesson) => !isDone(lesson.key)) ?? null,
    };
  }, [lessons, mine, profile?.level, profile?.max_level]);
  const percent = total ? Math.round((completed / total) * 100) : 0;

  return (
    <section
      className="card-soft flex min-w-0 flex-col p-3 xl:h-full xl:min-h-0 xl:px-4 xl:py-3"
      aria-labelledby="business-card-title"
    >
      <div className="flex items-center gap-2">
        <Briefcase
          className="size-[1.4rem] shrink-0 text-brand-green"
          strokeWidth={2.3}
          aria-hidden="true"
        />
        <h2 id="business-card-title" className="font-display text-sm font-semibold">
          {t("Business English")}
        </h2>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
          <Crown className="size-3" aria-hidden="true" />
          {t("Premium bonus")}
        </span>
      </div>
      <div className="mt-2 flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        <div className="flex min-w-0 items-center gap-3">
          {next ? (
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-green">
                {t("Next lesson")} · {t("Unit")} {next.unit}, {t("Lesson")} {next.position}
              </p>
              <p
                className="truncate text-sm font-semibold"
                translate="no"
                lang="en"
                title={next.title}
              >
                {next.title}
              </p>
            </div>
          ) : (
            <p className="min-w-0 flex-1 text-sm font-semibold">
              {t("All Business lessons completed")}
            </p>
          )}
          {/* The track's own chip, the same shape as the current level chip in
              the header (user request). */}
          <span
            className="inline-flex h-6 w-10 shrink-0 items-center justify-center rounded-full bg-brand-green text-[10px] font-semibold text-primary-foreground shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand-green)_22%,transparent)] 2xl:text-[11px]"
            translate="no"
            title="Business English"
          >
            {t("BIZ")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-secondary" aria-hidden="true">
            <div className="h-full rounded-full bg-brand-green" style={{ width: `${percent}%` }} />
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground">
            {completed}/{total}
          </span>
          <Link
            to="/business"
            className="inline-flex shrink-0 items-center gap-0.5 rounded-md text-[11px] font-semibold text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60"
          >
            {completed > 0 ? t("Continue") : t("Start")}
            <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
