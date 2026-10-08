import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  BarChart3,
  ChevronRight,
  Download,
  GraduationCap,
  Headphones,
  Infinity as InfinityIcon,
  Loader2,
  Mic,
  PenLine,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLearningPath } from "@/hooks/useCurriculum";
import { useUserLessons } from "@/hooks/useLearning";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { loadNextStep } from "@/lib/pedagogy/nextStep.functions";
import { skillMeterRows, type SkillMeterStatus } from "@/lib/pedagogy/skillMeter";
import { findLevel } from "@/lib/level";
import { useUiLang } from "@/lib/uiLang";
import { uiPt } from "@/lib/uiDictionary";

/** Dashboard card: course progress + skill scores. */
export function PathProgressCard({
  embedded = false,
  compact = false,
}: {
  embedded?: boolean;
  compact?: boolean;
}) {
  const { lang } = useUiLang();
  const t = (text: string) => (lang === "pt" ? (uiPt[text] ?? text) : text);
  const path = useLearningPath();
  const { data: profile } = useProfile();
  const { data: mine } = useUserLessons();
  const [downloading, setDownloading] = useState(false);

  // Only the lessons of the level the student is on now.
  const levelLessonIds = new Set(path.lessons.map((l) => l.lessonId).filter(Boolean) as string[]);
  const studied = (mine ?? []).filter(
    (l) => Boolean(l.completed_at) && levelLessonIds.has(l.lesson_id),
  );

  const { data: latest } = useQuery({
    queryKey: ["progress-latest", profile?.id, profile?.level],
    // The compact Dashboard card reads the evidence-based skills instead.
    enabled: !compact && !!profile,
    queryFn: async () => {
      const { data } = await supabase
        .from("progress")
        .select("*")
        .eq("user_id", profile!.id)
        .eq("level", profile!.level)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Dashboard card: the same per-skill evidence "Today's priority" is decided
  // from (shared cache with the EVO card), never the old best-ever scores.
  const { data: nextStep, isLoading: skillsLoading } = useQuery({
    queryKey: ["next-step", profile?.level ?? null],
    queryFn: () => loadNextStep({ data: undefined }),
    staleTime: 60 * 1000,
    enabled: compact && !!profile,
  });
  // Learning is continuous (user decision): the card keeps each skill's latest
  // score across levels; one level's own numbers are looked up in My Progress.
  const meterRows = skillMeterRows(nextStep?.skills, nextStep?.prioritySkill);
  const anyMeasured = meterRows.some((row) => row.value !== null);

  const skills = [
    {
      label: "Reading",
      value: latest?.reading_score ?? 0,
      icon: BookOpen,
    },
    {
      label: "Listening",
      value: latest?.listening_score ?? 0,
      icon: Headphones,
    },
    {
      label: "Writing",
      value: latest?.writing_score ?? 0,
      icon: PenLine,
    },
    {
      label: "Speaking",
      value: latest?.speaking_score ?? 0,
      icon: Mic,
    },
  ];

  const download = async () => {
    if (!profile) return;
    setDownloading(true);
    try {
      const { downloadDailyReport } = await import("@/lib/dailyReport");
      const saved = await downloadDailyReport(profile.id, {
        name: profile.name,
        level: profile.level,
        lessonIds: studied.map((l) => l.lesson_id),
      });
      if (saved) toast.success(t("Your study content is downloading."));
      else
        toast.info(
          t(
            "Downloads are blocked inside the editor preview. Open the app in its own browser tab and tap the button again.",
          ),
        );
    } catch {
      toast.error(t("Could not build your summary. Please try again."));
    } finally {
      setDownloading(false);
    }
  };

  const content = (
    <>
      <h2 id="path-progress-heading" className="text-xl font-semibold">
        Your progress
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        <span>Your English level</span>
        <span> · </span>
        <span className="uppercase">{path.level}</span>
        <span> · </span>
        <span>Lesson</span> <span>{path.completed}</span> <span>of</span> <span>{path.total}</span>{" "}
        <span>completed</span>
      </p>
      {path.next ? (
        <p className="mt-3 text-sm">
          <span>Next lesson:</span> {path.next.title}
        </p>
      ) : (
        <p className="mt-3 text-sm">
          <span>You finished every lesson. Take the Final Test to move up a level.</span>
        </p>
      )}
      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Completed</span>
          <span className="text-muted-foreground">
            {Math.round((path.completed / path.total) * 100)}%
          </span>
        </div>
        <Progress value={Math.round((path.completed / path.total) * 100)} className="mt-2 h-2" />
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {skills.map((s) => (
          <div key={s.label}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{s.label}</span>
              <span className="text-muted-foreground">{s.value}%</span>
            </div>
            <Progress value={s.value} className="mt-2 h-2" />
          </div>
        ))}
      </div>

      {!latest && (
        <p className="mt-5 text-sm text-muted-foreground">
          Finish your first conversation or writing task to unlock your scores.
        </p>
      )}

      {studied.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="mt-5"
          onClick={() => void download()}
          disabled={downloading}
        >
          {downloading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Download your progress
        </Button>
      )}
    </>
  );

  if (compact) {
    return (
      <section
        className="card-soft flex h-full min-w-0 flex-col p-3 max-lg:py-2.5 xl:p-4"
        aria-labelledby="skills-progress-heading"
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <BarChart3
            className="size-[1.65rem] text-dashboard-cyan"
            strokeWidth={2.6}
            aria-hidden="true"
          />
          <h2 id="skills-progress-heading" className="font-display text-sm font-semibold">
            {t("Your English Skills")}
          </h2>
          {/* Desktop: a reminder that the scores carry on across levels, in the
              header so the card keeps its height. My Progress says it in full. */}
          <span
            title={t("Continuous learning: your scores carry on into every new level.")}
            className="hidden items-center gap-1 text-[11px] font-semibold leading-none text-brand-green lg:inline-flex"
          >
            <InfinityIcon className="size-3.5 shrink-0" aria-hidden="true" />
            {t("Continuous learning")}
          </span>
          {/* Phones hide the header's level card, so the level the scores
              belong to sits here; it opens the learning path. */}
          {profile?.level && (
            <Link
              to="/learning"
              aria-label={`${t("Level")} ${t(findLevel(profile.level).label)}`}
              className="inline-flex items-center gap-1 rounded-md text-[11px] font-semibold leading-none text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60 lg:hidden"
            >
              {/* Same look as Today's Progress "My progress" link beside it. */}
              <GraduationCap className="size-3.5 shrink-0" aria-hidden="true" />
              {/* Just the code on the narrowest phones, so the title keeps one line. */}
              <span className="max-[380px]:hidden">{t("Level")}</span>
              {findLevel(profile.level).value.toUpperCase()}
              <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
            </Link>
          )}
        </div>
        <div className="mt-2 grid flex-1 content-between gap-2 lg:mt-3 lg:gap-3 xl:mt-4 xl:gap-2">
          {meterRows.map((row) => {
            const meta = SKILL_META[row.skill as keyof typeof SKILL_META];
            const tone = STATUS_TONE[row.status];
            const Icon = meta.icon;
            const basis =
              row.evidenceCount > 0
                ? lang === "pt"
                  ? `Com base em ${row.evidenceCount} ${row.evidenceCount === 1 ? "evidência" : "evidências"}`
                  : `Based on ${row.evidenceCount} ${row.evidenceCount === 1 ? "piece" : "pieces"} of evidence`
                : t("Practise this skill to measure it.");
            return (
              <div
                key={row.skill}
                title={basis}
                className="grid min-w-0 grid-cols-[1.5rem_4.25rem_minmax(0,1fr)_2.25rem_4.75rem] items-center gap-2 text-xs sm:grid-cols-[1.75rem_5rem_minmax(0,1fr)_2.5rem_5.25rem] sm:gap-2.5"
              >
                <Icon
                  className="size-[1.65rem] text-foreground/70"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                <span className="truncate font-medium">{t(meta.label)}</span>
                {row.value === null && !skillsLoading ? (
                  // Never measured: say so plainly instead of an empty bar and a dash.
                  <span className="col-span-2 truncate text-[11px] text-muted-foreground">
                    {t("Not measured yet")}
                  </span>
                ) : (
                  <>
                    {row.value === null ? (
                      <span
                        className="h-2.5 rounded-full border border-dashed border-border"
                        aria-hidden="true"
                      />
                    ) : (
                      <Progress
                        value={row.value}
                        aria-label={t(meta.label)}
                        className={`h-2.5 bg-secondary/80 ${tone.bar}`}
                      />
                    )}
                    <span className="text-right font-semibold text-foreground">
                      {skillsLoading ? "…" : `${row.value}%`}
                    </span>
                  </>
                )}
                <span
                  className={`truncate rounded-full px-1.5 py-1 text-center text-[10px] font-semibold ${tone.badge}`}
                >
                  {t(STATUS_LABEL[row.status])}
                </span>
              </div>
            );
          })}
        </div>
        {!skillsLoading && !anyMeasured && (
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
            {t("Finish your first conversation or writing task to unlock your scores.")}
          </p>
        )}
      </section>
    );
  }

  if (embedded) {
    return (
      <section className="min-w-0" aria-labelledby="path-progress-heading">
        {content}
      </section>
    );
  }

  return (
    <section
      className="card-soft bg-card p-6 text-card-foreground"
      aria-labelledby="path-progress-heading"
    >
      {content}
    </section>
  );
}

const SKILL_META = {
  listening: { label: "Listening", icon: Headphones },
  speaking: { label: "Speaking", icon: Mic },
  writing: { label: "Writing", icon: PenLine },
  grammar: { label: "Grammar", icon: GraduationCap },
} as const;

const STATUS_LABEL: Record<SkillMeterStatus, string> = {
  priority: "Priority",
  strong: "Strong",
  on_track: "Good",
  needs_work: "Needs work",
  not_measured: "No data",
};

const STATUS_TONE: Record<SkillMeterStatus, { bar: string; badge: string }> = {
  // One hue per status, and only on the bar and badge: the priority skill is
  // the single solid warm badge, so it stands apart from "Needs work".
  priority: {
    bar: "[&>div]:bg-dashboard-coral",
    badge: "bg-dashboard-coral text-[oklch(0.2_0.05_40)]",
  },
  strong: { bar: "[&>div]:bg-success", badge: "bg-success/15 text-success" },
  on_track: {
    bar: "[&>div]:bg-dashboard-blue",
    badge: "bg-dashboard-blue/15 text-dashboard-blue",
  },
  needs_work: {
    bar: "[&>div]:bg-warning",
    badge: "bg-warning/15 text-warning",
  },
  not_measured: {
    bar: "",
    badge: "bg-secondary text-muted-foreground",
  },
};
