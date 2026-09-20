import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { useUiLang } from "@/lib/uiLang";
import { uiPt } from "@/lib/uiDictionary";

type Props = {
  userId: string;
  level: string;
};

type ProgressRow = {
  id: string;
  user_id: string;
  speaking_score: number;
  reading_score: number;
  listening_score: number;
  writing_score: number;
  recorded_at: string;
};

export function useProgressHistory(userId: string | undefined, level: string | undefined) {
  return useQuery({
    queryKey: ["progress-history", userId, level],
    enabled: !!userId && !!level,
    queryFn: async () => {
      const since = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("progress")
        .select("*")
        .eq("level", level!)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProgressRow[];
    },
  });
}

const SERIES_COLORS: Record<string, string> = {
  Listening: "var(--color-chart-1)",
  Reading: "var(--color-chart-2)",
  Talking: "var(--color-chart-3)",
  Writing: "var(--color-chart-4)",
  Grammar: "var(--color-chart-5)",
  Vocabulary: "var(--color-primary)",
};

export function useSkillHistory(userId: string | undefined) {
  return useQuery({
    queryKey: ["skill-history", userId],
    enabled: !!userId,
    queryFn: async () => {
      const since = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("assessment_skill_results")
        .select("skill, score, assessed_at")
        .gte("assessed_at", since)
        .order("assessed_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SkillResultRow[];
    },
  });
}

export function EvolutionChart({ userId }: Props) {
  const { lang } = useUiLang();
  const t = (s: string) => (lang === "pt" ? ((uiPt as Record<string, string>)[s] ?? s) : s);
  const { data: history } = useSkillHistory(userId);

  const days: { label: string; date: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      label: d.toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US", {
        day: "2-digit",
        month: "short",
      }),
      date: d.toISOString().slice(0, 10),
    });
  }

  const { data: chartData, series } = buildSkillHistory(history ?? [], days);

  const allScores = chartData
    .flatMap((d) => series.map((s) => d[s]))
    .filter((v): v is number => typeof v === "number");
  const rawMin = allScores.length ? Math.min(...allScores) : 0;
  const rawMax = allScores.length ? Math.max(...allScores) : 100;
  const yMin = allScores.length ? Math.max(0, Math.floor(rawMin / 10) * 10) : 0;
  const yMax = allScores.length ? Math.min(100, Math.ceil(rawMax / 10) * 10) : 100;

  if (!series.length) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        {t("No assessed history yet. Complete an activity to start your evolution chart.")}
      </p>
    );
  }

  return (
    <>
      <p className="mt-1 text-sm text-muted-foreground">
        <span>{t("Last 7 days:")}</span> <span>{t("day 1 is")}</span>{" "}
        <span>{chartData[0]?.name}</span> <span>{t("and day 7 is today")}</span>{" "}
        <span>({chartData[6]?.name})</span>.{" "}
        <span>{t("Each line shows your score in %.")}</span>
      </p>
      <div className="mt-5 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ left: -20, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="name"
              interval={0}
              angle={-30}
              textAnchor="end"
              height={44}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 12 }}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              formatter={(value: number, name: string) => [`${value}%`, t(name)]}
              labelClassName="text-foreground"
              contentStyle={{
                backgroundColor: "var(--color-card)",
                borderColor: "var(--color-border)",
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px" }}
              iconSize={10}
              formatter={(value: string) => t(value)}
            />
            {series.map((s) => (
              <Line
                key={s}
                type="monotone"
                dataKey={s}
                name={t(s)}
                stroke={SERIES_COLORS[s]}
                strokeWidth={2}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

