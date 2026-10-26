import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronsRight,
  GraduationCap,
  Mic,
  RotateCcw,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import reviewListening from "@/assets/review-listening.jpg.asset.json";
import reviewGrammar from "@/assets/review-grammar.webp";
import reviewLesson from "@/assets/review-lesson.webp";
import reviewMistakes from "@/assets/review-mistakes.webp";
import reviewPronunciation from "@/assets/review-pronunciation.webp";
import reviewReading from "@/assets/review-reading.webp";
import reviewSpeaking from "@/assets/review-speaking.webp";
import reviewWords from "@/assets/review-words.webp";
import reviewWriting from "@/assets/review-writing.jpg.asset.json";

import { EvoGuide } from "@/components/EvoGuide";
import { LearningMomentum } from "@/components/LearningMomentum";
import { PathProgressCard } from "@/components/PathProgressCard";
import { ScopeBadge } from "@/components/ScopeBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTodayActivities } from "@/components/DailyGoalCard";
import { useActivityIndicators } from "@/hooks/useActivityIndicators";
import { useDailyReadingDone } from "@/hooks/useDailyReadingDone";
import { useDueReviewState } from "@/hooks/useDueReviewCount";
import { useProfile } from "@/hooks/useProfile";
import { dashboardActionAvailable } from "@/lib/activityIndicators";
import { continueRows, goFurtherRow, newTodayRows } from "@/lib/keepImprovingNew";
import { NEXT_STEP_SKILL_TEXT } from "@/lib/pedagogy/nextStep";
import { useNextStep } from "@/hooks/useNextStep";
import { SMART_REVIEW_MAX_ITEMS, SMART_REVIEW_REASON_TEXT } from "@/lib/pedagogy/smartReviewUx";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { ClockHands, DoneSeal } from "@/components/DoneSeal";

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
  // The EVO card's query (shared cache, and the answer kept from the last
  // visit), so the rows no longer wait for the server's next step.
  const { data, isLoading, isError } = useNextStep();
  // Vocabulary words whose spaced review date has arrived (same count as the bell).
  const { count: reviewCount, ready: reviewsReady } = useDueReviewState(profile?.id);
  // Today's reading, for the "New today" rows (same query as the bell).
  const { data: readingDone } = useDailyReadingDone(profile?.id);
  // Today's minutes against the goal: until it is met, free rows keep a next
  // step. The same query as Today's Progress, read without its Realtime
  // channel: useMinutesToday's channel already exists on the Dashboard, and
  // opening it twice threw and broke the page.
  const { data: todayActivities } = useTodayActivities(profile?.id);
  const minutesToday = todayActivities?.reduce((sum, row) => sum + (row.duration_minutes ?? 0), 0);
  const goalMinutes = profile?.daily_minutes ?? 0;
  const goalReached = goalMinutes > 0 && (minutesToday ?? 0) >= goalMinutes;
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
  if (
    compact &&
    (isLoading ||
      (!waited &&
        (!indicators.ready ||
          !reviewsReady ||
          !extrasReady ||
          readingDone === undefined ||
          minutesToday === undefined)))
  ) {
    return (
      <section
        className="card-soft flex h-full min-w-0 flex-col p-3 xl:p-4"
        aria-busy="true"
        aria-label={t("Keep Improving")}
      >
        <div className="flex min-h-[1.65rem] items-center gap-2">
          <BookOpen
            className="size-[1.65rem] text-dashboard-cyan"
            strokeWidth={2.5}
            aria-hidden="true"
          />
          <h2 className="font-display text-sm font-semibold">{t("Keep Improving")}</h2>
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
  const shownItems = items.slice(0, Math.max(suggestionSlots, 0));
  // Rows still free take today's new activities, the ones the bell lists, so
  // the card never says "all done" while there is something new to do (user
  // request, 2026-10-24). Never where another Dashboard button already goes.
  const taken = [
    data.activity.to,
    data.quickWin?.activity.to ?? "",
    data.quest?.resource.to ?? "",
    ...shownItems.map((item) => item.resource.to),
    ...(showWordReviews ? ["/vocabulary"] : []),
  ];
  const newRows = compact
    ? newTodayRows({ readingDone, indicators, taken, slots: suggestionSlots - shownItems.length })
    : [];
  // Until today's minutes goal is met, rows still free keep a next step that
  // never runs out (user decision, 2026-10-24); once it is met, the card may
  // end in its done state.
  const keepGoing = compact
    ? continueRows({
        goalReached,
        taken: [...taken, ...newRows.map((row) => row.to)],
        slots: suggestionSlots - shownItems.length - newRows.length,
      })
    : [];
  const rows =
    Number(showWordReviews) +
    Number(showMistakes) +
    shownItems.length +
    newRows.length +
    keepGoing.length;
  // Reviews use the whole history (every level), so any measured skill counts.
  const measured = (data.skills ?? []).some((skill) => skill.score !== null);
  if (rows === 0 || (!compact && items.length === 0)) {
    // Compact Dashboard slot keeps its place: everything to review is done.
    if (!compact) return null;
    const goFurther = goFurtherRow(taken);
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
            {t("Keep Improving")}
          </h2>
          <ScopeBadge kind="continuous" translate={t} />
        </div>
        {measured ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
            <DoneSeal />
            <p className="text-sm font-semibold">{t("All reviews done for now")}</p>
            <p className="text-[11px] text-muted-foreground">
              {t("New reviews appear after your next lesson.")}
            </p>
          </div>
        ) : (
          // Nothing measured yet: "all done" would be untrue, so it says what fills it.
          <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
            <DoneSeal icon={ClockHands} />
            <p className="text-sm font-semibold">{t("No reviews yet")}</p>
            <p className="text-[11px] text-muted-foreground">
              {t("Your reviews appear here once EVO measures your skills in lessons and practice.")}
            </p>
          </div>
        )}
        {/* The day is done: one optional invitation, never pressure. */}
        <Link
          to={goFurther.to}
          className="mt-2 flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-3 text-xs text-muted-foreground transition-colors hover:border-brand-green/45 hover:text-foreground"
        >
          {t("Want to go further?")}{" "}
          <span className="font-semibold text-brand-green">{t(goFurther.title)}</span>
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
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
            {t("Keep Improving")}
          </h2>
          <ScopeBadge kind="continuous" translate={t} />
        </div>
        <ul
          className={`mt-3 grid flex-1 gap-2 overflow-hidden xl:mt-4 xl:gap-2 ${
            rows >= 3 ? "grid-rows-3" : "grid-rows-2"
          }`}
        >
          {showWordReviews && (
            <li className="grid min-h-0 min-w-0 grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-lg border border-brand-green/35 bg-brand-green/[0.07] p-1 pr-2">
              <img src={reviewWords} alt="" className={ROW_PHOTO} />
              <div className="min-w-0">
                <RowTag kind="review" label={t("To review")} detail={t("Vocabulary")} />
                <p className="truncate text-sm font-semibold">
                  {reviewCount === 1
                    ? t("Review 1 word")
                    : t("Review {n} words").replace("{n}", String(reviewCount))}
                </p>
                <p
                  className={`text-[10px] leading-tight text-muted-foreground ${rows >= 3 ? ROW_NOTE_TIGHT : "line-clamp-2"}`}
                >
                  {t("Their review date has arrived: a quick review keeps them in memory.")}
                </p>
              </div>
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <Link to="/vocabulary" aria-label={`${t("Review now")}: ${t("Vocabulary")}`}>
                  <RefreshCw className="size-5" strokeWidth={2.25} aria-hidden="true" />
                </Link>
              </Button>
            </li>
          )}
          {showMistakes && (
            <li className="grid min-h-0 min-w-0 grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-lg border border-warning/35 bg-warning/[0.07] p-1 pr-2">
              <img src={reviewMistakes} alt="" className={ROW_PHOTO} />
              <div className="min-w-0">
                <RowTag kind="review" label={t("To review")} detail={t("My mistakes")} />
                <p className="truncate text-sm font-semibold">
                  {mistakesDue === 1
                    ? t("Review 1 mistake")
                    : t("Review {n} mistakes").replace("{n}", String(mistakesDue))}
                </p>
                <p
                  className={`text-[10px] leading-tight text-muted-foreground ${rows >= 3 ? ROW_NOTE_TIGHT : "line-clamp-2"}`}
                >
                  {t("Fix them now so they do not become habits.")}
                </p>
              </div>
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <Link to="/mistakes" aria-label={`${t("Review now")}: ${t("My mistakes")}`}>
                  <RefreshCw className="size-5" strokeWidth={2.25} aria-hidden="true" />
                </Link>
              </Button>
            </li>
          )}
          {shownItems.map((item) => {
            const skillLabel = t(NEXT_STEP_SKILL_TEXT[item.skill] ?? item.skill);
            return (
              <li
                key={item.skill}
                className="grid min-h-0 min-w-0 grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-lg border border-border bg-secondary/45 p-1 pr-2"
              >
                {SKILL_PHOTO[item.skill as keyof typeof SKILL_PHOTO] ? (
                  <img
                    src={SKILL_PHOTO[item.skill as keyof typeof SKILL_PHOTO]}
                    alt=""
                    className={ROW_PHOTO}
                  />
                ) : (
                  // Skills without their own photo get their icon, so one skill
                  // never borrows another skill's picture.
                  <SkillTile skill={item.skill} />
                )}
                <div className="min-w-0">
                  {/* A lesson row opens the Learning path, so it says so before
                      the skill it reinforces (user request). */}
                  <RowTag
                    kind="review"
                    label={t("To review")}
                    detail={item.resource.params ? `${t("Learning")} · ${skillLabel}` : skillLabel}
                  />
                  <p className="truncate text-sm font-semibold">{t(item.resource.title)}</p>
                  <p
                    className={`text-[10px] leading-tight text-muted-foreground ${rows >= 3 ? ROW_NOTE_TIGHT : "line-clamp-2"}`}
                  >
                    {t(SMART_REVIEW_REASON_TEXT[item.category])}
                  </p>
                </div>
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 text-white/70 hover:bg-white/10 hover:text-white"
                >
                  {item.resource.params ? (
                    <Link
                      to="/learning/$lessonId"
                      params={item.resource.params}
                      aria-label={`${t("Review now")}: ${skillLabel}`}
                    >
                      <RefreshCw className="size-5" strokeWidth={2.25} aria-hidden="true" />
                    </Link>
                  ) : (
                    <Link to={item.resource.to} aria-label={`${t("Review now")}: ${skillLabel}`}>
                      <RefreshCw className="size-5" strokeWidth={2.25} aria-hidden="true" />
                    </Link>
                  )}
                </Button>
              </li>
            );
          })}
          {newRows.map((row) => (
            <li
              key={row.key}
              className="grid min-h-0 min-w-0 grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-lg border border-dashed border-brand-green/45 bg-brand-green/[0.04] p-1 pr-2"
            >
              <img src={SKILL_PHOTO[row.key]} alt="" className={ROW_PHOTO} />
              <div className="min-w-0">
                {/* "New today", never a review: the same item the bell lists. */}
                <RowTag kind="new" label={t("New today")} />
                <p className="truncate text-sm font-semibold">{t(row.title)}</p>
                <p
                  className={`text-[10px] leading-tight text-muted-foreground ${rows >= 3 ? ROW_NOTE_TIGHT : "line-clamp-2"}`}
                >
                  {t(row.line)}
                </p>
              </div>
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <Link to={row.to} aria-label={`${t("Start now")}: ${t(row.title)}`}>
                  <ArrowRight className="size-5" strokeWidth={2.25} aria-hidden="true" />
                </Link>
              </Button>
            </li>
          ))}
          {keepGoing.map((row) => (
            <li
              key={row.key}
              className="grid min-h-0 min-w-0 grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-lg border border-border bg-secondary/30 p-1 pr-2"
            >
              <ContinueTile rowKey={row.key} />
              <div className="min-w-0">
                <RowTag kind="continue" label={t("Keep going")} />
                <p className="truncate text-sm font-semibold">{t(row.title)}</p>
                <p
                  className={`text-[10px] leading-tight text-muted-foreground ${rows >= 3 ? ROW_NOTE_TIGHT : "line-clamp-2"}`}
                >
                  {t(row.line)}
                </p>
              </div>
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <Link to={row.to} aria-label={`${t("Start now")}: ${t(row.title)}`}>
                  <ArrowRight className="size-5" strokeWidth={2.25} aria-hidden="true" />
                </Link>
              </Button>
            </li>
          ))}
          {rows === 1 && (
            // A single review would leave half the card empty: say the rest is done.
            <li className="flex min-h-0 items-center justify-center gap-2 rounded-md border border-dashed border-border text-xs text-muted-foreground">
              <DoneSeal size="sm" />
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
              {items.slice(0, SMART_REVIEW_MAX_ITEMS).map((item) => {
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

// The owner's photos (user request); a skill without one falls back to its icon.
const SKILL_PHOTO = {
  grammar: reviewGrammar,
  listening: reviewListening.url,
  pronunciation: reviewPronunciation,
  reading: reviewReading,
  speaking: reviewSpeaking,
  vocabulary: reviewWords,
  writing: reviewWriting.url,
} as const;

const SKILL_TILE = {
  speaking: { icon: Mic, tone: "bg-dashboard-coral/15 text-dashboard-coral" },
  grammar: { icon: GraduationCap, tone: "bg-dashboard-purple/15 text-dashboard-purple" },
} as const;

/**
 * What a row is (user request, 2026-10-24: tell reviews and new activities
 * apart at a glance): "Review" with the circular arrows for what comes back
 * from earlier work, "New today" with sparkles in brand green for today's new
 * activities, which also get a dashed green border.
 */
function RowTag({
  kind,
  label,
  detail,
}: {
  kind: "review" | "new" | "continue";
  label: string;
  detail?: string;
}) {
  const Icon = kind === "new" ? Sparkles : kind === "continue" ? ChevronsRight : RefreshCw;
  return (
    <p className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
      <span
        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.06em] ring-1 ring-inset ${
          kind === "new"
            ? "bg-brand-green/15 text-brand-green ring-brand-green/35"
            : kind === "continue"
              ? "bg-white/[0.06] text-foreground/80 ring-white/15"
              : "bg-sky-400/10 text-sky-300 ring-sky-400/30"
        }`}
      >
        <Icon className="size-2.5" strokeWidth={2.5} aria-hidden="true" />
        {label}
      </span>
      {detail && <span className="truncate">{detail}</span>}
    </p>
  );
}

/** Photo of a "Keep going" row: EVO's conversation, the teacher, reading, a lesson. */
/**
 * A row's photo follows the row's text instead of setting its height (audit,
 * 2026-10-26: each 64 px square photo made the three rows 74 px tall, which
 * pushed the Dashboard past one screen): no height of its own while the row is
 * sized (h-0), then the row's full height (min-h-full, self-stretch).
 */
const ROW_PHOTO = "h-0 min-h-full w-16 self-stretch rounded-md object-cover";

/**
 * With three rows, each row's note keeps one line, and on desktop screens up
 * to 62rem tall (where the Dashboard's gaps also tighten) it leaves, so the
 * card is no taller than Your English Skills beside it (audit, 2026-10-26).
 */
const ROW_NOTE_TIGHT = "line-clamp-1 [@media(min-width:80rem)_and_(max-height:62rem)]:hidden";

function ContinueTile({ rowKey }: { rowKey: "coach" | "teacher" | "reading" | "learning" }) {
  // Every row has its photo; the next lesson took the owner's "Lessons
  // learned" photo (user request, 2026-10-25) instead of an icon tile.
  const photo =
    rowKey === "coach"
      ? reviewSpeaking
      : rowKey === "teacher"
        ? reviewGrammar
        : rowKey === "reading"
          ? reviewReading
          : reviewLesson;
  return <img src={photo} alt="" className={ROW_PHOTO} />;
}

function SkillTile({ skill }: { skill: string }) {
  const tile = SKILL_TILE[skill as keyof typeof SKILL_TILE] ?? {
    icon: BookOpen,
    tone: "bg-brand-green/15 text-brand-green",
  };
  const Icon = tile.icon;
  return (
    <span
      className={`grid h-0 min-h-full w-16 self-stretch place-items-center rounded-md ${tile.tone}`}
      aria-hidden="true"
    >
      <Icon className="size-6" />
    </span>
  );
}
