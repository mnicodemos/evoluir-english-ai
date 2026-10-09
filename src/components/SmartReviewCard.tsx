import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  Mic,
  RotateCcw,
} from "lucide-react";

import reviewListening from "@/assets/review-listening.jpg.asset.json";
import reviewMistakes from "@/assets/review-mistakes.webp";
import reviewReading from "@/assets/review-reading.webp";
import reviewWords from "@/assets/review-words.webp";
import reviewWriting from "@/assets/review-writing.jpg.asset.json";

import { EvoGuide } from "@/components/EvoGuide";
import { LearningMomentum } from "@/components/LearningMomentum";
import { PathProgressCard } from "@/components/PathProgressCard";
import { ScopeBadge } from "@/components/ScopeBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivityIndicators } from "@/hooks/useActivityIndicators";
import { useDueReviewState } from "@/hooks/useDueReviewCount";
import { useProfile } from "@/hooks/useProfile";
import { dashboardActionAvailable } from "@/lib/activityIndicators";
import { NEXT_STEP_SKILL_TEXT } from "@/lib/pedagogy/nextStep";
import { loadNextStep } from "@/lib/pedagogy/nextStep.functions";
import { SMART_REVIEW_REASON_TEXT } from "@/lib/pedagogy/smartReviewUx";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

/**
 * "Smart review" — what is worth recovering now. Semantically distinct from
 * "Your next step" (what matters most now). Everything shown here is decided
 * server-side; this section only presents it, and it renders nothing when there
 * is no valid recommendation.
 */
