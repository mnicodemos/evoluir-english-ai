import { useQuery } from "@tanstack/react-query";
import { BookOpen, BarChart3, Download, Headphones, Loader2, Mic, PenLine } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLearningPath } from "@/hooks/useCurriculum";
import { useUserLessons } from "@/hooks/useLearning";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
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
    enabled: !!profile,
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
        </div>
        <div className="mt-2 grid flex-1 content-between gap-2 lg:mt-3 lg:gap-3 xl:mt-4 xl:gap-2">
          {skills.map((skill) => {
            const statusTone =
              skill.value >= 95
                ? {
                    text: "text-success",
                    bar: "[&>div]:bg-success",
                    badge: "bg-success/15 text-success",
                  }
                : skill.value >= 80
                  ? {
                      text: "text-dashboard-blue",
                      bar: "[&>div]:bg-dashboard-blue",
                      badge: "bg-dashboard-blue/15 text-dashboard-blue",
                    }
                  : {
                      text: "text-warning",
                      bar: "[&>div]:bg-warning",
                      badge: "bg-warning/15 text-warning",
                    };
            return (
              <div
                key={skill.label}
                className="grid min-w-0 grid-cols-[1.5rem_4.25rem_minmax(0,1fr)_2.25rem_4rem] items-center gap-2 text-xs sm:grid-cols-[1.75rem_5rem_minmax(0,1fr)_2.5rem_4.5rem] sm:gap-2.5"
              >
                <skill.icon
                  className={`size-[1.65rem] ${statusTone.text}`}
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                <span className="truncate font-medium">{t(skill.label)}</span>
                <Progress
                  value={skill.value}
                  className={`h-2.5 bg-secondary/80 ${statusTone.bar}`}
                />
                <span className="text-right font-semibold text-foreground">{skill.value}%</span>
                <span
                  className={`rounded-full px-2 py-1 text-center text-[10px] font-semibold ${statusTone.badge}`}
                >
                  {skill.value >= 95
                    ? t("Advanced")
                    : skill.value >= 80
                      ? t("Strong")
                      : t("Priority")}
                </span>
              </div>
            );
          })}
        </div>
        {!latest && (
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
