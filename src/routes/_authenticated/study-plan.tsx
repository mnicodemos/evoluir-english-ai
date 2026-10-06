import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  ChevronDown,
  Clock,
  Loader2,
  PartyPopper,
  Sparkles,
  Target,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { findLevel } from "@/lib/level";
import { loadStudyPlan } from "@/lib/studyPlan.functions";
import {
  planReasonText,
  STUDY_PLAN_DAYS_PER_WEEK,
  STUDY_PLAN_FOCUS_AREAS,
  STUDY_PLAN_GOALS,
  STUDY_PLAN_MINUTES,
  type StudyFocus,
  type StudyPlan,
  type StudyPlanDay,
} from "@/lib/studyPlan";

export const Route = createFileRoute("/_authenticated/study-plan")({
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · My Study Plan" },
      {
        name: "description",
        content:
          "Set your goal, availability and focus area to see a weekly English study plan built from your own lessons.",
      },
      { property: "og:title", content: "Evoluir+ English AI · My Study Plan" },
      {
        property: "og:description",
        content: "A weekly English study plan based on your goal, your time and your CEFR level.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudyPlanPage,
});

const SKILL_LABELS: Record<string, string> = {
  grammar: "Grammar",
  listening: "Listening",
  speaking: "Speaking",
  vocabulary: "Vocabulary",
  writing: "Writing",
  reading: "Reading",
};

function StudyPlanPage() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["study-plan", profile?.id],
    queryFn: () => loadStudyPlan(),
    enabled: !!profile?.id,
  });

  const [goal, setGoal] = useState("conversation");
  const [minutes, setMinutes] = useState(30);
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [focus, setFocus] = useState<StudyFocus>("balanced");

  useEffect(() => {
    if (!data) return;
    setGoal(data.preferences.goal);
    setMinutes(data.preferences.dailyMinutes);
    setDaysPerWeek(data.preferences.daysPerWeek);
    setFocus(data.preferences.focus);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Profile not loaded");
      const { error } = await supabase
        .from("profiles")
        .update({
          goal,
          daily_minutes: minutes,
          study_days_per_week: daysPerWeek,
          study_focus: focus,
        })
        .eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: ["study-plan"] }),
      ]);
      toast.success("Study plan updated");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not save your plan"),
  });

  const plan = data?.plan;
  const levelLabel = data?.preferences.level ? findLevel(data.preferences.level).label : null;
  // Settings stay folded once the plan is set up, so the week comes first.
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    if (data && !data.configured) setSettingsOpen(true);
  }, [data]);
  const next = plan && plan.nextIndex !== null ? (plan.days[plan.nextIndex] ?? null) : null;

  return (
    <AppShell mobileOneScreen>
      <div className="space-y-3 lg:space-y-4 xl:grid xl:grid-cols-[minmax(0,1.7fr)_minmax(19rem,1fr)] xl:items-start xl:gap-4 xl:space-y-0">
        <header className="animate-rise xl:col-span-2">
          <h1 className="text-lg font-bold lg:text-3xl">Your study plan</h1>
          {plan && (
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              This week · {formatRange(plan.weekStart, plan.weekEnd)}
            </p>
          )}
        </header>

        {isLoading || !plan ? (
          <div className="space-y-4 xl:col-span-2">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <>
            <div className="min-w-0 space-y-3 xl:col-start-1">
              <TodayCard plan={plan} next={next} />

              <section className="space-y-2" aria-labelledby="plan-week-title">
                <h2
                  id="plan-week-title"
                  className="flex items-center gap-2 text-base font-semibold sm:text-lg"
                >
                  <CalendarCheck className="size-4 text-primary sm:size-5" />
                  Your week
                </h2>
                <ul className="grid gap-2">
                  {plan.days.map((day, index) => (
                    <PlanDayRow key={day.date} day={day} isNext={index === plan.nextIndex} />
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  A day is done when you practise its skill this week. When there is no new lesson
                  of that skill, the plan sends you to its practice area.
                </p>
              </section>
            </div>

            <div className="min-w-0 space-y-3 xl:col-start-2 xl:row-start-2">
              <section className="card-soft p-3 sm:p-4">
                <h2 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
                  <Clock className="size-4 text-primary sm:size-5" />
                  This week
                </h2>
                <dl className="mt-2 grid grid-cols-3 gap-1.5 sm:gap-2">
                  <Stat label="Days done" value={`${plan.completedCount} / ${plan.totalCount}`} />
                  <Stat label="Progress" value={`${plan.progressPercent}%`} />
                  <Stat
                    label="Minutes"
                    value={`${plan.minutesThisWeek} / ${plan.weeklyMinutesTarget}`}
                  />
                </dl>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${plan.progressPercent}%` }}
                  />
                </div>
                {levelLabel && (
                  <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
                    Your level: {levelLabel}
                  </p>
                )}
              </section>

              <section className="card-soft p-3 sm:p-4">
                <h2 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
                  <Sparkles className="size-4 text-primary sm:size-5" />
                  Why this plan?
                </h2>
                <ul className="mt-1.5 space-y-1 sm:mt-2 sm:space-y-1.5">
                  {plan.reasons.map((reason) => (
                    <li
                      key={`${reason.code}-${reason.skill ?? ""}`}
                      className="flex items-start gap-2 text-xs sm:text-sm"
                    >
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary sm:size-4" />
                      <span className="break-words">{planReasonText(reason)}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="card-soft p-3 sm:p-4">
                <button
                  type="button"
                  onClick={() => setSettingsOpen((open) => !open)}
                  aria-expanded={settingsOpen}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <span className="flex items-center gap-2 text-base font-semibold sm:text-lg">
                    <Target className="size-4 text-primary sm:size-5" />
                    Adjust my plan
                  </span>
                  <ChevronDown
                    className={`size-4 shrink-0 text-muted-foreground transition-transform ${settingsOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>
                {settingsOpen && (
                  <div className="mt-3 space-y-2.5">
                    <Choice
                      label="Main goal"
                      options={STUDY_PLAN_GOALS.map((g) => ({ value: g.value, label: g.label }))}
                      value={goal}
                      onChange={setGoal}
                    />
                    <Choice
                      label="Daily time"
                      options={STUDY_PLAN_MINUTES.map((m) => ({
                        value: String(m),
                        label: `${m} minutes`,
                      }))}
                      value={String(minutes)}
                      onChange={(v) => setMinutes(Number(v))}
                    />
                    <Choice
                      label="Days per week"
                      options={STUDY_PLAN_DAYS_PER_WEEK.map((d) => ({
                        value: String(d),
                        label: `${d} days`,
                      }))}
                      value={String(daysPerWeek)}
                      onChange={(v) => setDaysPerWeek(Number(v))}
                    />
                    <Choice
                      label="Focus area"
                      options={STUDY_PLAN_FOCUS_AREAS.map((f) => ({
                        value: f.value,
                        label: f.label,
                      }))}
                      value={focus}
                      onChange={(v) => setFocus(v as StudyFocus)}
                    />
                    <Button
                      className="h-9 w-full sm:w-auto"
                      disabled={save.isPending || isFetching}
                      onClick={() => save.mutate()}
                    >
                      {save.isPending && <Loader2 className="size-4 animate-spin" />}
                      Save and rebuild my week
                    </Button>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

const STATUS_TEXT: Record<StudyPlanDay["status"], string> = {
  done: "Done",
  today: "Today",
  missed: "Missed",
  upcoming: "Upcoming",
};

/** "Oct 5 – Oct 11" from two YYYY-MM-DD dates (calendar dates, no time zone shift). */
function formatRange(start: string, end: string) {
  const fmt = (date: string) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

function shortDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function DayLink({
  day,
  className,
  children,
}: {
  day: StudyPlanDay;
  className: string;
  children: React.ReactNode;
}) {
  return day.lessonId ? (
    <Link to="/learning/$lessonId" params={{ lessonId: day.lessonId }} className={className}>
      {children}
    </Link>
  ) : (
    <Link to={day.to as "/listening"} className={className}>
      {children}
    </Link>
  );
}

/** What to do now: today's plan day, a missed day to catch up, or the next one. */
function TodayCard({ plan, next }: { plan: StudyPlan; next: StudyPlanDay | null }) {
  if (!next) {
    return (
      <section className="card-soft flex items-center gap-3 border-primary/40 p-4">
        <PartyPopper className="size-8 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="font-semibold">Week complete!</p>
          <p className="text-sm text-muted-foreground">
            You did every day of this week&apos;s plan. A new week starts on Monday.
          </p>
        </div>
      </section>
    );
  }
  const heading =
    next.status === "today"
      ? "Today in your plan"
      : next.status === "missed"
        ? `Catch up · ${next.day}`
        : `Next · ${next.day}`;
  return (
    <section className="card-soft border-primary/50 bg-primary/[0.06] p-4" aria-live="polite">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{heading}</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {SKILL_LABELS[next.skill] ?? next.skill}
          </p>
          <p className="break-words text-lg font-bold">{next.title}</p>
          {next.status === "upcoming" && plan.days.every((d) => d.status !== "missed") && (
            <p className="text-xs text-muted-foreground">
              Free today. You can start early if you want.
            </p>
          )}
        </div>
        <DayLink
          day={next}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Start <ArrowRight className="size-4" aria-hidden="true" />
        </DayLink>
      </div>
    </section>
  );
}

function PlanDayRow({ day, isNext }: { day: StudyPlanDay; isNext: boolean }) {
  const done = day.status === "done";
  return (
    <li
      className={`card-soft flex items-center gap-3 p-2.5 sm:p-3 ${
        isNext ? "border-primary/50" : ""
      } ${done ? "opacity-80" : ""}`}
    >
      <div className="w-12 shrink-0 text-center">
        <p className="text-[11px] uppercase text-muted-foreground">
          {shortDate(day.date).split(" ")[0]}
        </p>
        <p className="text-lg font-bold leading-none">{shortDate(day.date).split(" ")[1]}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          {SKILL_LABELS[day.skill] ?? day.skill}
          <span
            className={`rounded-full px-1.5 py-px text-[10px] font-semibold normal-case tracking-normal ${
              done
                ? "bg-primary/15 text-primary"
                : day.status === "today"
                  ? "bg-primary text-primary-foreground"
                  : day.status === "missed"
                    ? "bg-amber-400/15 text-amber-400"
                    : "bg-muted text-muted-foreground"
            }`}
          >
            {done && <Check className="mr-0.5 inline size-3" aria-hidden="true" />}
            {STATUS_TEXT[day.status]}
          </span>
        </p>
        <p className="break-words text-sm font-medium sm:text-base">{day.title}</p>
      </div>
      <DayLink
        day={day}
        className={`inline-flex h-8 shrink-0 items-center rounded-lg border px-3 text-xs font-medium transition-colors sm:text-sm ${
          done
            ? "border-border text-muted-foreground hover:bg-accent"
            : "border-primary/50 hover:bg-primary/10"
        }`}
      >
        {done ? "Review" : day.status === "missed" ? "Catch up" : "Start"}
      </DayLink>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-1 sm:p-2">
      <dt className="text-[10px] text-muted-foreground sm:text-xs">{label}</dt>
      <dd className="mt-0.5 text-sm font-bold sm:mt-1 sm:text-lg">{value}</dd>
    </div>
  );
}

function Choice({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-center sm:gap-2">
      <p className="text-[11px] font-medium sm:text-sm">{label}</p>
      <div className="flex flex-wrap gap-1 sm:gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={`h-6 rounded-md border px-2 text-[11px] transition-colors sm:h-9 sm:rounded-lg sm:px-3 sm:py-1 sm:text-sm xl:h-8 xl:py-0 ${
              value === option.value
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border hover:bg-secondary"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
