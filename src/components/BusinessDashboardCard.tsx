import { Link } from "@tanstack/react-router";
import { BookOpen, Briefcase, Check, ChevronRight } from "lucide-react";
import { useMemo } from "react";

import { useLessons, useUserLessons } from "@/hooks/useLearning";
import { useProfile } from "@/hooks/useProfile";
import { getBusinessCourse } from "@/lib/businessCourse";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { cn } from "@/lib/utils";
import { PremiumBadge, useIsPremium } from "@/components/PremiumBadge";

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
  // Free students see the card in its place, disabled, with the Premium badge
  // (user request); it opens the plans instead of the track.
  const locked = useIsPremium() === false;

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
  const trackDone = total > 0 && completed >= total;

  return (
    <section
      className={cn(
        "card-soft relative flex min-w-0 flex-col p-3 xl:h-full xl:min-h-0 xl:px-4 xl:py-3",
        locked && "[&>*:not(:first-child)]:opacity-50",
      )}
      aria-labelledby="business-card-title"
    >
      <div className="flex min-h-[1.65rem] items-center gap-2 xl:mt-1">
        <Briefcase
          className="size-[1.4rem] shrink-0 text-brand-green"
          strokeWidth={2.3}
          aria-hidden="true"
        />
        <h2 id="business-card-title" className="font-display text-sm font-semibold">
          {t("Business English")}
        </h2>
        <PremiumBadge className="ml-auto" />
      </div>
      <div className="mt-2 flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        {/* Room on the right for the BIZ chip. */}
        <div className="flex min-w-0 items-center gap-3 pr-[calc((100%_-_112px)/6_+_1rem)] 2xl:pr-[calc((100%_-_132px)/6_+_1rem)]">
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
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-secondary" aria-hidden="true">
            <div className="h-full rounded-full bg-brand-green" style={{ width: `${percent}%` }} />
          </div>
          {/* The track's share done (user request: % instead of n/36). */}
          <span
            className="text-[11px] font-semibold text-muted-foreground"
            title={`${completed}/${total}`}
          >
            {percent}%
          </span>
          <Link
            to={locked ? "/premium" : "/business"}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md text-[11px] font-semibold text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60"
          >
            {!locked && <BookOpen className="size-3.5 shrink-0" aria-hidden="true" />}
            {locked ? t("See plans") : completed > 0 ? t("Continue") : t("Start")}
            <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
          </Link>
        </div>
      </div>
      {/* The track's own chip, the same shape and width as a level chip in the
          header (user request), on the right edge and centred between the
          Premium badge above and the Continue link below. Both cards are 4 of
          12 columns, so a level chip is (card - 112 px) / 6: 32 px padding,
          48 px icon, 12 px gap and 5 x 4 px between chips (132 px from 2xl). */}
      <span
        className={cn(
          "absolute right-3 top-1/2 inline-flex h-6 w-[calc((100%_-_112px)/6)] -translate-y-1/2 items-center justify-center gap-0.5 rounded-full border text-[10px] font-semibold xl:right-4 2xl:w-[calc((100%_-_132px)/6)] 2xl:text-[11px]",
          // Every lesson done: the same look as a conquered level chip (user request).
          trackDone
            ? "border-brand-green/25 bg-brand-green/[0.07] text-brand-green/90"
            : "border-transparent bg-brand-green text-primary-foreground shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand-green)_22%,transparent)]",
        )}
        translate="no"
        title="Business English"
      >
        {trackDone && (
          <Check className="hidden size-3 shrink-0 2xl:block" strokeWidth={3} aria-hidden="true" />
        )}
        {t("BIZ")}
      </span>
    </section>
  );
}
