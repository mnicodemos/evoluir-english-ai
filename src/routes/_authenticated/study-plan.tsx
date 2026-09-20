import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, Check, Clock, Loader2, Target } from "lucide-react";
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
  STUDY_PLAN_DAYS_PER_WEEK,
  STUDY_PLAN_FOCUS_AREAS,
  STUDY_PLAN_GOALS,
  STUDY_PLAN_MINUTES,
  type StudyFocus,
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

  const { data, isLoading } = useQuery({
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

  return (
    <AppShell>
      <div className="space-y-5 lg:space-y-6">
        <header className="animate-rise">
          <p className="text-sm text-muted-foreground">My Study Plan</p>
          <h1 className="text-3xl font-bold">Your weekly study plan</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Choose your goal, your available time and your focus area. Your plan uses the lessons and
            practice already available for your level.
          </p>
        </header>

        <section className="card-soft space-y-5 p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Target className="size-5 text-primary" />
            Plan settings
          </h2>

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
            label="Weekly frequency"
            options={STUDY_PLAN_DAYS_PER_WEEK.map((d) => ({
              value: String(d),
              label: `${d} days`,
            }))}
            value={String(daysPerWeek)}
            onChange={(v) => setDaysPerWeek(Number(v))}
          />
          <Choice
            label="Focus area"
            options={STUDY_PLAN_FOCUS_AREAS.map((f) => ({ value: f.value, label: f.label }))}
            value={focus}
            onChange={(v) => setFocus(v as StudyFocus)}
          />

          <Button
            className="min-h-11 w-full sm:w-auto"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            Save my plan
          </Button>
        </section>

        {isLoading || !plan ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : (
          <>
            <section className="card-soft p-5">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Clock className="size-5 text-primary" />
                Weekly progress
              </h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                <Stat
                  label="Completed activities"
                  value={`${plan.completedCount} / ${plan.totalCount}`}
                />
                <Stat label="Weekly progress" value={`${plan.progressPercent}%`} />
                <Stat
                  label="Minutes studied"
                  value={`${plan.minutesThisWeek} / ${plan.weeklyMinutesTarget}`}
                />
              </dl>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${plan.progressPercent}%` }}
                />
              </div>
              {levelLabel && (
                <p className="mt-3 text-sm text-muted-foreground">Your level: {levelLabel}</p>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <CalendarCheck className="size-5 text-primary" />
                Week 1
              </h2>
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {plan.days.map((day) => (
                  <li key={day.day} className="card-soft p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{day.day}</p>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {SKILL_LABELS[day.skill] ?? day.skill}
                        </p>
                      </div>
                      {day.completed && (
                        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                          <Check className="size-4" />
                          Completed
                        </span>
                      )}
                    </div>
                    <p className="mt-3 font-medium break-words">{day.title}</p>
                    {day.lessonId ? (
                      <Link
                        to="/learning/$lessonId"
                        params={{ lessonId: day.lessonId }}
                        className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                      >
                        Start activity
                      </Link>
                    ) : (
                      <Link
                        to={day.to as "/listening"}
                        className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                      >
                        Start activity
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                The plan reuses your existing lessons and practice areas. When no lesson of that
                skill is available for your level, we point you to the matching practice area.
              </p>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-bold">{value}</dd>
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
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={`min-h-11 rounded-lg border px-3 py-2 text-sm transition-colors ${
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