export function SmartReviewCard({
  streakDays,
  compact = false,
  mistakesDue = 0,
  extrasReady = true,
}: {
  streakDays: number;
  compact?: boolean;
  /** "My mistakes" corrections whose review date has arrived (compact card only). */
  mistakesDue?: number;
  /** False while the caller is still counting due mistakes (compact card). */
  extrasReady?: boolean;
}) {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);

  const { data: profile } = useProfile();
  const indicators = useActivityIndicators();
  // Same query key as the next step: the data is already in cache, so this
  // section adds no request at all.
  const { data, isLoading, isError } = useQuery({
    queryKey: ["next-step", profile?.level ?? null],
    queryFn: () => loadNextStep({ data: undefined }),
    staleTime: 60 * 1000,
  });
  // Vocabulary words whose spaced review date has arrived (same count as the bell).
  const { count: reviewCount, ready: reviewsReady } = useDueReviewState(profile?.id);
  // Never wait longer than this for the extra answers (a vocabulary batch being
  // written can keep "today's practice" loading for a minute).
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setWaited(true), 4000);
    return () => window.clearTimeout(timer);
  }, []);

  // Compact card: the rows depend on four answers (suggestions, due words,
  // due mistakes, what was done today). Drawing before all of them arrive made
  // rows appear and vanish on load, so it waits, keeping the card's shape.
  if (compact && (isLoading || (!waited && (!indicators.ready || !reviewsReady || !extrasReady)))) {
    return (
      <section
        className="card-soft flex h-full min-w-0 flex-col p-3 xl:p-4"
        aria-busy="true"
        aria-label={t("Keep improving")}
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <BookOpen
            className="size-[1.65rem] text-dashboard-cyan"
            strokeWidth={2.5}
            aria-hidden="true"
          />
          <h2 className="font-display text-sm font-semibold">{t("Keep improving")}</h2>
          <ScopeBadge kind="continuous" translate={t} />
        </div>
        <div className="mt-3 grid flex-1 grid-rows-3 gap-2 xl:mt-4">
          <Skeleton className="h-full min-h-10 w-full rounded-md" />
          <Skeleton className="h-full min-h-10 w-full rounded-md" />
          <Skeleton className="h-full min-h-10 w-full rounded-md" />
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section
        className={compact ? "card-soft h-full p-4" : "card-soft p-5"}
        aria-busy="true"
        aria-label={t("Smart review")}
      >
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-4 w-64" />
      </section>
    );
  }

  // An error here must never break the dashboard: the section simply steps out.
  if (isError || !data) return null;

  const allItems = (data.reviews ?? []).filter((item) =>
    dashboardActionAvailable(item.resource.to, indicators),
  );
  // Due word reviews take the first row on the compact card and replace the
  // generic Vocabulary suggestion, so the same skill never shows twice.
  const showWordReviews = compact && reviewCount > 0;
  const items = showWordReviews ? allItems.filter((item) => item.skill !== "vocabulary") : allItems;
  const showMistakes = compact && mistakesDue > 0;
  // Up to three rows: due words, due mistakes, then the server's suggestions.
  const suggestionSlots = 3 - Number(showWordReviews) - Number(showMistakes);
  const rows =
    Number(showWordReviews) + Number(showMistakes) + Math.min(items.length, suggestionSlots);
  // Reviews use the whole history (every level), so any measured skill counts.
  const measured = (data.skills ?? []).some((skill) => skill.score !== null);
  if (items.length === 0 && !showWordReviews && !showMistakes) {
    // Compact Dashboard slot keeps its place: everything to review is done.
    if (!compact) return null;
    return (
      <section
        className="card-soft flex h-full min-w-0 flex-col p-3 xl:p-4"
        aria-labelledby="smart-review-title"
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <BookOpen
            className="size-[1.65rem] text-dashboard-cyan"
            strokeWidth={2.5}
            aria-hidden="true"
          />
          <h2 id="smart-review-title" className="font-display text-sm font-semibold">
            {t("Keep improving")}
          </h2>
          <ScopeBadge kind="continuous" translate={t} />
        </div>
        {measured ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
            <CheckCircle2 className="size-8 text-brand-green" aria-hidden="true" />
            <p className="text-sm font-semibold">{t("All reviews done for now")}</p>
            <p className="text-[11px] text-muted-foreground">
              {t("New reviews appear after your next lesson.")}
            </p>
          </div>
        ) : (
          // Nothing measured yet: "all done" would be untrue, so it says what fills it.
          <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
            <Clock className="size-8 text-brand-green" strokeWidth={1.8} aria-hidden="true" />
            <p className="text-sm font-semibold">{t("No reviews yet")}</p>
            <p className="text-[11px] text-muted-foreground">
              {t("Your reviews appear here once EVO measures your skills in lessons and practice.")}
            </p>
          </div>
        )}
      </section>
    );
  }

  if (compact) {
    return (
      <section
        className="card-soft flex h-full min-w-0 flex-col p-3 xl:p-4"
        aria-labelledby="smart-review-title"
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <BookOpen
            className="size-[1.65rem] text-dashboard-cyan"
            strokeWidth={2.5}
            aria-hidden="true"
          />
          <h2 id="smart-review-title" className="font-display text-sm font-semibold">
            {t("Keep improving")}
          </h2>
          <ScopeBadge kind="continuous" translate={t} />
        </div>
        <ul
          className={`mt-3 grid flex-1 gap-2 overflow-hidden xl:mt-4 xl:gap-2 ${
            rows >= 3 ? "grid-rows-3" : "grid-rows-2"
          }`}
        >
          {showWordReviews && (
            <li className="grid min-h-0 min-w-0 grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-md border border-brand-green/35 bg-brand-green/[0.07] pr-2">
              <img src={reviewWords} alt="" className="h-full min-h-0 w-16 object-cover" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">{t("Vocabulary")}</p>
                <p className="truncate text-sm font-semibold">
                  {reviewCount === 1
                    ? t("Review 1 word")
                    : t("Review {n} words").replace("{n}", String(reviewCount))}
                </p>
                <p
                  className={`text-[10px] leading-tight text-muted-foreground ${rows >= 3 ? "line-clamp-1" : "line-clamp-2"}`}
                >
                  {t("Their review date has arrived: a quick review keeps them in memory.")}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/vocabulary" aria-label={`${t("Review now")}: ${t("Vocabulary")}`}>
                  {t("Review")}
                </Link>
              </Button>
            </li>
          )}
          {showMistakes && (
            <li className="grid min-h-0 min-w-0 grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-md border border-warning/35 bg-warning/[0.07] pr-2">
              <img src={reviewMistakes} alt="" className="h-full min-h-0 w-16 object-cover" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">{t("My mistakes")}</p>
                <p className="truncate text-sm font-semibold">
                  {mistakesDue === 1
                    ? t("Review 1 mistake")
                    : t("Review {n} mistakes").replace("{n}", String(mistakesDue))}
                </p>
                <p
                  className={`text-[10px] leading-tight text-muted-foreground ${rows >= 3 ? "line-clamp-1" : "line-clamp-2"}`}
                >
                  {t("Fix them now so they do not become habits.")}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/mistakes" aria-label={`${t("Review now")}: ${t("My mistakes")}`}>
                  {t("Review")}
                </Link>
              </Button>
            </li>
          )}
          {items.slice(0, Math.max(suggestionSlots, 0)).map((item) => {
            const skillLabel = t(NEXT_STEP_SKILL_TEXT[item.skill] ?? item.skill);
            return (
              <li
                key={item.skill}
                className="grid min-h-0 min-w-0 grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-md border border-border bg-secondary/45 pr-2"
              >
                {SKILL_PHOTO[item.skill as keyof typeof SKILL_PHOTO] ? (
                  <img
                    src={SKILL_PHOTO[item.skill as keyof typeof SKILL_PHOTO]}
                    alt=""
                    className="h-full min-h-0 w-16 object-cover"
                  />
                ) : (
                  // Skills without their own photo get their icon, so one skill
                  // never borrows another skill's picture.
                  <SkillTile skill={item.skill} />
                )}
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground">{skillLabel}</p>
                  <p className="truncate text-sm font-semibold">{t(item.resource.title)}</p>
                  <p
                    className={`text-[10px] leading-tight text-muted-foreground ${rows >= 3 ? "line-clamp-1" : "line-clamp-2"}`}
                  >
                    {t(SMART_REVIEW_REASON_TEXT[item.category])}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  {item.resource.params ? (
                    <Link
                      to="/learning/$lessonId"
                      params={item.resource.params}
                      aria-label={`${t("Review now")}: ${skillLabel}`}
                    >
                      {t("Review")}
                    </Link>
                  ) : (
                    <Link to={item.resource.to} aria-label={`${t("Review now")}: ${skillLabel}`}>
                      {t("Review")}
                    </Link>
                  )}
                </Button>
              </li>
            );
          })}
          {rows === 1 && (
            // A single review would leave half the card empty: say the rest is done.
            <li className="flex min-h-0 items-center justify-center gap-2 rounded-md border border-dashed border-border text-xs text-muted-foreground">
              <CheckCircle2 className="size-4 shrink-0 text-brand-green" aria-hidden="true" />
              {t("Nothing else to review right now.")}
            </li>
          )}
        </ul>
      </section>
    );
  }

  return (
    <section className="card-soft p-5" aria-labelledby="smart-review-title">
      <div className="grid min-w-0 lg:grid-cols-2 lg:gap-x-0">
        <div className="lg:pr-5">
          <EvoGuide title={t("This is a good skill to reinforce now.")} imageSize="lesson" />
        </div>
        <LearningMomentum streakDays={streakDays} />
      </div>

      <div className="mt-5 grid min-w-0 border-t border-border pt-5 lg:grid-cols-2 lg:gap-x-0">
        <div className="flex min-w-0 items-start gap-4 lg:pr-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary">
            <RotateCcw className="size-5 text-[oklch(0.45_0.11_255)]" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="smart-review-title" className="text-lg font-semibold">
              {t("Smart review")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("Worth recovering now")}</p>

            <ul className="mt-4 grid gap-4">
              {items.map((item) => {
                const skillLabel = t(NEXT_STEP_SKILL_TEXT[item.skill] ?? item.skill);
                return (
                  <li
                    key={item.skill}
                    className="min-w-0 border-t border-border pt-4 first:border-t-0 first:pt-0"
                  >
                    <p className="break-words font-medium">{skillLabel}</p>
                    <p className="mt-0.5 break-words text-sm text-muted-foreground">
                      {t(SMART_REVIEW_REASON_TEXT[item.category])}
                    </p>
                    <p className="mt-1 break-words text-sm">
                      {t("How to practice")}:{" "}
                      <span className="font-medium">{t(item.resource.title)}</span>
                    </p>
                    {item.resource.params ? (
                      <Button asChild variant="outline" className="mt-3 w-full sm:w-auto">
                        <Link
                          to="/learning/$lessonId"
                          params={item.resource.params}
                          aria-label={`${t("Review now")}: ${skillLabel}`}
                        >
                          {t("Review now")}
                          <ArrowRight aria-hidden="true" />
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild variant="outline" className="mt-3 w-full sm:w-auto">
                        <Link
                          to={item.resource.to}
                          aria-label={`${t("Review now")}: ${skillLabel}`}
                        >
                          {t("Review now")}
                          <ArrowRight aria-hidden="true" />
                        </Link>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="mt-5 min-w-0 border-t border-border pt-5 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <PathProgressCard embedded />
        </div>
      </div>
    </section>
  );
}

const SKILL_PHOTO = {
  listening: reviewListening.url,
  reading: reviewReading,
  vocabulary: reviewWords,
  writing: reviewWriting.url,
} as const;

const SKILL_TILE = {
  speaking: { icon: Mic, tone: "bg-dashboard-coral/15 text-dashboard-coral" },
  grammar: { icon: GraduationCap, tone: "bg-dashboard-purple/15 text-dashboard-purple" },
} as const;

function SkillTile({ skill }: { skill: string }) {
  const tile = SKILL_TILE[skill as keyof typeof SKILL_TILE] ?? {
    icon: BookOpen,
    tone: "bg-brand-green/15 text-brand-green",
  };
  const Icon = tile.icon;
  return (
    <span className={`grid h-full min-h-0 w-16 place-items-center ${tile.tone}`} aria-hidden="true">
      <Icon className="size-6" />
    </span>
  );
}
