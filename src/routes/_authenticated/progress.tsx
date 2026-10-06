import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, TriangleAlert } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { EvolutionChart, useSkillHistory } from "@/components/EvolutionChart";
import { FrequencyCalendar } from "@/components/FrequencyCalendar";
import { MinutesByDayChart } from "@/components/MinutesByDayChart";
import { LearningJourneyCard } from "@/components/LearningJourneyCard";

import { Progress as Bar } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useProfile } from "@/hooks/useProfile";
import { useUiLang } from "@/lib/uiLang";
import { uiPt } from "@/lib/uiDictionary";
import { useVocabularyProgress } from "@/hooks/useVocabularyProgress";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/formatDate";
import { loadNextStep } from "@/lib/pedagogy/nextStep.functions";
import { PROGRESS_SKILLS, SKILL_STRONG_AT, skillMeterRows } from "@/lib/pedagogy/skillMeter";

interface RecentActivity {
  id: string;
  title: string | null;
  activity_type: string;
  created_at: string;
  duration_minutes: number;
  score: number | null;
}

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · My Progress" },
      {
        name: "description",
        content: "Track your speaking, grammar, listening and vocabulary evolution.",
      },
      { property: "og:title", content: "Evoluir+ English AI · My Progress" },
      { property: "og:description", content: "Track your English evolution week by week." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProgressPage,
});

