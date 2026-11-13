import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Flower2,
  Headphones,
  Pause,
  PictureInPicture2,
  Play,
  Square,
  Timer,
} from "lucide-react";

import { notifyLife } from "@/components/life/LifeNotification";
import { stopFocusSaving } from "@/components/focus/stopFocus";
import { LifeSectionTitle, useLifeT } from "@/components/life/LifeNav";
import { Button } from "@/components/ui/button";
import { useFocusLog } from "@/hooks/useFocusLog";
import { useFocusTimer } from "@/hooks/useFocusTimer";
import { useStudyWeekdays } from "@/hooks/useStudyWeekdays";
import { useLife } from "@/hooks/useLife";
import { useProfile } from "@/hooks/useProfile";
import {
  focusClearLastTask,
  focusPause,
  focusResume,
  focusSetPreset,
  focusSetTask,
  focusSkipBreak,
  focusStart,
  openFocusWidget,
} from "@/lib/focusTimer";
import { haptic } from "@/lib/haptics";
import {
  FOCUS_DAILY_TARGET,
  FOCUS_PRESET_IDS,
  FOCUS_PRESETS,
  focusClock,
  focusSummary,
} from "@/lib/life";
import { setLifeTaskDone } from "@/lib/life.functions";
import { normalizeStudyDays } from "@/lib/studyPlan";
import { cn } from "@/lib/utils";

/**
 * Focus (user decision, 2026-10-17: a Pomodoro-style timer, free, kept on this
 * device; the timer itself is the shared store in src/lib/focusTimer.ts, also
 * shown by the floating window): focus blocks with a short break after each and a long one after
 * every fourth. The timer keeps its end time in localStorage, so leaving the
 * page or locking the phone never loses it; each finished block joins the
 * device's log once. Premium students can tie a block to one of today's tasks
 * and tick it in the break, which suggests two minutes of English.
 */
