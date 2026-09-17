import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, TriangleAlert } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { EvolutionChart, useProgressHistory } from "@/components/EvolutionChart";
import { FrequencyCalendar } from "@/components/FrequencyCalendar";
import { MinutesByDayChart } from "@/components/MinutesByDayChart";
import { Progress as Bar } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/useProfile";
import { useUiLang } from "@/lib/uiLang";
import { uiPt } from "@/lib/uiDictionary";
import { useVocabularyProgress } from "@/hooks/useVocabularyProgress";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · My history" },
      { name: "description", content: "Track your speaking, grammar, listening and vocabulary evolution." },
      { property: "og:title", content: "Evoluir+ English AI · My history" },
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
  const t = (s: string) => (lang === "pt" ? (uiPt as Record<string, string>)[s] ?? s : s);
  const { data: vocabProgress } = useVocabularyProgress();

  const { data: history, isLoading } = useProgressHistory(profile?.id, profile?.level);

  const { data: learning } = useQuery({
    queryKey: ["learning-profile", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data } = await supabase.from("learning_profile").select("*").maybeSingle();
      return data;
    },
  });

  const latest = history?.[history.length - 1];
  const skills = [
    { label: "Listening", value: latest?.listening_score ?? 0 },
    { label: "Reading", value: latest?.reading_score ?? 0 },
    { label: "Talking", value: latest?.speaking_score ?? 0 },
    { label: "Writing", value: latest?.writing_score ?? 0 },
  ];
  const overall = Math.round(skills.reduce((sum, s) => sum + s.value, 0) / skills.length);
  const sorted = [...skills].sort((a, b) => b.value - a.value);
  const strengths = sorted.slice(0, 2).filter((s) => s.value > 0);
  const gaps = sorted.slice(-2).filter((s) => s.value > 0);

  return (
    <AppShell>
      <h1 className="text-3xl font-bold">{t("My history")}</h1>

      {isLoading ? (
        <Skeleton className="mt-7 h-72 w-full" />
      ) : (
        <>
          <section className="card-soft mt-7 p-6">
            <h2 className="text-lg font-semibold">{t("Frequency")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("The days you studied this month.")}</p>
            <div className="mt-5">{profile && <FrequencyCalendar userId={profile.id} />}</div>
          </section>

          <section className="card-soft mt-6 p-6">
            <h2 className="text-lg font-semibold">{t("Evolution")}</h2>
            {profile && <EvolutionChart userId={profile.id} level={profile.level} />}
            {profile && <MinutesByDayChart userId={profile.id} level={profile.level} />}
          </section>

          <section className="card-soft mt-6 p-6">
            <h2 className="text-lg font-semibold">{t("Current level")}</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {skills.map((s) => (
                <div key={s.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{t(s.label)}</span>
                    <span className="text-muted-foreground">{s.value}%</span>
                  </div>
                  <Bar value={s.value} className="mt-2 h-2" />
                </div>
              ))}
            </div>
          </section>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <section className="card-soft p-6">
              <h2 className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="size-4 text-[oklch(0.6_0.14_158)]" /> {t("Strengths")}
              </h2>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {strengths.length ? (
                  strengths.map((s) => <li key={s.label}>{t(s.label)} — {s.value}%</li>)
                ) : (
                  <li>{t("Practice more to reveal your strengths.")}</li>
                )}
              </ul>
            </section>
            <section className="card-soft p-6">
              <h2 className="flex items-center gap-2 font-semibold">
                <TriangleAlert className="size-4 text-[oklch(0.7_0.15_75)]" /> {t("To improve")}
              </h2>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {gaps.length ? (
                  gaps.map((s) => <li key={s.label}>{t(s.label)} — {s.value}%</li>)
                ) : (
                  <li>{t("Keep going to find your weak spots.")}</li>
                )}
              </ul>
            </section>
          </div>
        </>
      )}

      {learning?.common_errors && learning.common_errors.length > 0 && (
        <section className="card-soft mt-6 p-6">
          <h2 className="text-lg font-semibold">{t("Frequent mistakes")}</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {learning.common_errors.map((e: string, i: number) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  );
}