function ProgressPage() {
  const { data: profile } = useProfile();
  const { lang } = useUiLang();
  const t = (s: string) => (lang === "pt" ? ((uiPt as Record<string, string>)[s] ?? s) : s);
  // Inline pt/en for the few new strings, so the shared dictionary stays untouched.
  const L = (en: string, pt: string) => (lang === "pt" ? pt : en);
  const [showAllMistakes, setShowAllMistakes] = useState(false);
  const [tab, setTab] = usePersistentState<string>("progress-tab", "overview");
  const { data: vocabProgress } = useVocabularyProgress();

  // Same evidence-based skills as the Dashboard card (shared next-step cache),
  // never the old best-ever scores; the chart below reads the assessed history.
  const { data: nextStep, isLoading } = useQuery({
    queryKey: ["next-step", profile?.level ?? null],
    queryFn: () => loadNextStep({ data: undefined }),
    staleTime: 60 * 1000,
    enabled: !!profile,
  });
  const { data: history } = useSkillHistory(profile?.id);
  const [chosenChart, setChartView] = useState<"scores" | "minutes" | null>(null);
  // Scores first when there is assessed history; otherwise the minutes chart.
  const chartView = chosenChart ?? (history && history.length > 0 ? "scores" : "minutes");

  const { data: learning } = useQuery({
    queryKey: ["learning-profile", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data } = await supabase
        .from("learning_profile")
        .select("*")
        .eq("user_id", profile!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["activities-recent", profile?.id, profile?.level],
    enabled: !!profile,
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select("id, title, activity_type, created_at, duration_minutes, score")
        .eq("user_id", profile!.id)
        .eq("level", profile!.level)
        .order("created_at", { ascending: false })
        .limit(5);
      return (data ?? []) as RecentActivity[];
    },
  });

  const skills = skillMeterRows(nextStep?.skills, null, PROGRESS_SKILLS).map((row) => ({
    label: row.skill.charAt(0).toUpperCase() + row.skill.slice(1),
    value: row.value,
  }));
  const measured = skills.filter((s): s is { label: string; value: number } => s.value !== null);
  const strengths = [...measured]
    .filter((s) => s.value >= SKILL_STRONG_AT)
    .sort((a, b) => b.value - a.value)
    .slice(0, 2);
  const gaps = [...measured]
    .filter((s) => s.value < SKILL_STRONG_AT)
    .sort((a, b) => a.value - b.value)
    .slice(0, 2);

  return (
    <AppShell mobileOneScreen>
      <h1 className="text-xl font-bold lg:text-3xl">{t("My Progress")}</h1>

      {/* Three tabs keep each view on one screen: the overview first, the EVO
          journey and the history one tap away. The chosen tab is remembered. */}
      <Tabs value={tab} onValueChange={setTab} className="mt-3 sm:mt-4">
        <TabsList>
          <TabsTrigger value="overview">{L("Overview", "Visão geral")}</TabsTrigger>
          <TabsTrigger value="journey">{L("Journey", "Jornada")}</TabsTrigger>
          <TabsTrigger value="history">{L("History", "Histórico")}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          {isLoading ? (
            <Skeleton className="mt-4 h-72 w-full sm:mt-7" />
          ) : (
            <>
              <div className="mt-3 grid gap-3 sm:mt-6 sm:gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] xl:grid-rows-[auto_auto]">
                <section className="card-soft p-3 sm:p-5 xl:col-start-1 xl:row-span-2 xl:row-start-1">
                  <h2 className="text-base font-semibold sm:text-lg">{t("Frequency")}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground sm:mt-1 sm:text-sm">
                    {t("The days you studied this month.")}
                  </p>
                  <div className="mt-2 sm:mt-4">
                    {profile && <FrequencyCalendar userId={profile.id} />}
                  </div>
                </section>

                <section className="card-soft p-3 sm:p-5 xl:col-start-2 xl:row-start-1">
                  <h2 className="text-base font-semibold sm:text-lg">{t("Current level")}</h2>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-4">
                    {skills.map((s) => (
                      <div key={s.label}>
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="font-medium">
                            {s.label === "Speaking" ? L("Speaking", "Fala") : t(s.label)}
                          </span>
                          <span className="text-muted-foreground">
                            {s.value === null ? t("No data") : `${s.value}%`}
                          </span>
                        </div>
                        {s.value === null ? (
                          <div
                            className="mt-1.5 h-2 rounded-full border border-dashed border-border sm:mt-2"
                            aria-hidden="true"
                          />
                        ) : (
                          <Bar value={s.value} className="mt-1.5 h-2 sm:mt-2" />
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:col-start-2 xl:row-start-2">
                  <section className="card-soft flex flex-col justify-center p-3 sm:min-h-32 sm:p-6">
                    <h2 className="flex items-center gap-2 text-sm font-semibold sm:text-base">
                      <CheckCircle2 className="size-4 text-[oklch(0.6_0.14_158)]" />{" "}
                      {t("Strengths")}
                    </h2>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground sm:mt-3 sm:text-sm">
                      {strengths.length ? (
                        strengths.map((s) => (
                          <li key={s.label}>
                            {s.label === "Speaking" ? L("Speaking", "Fala") : t(s.label)} —{" "}
                            {s.value}%
                          </li>
                        ))
                      ) : (
                        <li>{t("Practice more to reveal your strengths.")}</li>
                      )}
                    </ul>
                  </section>
                  <section className="card-soft flex flex-col justify-center p-3 sm:min-h-32 sm:p-6">
                    <h2 className="flex items-center gap-2 text-sm font-semibold sm:text-base">
                      <TriangleAlert className="size-4 text-[oklch(0.7_0.15_75)]" />{" "}
                      {t("To improve")}
                    </h2>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground sm:mt-3 sm:text-sm">
                      {gaps.length ? (
                        gaps.map((s) => (
                          <li key={s.label}>
                            {s.label === "Speaking" ? L("Speaking", "Fala") : t(s.label)} —{" "}
                            {s.value}%
                          </li>
                        ))
                      ) : (
                        <li>{t("Keep going to find your weak spots.")}</li>
                      )}
                    </ul>
                  </section>
                </div>
              </div>
            </>
          )}
        </TabsContent>
        <TabsContent value="journey">
          <LearningJourneyCard />
        </TabsContent>
        <TabsContent value="history">
          <div className="mt-3 grid items-start gap-3 sm:mt-6 sm:gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <section className="card-soft p-3 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold sm:text-lg">{t("Evolution")}</h2>
                {/* Below xl one chart at a time keeps the tab on one screen. */}
                <div
                  className="flex rounded-lg bg-secondary p-0.5 text-xs xl:hidden"
                  role="group"
                  aria-label={L("Chart", "Gráfico")}
                >
                  {(
                    [
                      ["scores", L("Scores", "Notas")],
                      ["minutes", L("Minutes", "Minutos")],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={chartView === value}
                      onClick={() => setChartView(value)}
                      className={`min-h-8 rounded-md px-3 font-medium transition-colors ${
                        chartView === value
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 xl:grid-cols-2 xl:gap-8">
                <div className={`min-w-0 ${chartView === "scores" ? "" : "hidden xl:block"}`}>
                  {profile && <EvolutionChart userId={profile.id} level={profile.level} />}
                </div>
                <div className={`min-w-0 ${chartView === "minutes" ? "" : "hidden xl:block"}`}>
                  {profile && <MinutesByDayChart userId={profile.id} level={profile.level} />}
                </div>
              </div>
            </section>
            <div className="grid content-start gap-3 sm:gap-5">
              {learning?.common_errors && learning.common_errors.length > 0 && (
                <section className="card-soft p-3 sm:p-5">
                  <h2 className="text-base font-semibold sm:text-lg">{t("Frequent mistakes")}</h2>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground sm:mt-3 sm:text-sm">
                    {(showAllMistakes
                      ? learning.common_errors
                      : learning.common_errors.slice(0, 5)
                    ).map((e: string, i: number) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                  {learning.common_errors.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setShowAllMistakes((v) => !v)}
                      aria-expanded={showAllMistakes}
                      className="mt-2 min-h-11 text-xs font-medium text-brand-green hover:underline sm:text-sm"
                    >
                      {showAllMistakes
                        ? L("Show less", "Mostrar menos")
                        : L(
                            `Show all (${learning.common_errors.length})`,
                            `Mostrar todos (${learning.common_errors.length})`,
                          )}
                    </button>
                  )}
                </section>
              )}

              {recent && recent.length > 0 && (
                <section className="card-soft p-3 sm:p-5">
                  <h2 className="text-base font-semibold sm:text-lg">{t("Recent activity")}</h2>
                  <ul className="mt-2 divide-y divide-border sm:mt-4">
                    {recent.map((a, index) => (
                      <li
                        key={a.id}
                        className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 text-xs sm:py-3 sm:text-sm xl:py-2 ${
                          index >= 3 ? "max-sm:hidden" : ""
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block break-words font-medium">
                            {(a.title || a.activity_type || "").startsWith("Lesson: ") ? (
                              <>
                                <span>Lesson:</span> {(a.title as string).slice(8)}
                              </>
                            ) : (
                              (() => {
                                const label = a.title || a.activity_type || "";
                                return label.charAt(0).toUpperCase() + label.slice(1);
                              })()
                            )}
                          </span>
                          <span className="text-muted-foreground">
                            {formatDate(a.created_at, lang)} · {a.duration_minutes} min
                          </span>
                        </span>
                        {a.score == null && (
                          <span
                            className="shrink-0 text-muted-foreground"
                            aria-label={L("No score", "Sem nota")}
                          >
                            —
                          </span>
                        )}
                        {a.score != null && (
                          <span
                            className={`shrink-0 font-semibold ${
                              a.score >= 70
                                ? "text-[oklch(0.55_0.14_158)]"
                                : a.score >= 50
                                  ? "text-warning"
                                  : "text-destructive"
                            }`}
                          >
                            {a.score}%
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