export function FocusSection() {
  const { t, lang } = useLifeT();
  const { data, refresh } = useLife();
  const { data: profile } = useProfile();
  const { data: sharedStudyDays } = useStudyWeekdays(
    profile?.id ?? "",
    profile?.study_days_per_week ?? 3,
  );
  const focusLog = useFocusLog();
  const markDone = useServerFn(setLifeTaskDone);
  const { state, view } = useFocusTimer();
  const [historyExpanded, setHistoryExpanded] = useState(false);

  if (!data) return null;

  const studyDays =
    sharedStudyDays ?? normalizeStudyDays(profile?.study_days, profile?.study_days_per_week ?? 3);
  const summary = focusSummary(focusLog, data.today, studyDays);
  const openTasks = data.premium
    ? data.tasks.filter((task) => task.day === data.today && !task.doneAt)
    : [];
  const lastTask = state.lastTaskId
    ? openTasks.find((task) => task.id === state.lastTaskId)
    : undefined;
  const { leftMs, share, running } = view;
  const start = () => {
    haptic("tap");
    focusStart();
  };
  const pause = focusPause;
  const resume = focusResume;
  const stop = () => stopFocusSaving(t);
  const skipBreak = focusSkipBreak;

  const weekday = (day: string) =>
    new Date(`${day}T12:00:00`).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US", {
      weekday: "narrow",
    });
  // Bars follow the minutes, so a day with only stopped blocks still shows.
  const weekMax = Math.max(1, ...summary.week.map((row) => row.minutes));

  return (
    <section id="focus" className="card-soft scroll-mt-4 p-3 sm:p-4" aria-labelledby="focus-title">
      <LifeSectionTitle
        id="focus-title"
        icon={Timer}
        accent="pink"
        title={t("Focus")}
        subtitle={t("Focus blocks with short breaks; use the breaks to practise English.")}
        meta={`🍅 ${summary.todayCount}/${FOCUS_DAILY_TARGET}`}
      >
        {/* The floating window keeps the timer at hand on any page (user request). */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs xl:w-7 xl:px-0"
          onClick={openFocusWidget}
          title={t("Floating timer")}
          aria-label={t("Floating timer")}
        >
          <PictureInPicture2 aria-hidden="true" />
          {/* An icon from xl, so the title keeps one row in the one-screen band. */}
          <span className="xl:sr-only">{t("Floating timer")}</span>
        </Button>
      </LifeSectionTitle>

      <div className="mt-2 grid min-w-0 items-center gap-3 sm:grid-cols-[6rem_minmax(0,1fr)] xl:mt-1.5 xl:grid-cols-[6rem_minmax(0,1fr)] xl:gap-2">
        {/* The countdown ring: pink while focusing, green during the break. */}
        <div className="relative mx-auto grid size-32 place-items-center xl:size-24">
          <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90" aria-hidden="true">
            <circle
              cx="40"
              cy="40"
              r="35"
              fill="none"
              strokeWidth="5"
              className="stroke-white/[0.08]"
            />
            <circle
              cx="40"
              cy="40"
              r="35"
              fill="none"
              strokeWidth="5"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray="100"
              strokeDashoffset={100 - share * 100}
              className={cn(
                "transition-[stroke-dashoffset] duration-500",
                state.phase === "break" ? "stroke-brand-green" : "stroke-pink-400",
              )}
            />
          </svg>
          <div className="text-center" role="timer" aria-live="off">
            <p className="font-display text-3xl font-bold tabular-nums xl:text-2xl">
              {focusClock(leftMs)}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {state.phase === "break"
                ? t("Break")
                : state.phase === "focus"
                  ? t("Focus")
                  : t("Ready")}
            </p>
          </div>
        </div>

        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Block length")}>
            {FOCUS_PRESET_IDS.map((id) => (
              <button
                key={id}
                type="button"
                disabled={state.phase !== "idle"}
                aria-pressed={state.preset === id}
                onClick={() => focusSetPreset(id)}
                className={cn(
                  "h-8 rounded-full border px-3 text-xs font-medium tabular-nums transition-colors disabled:opacity-50",
                  state.preset === id
                    ? "border-pink-400/50 bg-pink-400/12 text-pink-300"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {`${FOCUS_PRESETS[id].focus} / ${FOCUS_PRESETS[id].shortBreak} min`}
              </button>
            ))}
          </div>

          {openTasks.length ? (
            <select
              value={state.taskId ?? ""}
              disabled={state.phase === "focus"}
              onChange={(event) => focusSetTask(event.target.value || null)}
              aria-label={t("Task for this block")}
              className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value="">{t("No task")}</option>
              {openTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {state.phase === "idle" ? (
              <Button
                onClick={start}
                className="gap-1.5 bg-brand-green text-sidebar hover:bg-brand-green/90"
              >
                <Play aria-hidden="true" />
                {t("Start focus")}
              </Button>
            ) : (
              <>
                {running ? (
                  <Button variant="outline" onClick={pause} className="gap-1.5">
                    <Pause aria-hidden="true" />
                    {t("Pause")}
                  </Button>
                ) : (
                  <Button
                    onClick={resume}
                    className="gap-1.5 bg-brand-green text-sidebar hover:bg-brand-green/90"
                  >
                    <Play aria-hidden="true" />
                    {t("Resume")}
                  </Button>
                )}
                {state.phase === "break" ? (
                  <Button variant="ghost" onClick={skipBreak}>
                    {t("Skip break")}
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={stop} className="gap-1.5">
                    <Square aria-hidden="true" />
                    {t("Stop")}
                  </Button>
                )}
              </>
            )}
          </div>
          {state.phase === "focus" ? (
            <p className="text-xs text-muted-foreground">
              {t("Stopping keeps the minutes done; only a finished block counts as a 🍅.")}
            </p>
          ) : null}
        </div>
      </div>

      {state.phase === "break" ? (
        <div className="mt-3 space-y-2 rounded-xl border border-brand-green/25 bg-brand-green/[0.06] p-2.5">
          {lastTask ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="min-w-0">
                {t("Did you finish this task?")}{" "}
                <span className="font-medium" translate="no">
                  {lastTask.title}
                </span>
              </span>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() =>
                  void markDone({ data: { id: lastTask.id, done: true } })
                    .then(() => {
                      haptic("tap");
                      focusClearLastTask();
                      refresh();
                    })
                    .catch(() => notifyLife(t("The task could not be saved."), "error"))
                }
              >
                <Check aria-hidden="true" />
                {t("Mark as done")}
              </Button>
            </div>
          ) : null}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
              {t("Two minutes of English in your break")}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <a
                href="#meditation"
                className="flex items-center gap-2 rounded-lg bg-secondary/60 p-2.5 text-sm hover:bg-secondary"
              >
                <Flower2 className="size-4 shrink-0 text-rose-400" aria-hidden="true" />
                {t("Two-minute break")}
              </a>
              <Link
                to="/vocabulary"
                className="flex items-center gap-2 rounded-lg bg-secondary/60 p-2.5 text-sm hover:bg-secondary"
              >
                <BookOpen className="size-4 shrink-0 text-sky-400" aria-hidden="true" />
                {t("Review words")}
              </Link>
              <Link
                to="/listening"
                className="flex items-center gap-2 rounded-lg bg-secondary/60 p-2.5 text-sm hover:bg-secondary"
              >
                <Headphones className="size-4 shrink-0 text-violet-400" aria-hidden="true" />
                {t("Train your ear")}
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* Always show all seven days; planned and extra study days remain distinct. */}
      <div className="mt-3 border-t border-white/10 pt-2.5 xl:mt-2 xl:pt-2">
        <div className="flex items-end justify-between gap-3">
          <ol
            className="flex h-10 flex-1 items-end gap-1.5 xl:h-8"
            aria-label={t("Focus this week")}
          >
            {summary.week.map((row) => (
              <li key={row.day} className="flex flex-1 flex-col items-center gap-1">
                <span
                  className={cn(
                    "w-full max-w-6 rounded-sm",
                    row.planned
                      ? row.minutes
                        ? "bg-pink-400/80"
                        : "bg-pink-400/20"
                      : row.minutes
                        ? "bg-amber-400/80"
                        : "bg-white/[0.08]",
                  )}
                  style={{ height: `${Math.max(3, (row.minutes / weekMax) * 28)}px` }}
                  title={`🍅 ${row.count} · ${row.minutes} min · ${row.planned ? t("Planned day") : t("Extra study day")}`}
                />
                <span
                  className={cn(
                    "text-[10px] uppercase",
                    row.planned ? "text-muted-foreground" : row.minutes ? "text-amber-400" : "text-muted-foreground/60",
                  )}
                >
                  {weekday(row.day)}
                </span>
              </li>
            ))}
          </ol>
          <p className="shrink-0 text-right text-xs text-muted-foreground">
            <span className="block font-display text-base font-semibold tabular-nums text-foreground">
              {`${summary.weekMinutes} min`}
            </span>
            {t("in 7 days")}
          </p>
        </div>
        {summary.extraWeekMinutes > 0 ? (
          <p className="mt-1 text-right text-[11px] text-muted-foreground">
            {summary.extraWeekMinutes} min {t("studied outside planned days")}
          </p>
        ) : null}
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <div className="rounded-lg bg-secondary/50 p-2">
            <span className="block text-muted-foreground">{t("Completed sessions")}</span>
            <strong className="mt-1 block font-display text-lg tabular-nums">
              {summary.completedCount}
            </strong>
          </div>
          <div className="rounded-lg bg-secondary/50 p-2">
            <span className="block text-muted-foreground">{t("Completion rate")}</span>
            <strong className="mt-1 block font-display text-lg tabular-nums">
              {summary.completionRate}%
            </strong>
          </div>
          <div className="rounded-lg bg-secondary/50 p-2">
            <span className="block text-muted-foreground">{t("Partial sessions")}</span>
            <strong className="mt-1 block font-display text-lg tabular-nums">
              {summary.partialCount}
            </strong>
          </div>
        </div>
        {focusLog.length ? (
          <div className="mt-3 border-t border-white/10 pt-2.5">
            <button
              type="button"
              aria-expanded={historyExpanded}
              aria-controls="focus-session-history"
              onClick={() => setHistoryExpanded((expanded) => !expanded)}
              className="flex min-h-8 w-full items-center justify-between gap-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
            >
              <span>
                {t("Recent focus sessions")}
                <span className="ml-2 font-normal normal-case tracking-normal">
                  ({Math.min(focusLog.length, 5)})
                </span>
              </span>
              {historyExpanded ? (
                <ChevronUp className="size-4 shrink-0" aria-hidden="true" />
              ) : (
                <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
              )}
            </button>
            {historyExpanded ? (
              <ol id="focus-session-history" className="mt-2 space-y-2">
                {[...focusLog]
                  .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
                  .slice(0, 5)
                  .map((session) => (
                    <li
                      key={session.key}
                      className="flex items-center justify-between gap-3 rounded-lg bg-secondary/40 px-3 py-2 text-xs"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {session.activity
                            ? t(session.activity)
                            : session.taskId
                              ? t("Life task")
                              : t("Independent focus")}
                        </span>
                        <span className="block text-muted-foreground">
                          {session.endedAt
                            ? new Date(session.endedAt).toLocaleString(
                                lang === "pt" ? "pt-BR" : "en-US",
                                { dateStyle: "short", timeStyle: "short" },
                              )
                            : session.day}
                        </span>
                      </span>
                      <span className="shrink-0 text-right tabular-nums">
                        <strong>{session.minutes} min</strong>
                        <span className="block text-muted-foreground">
                          {session.partial ? t("Stopped early") : t("Completed")}
                        </span>
                      </span>
                    </li>
                  ))}
              </ol>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
