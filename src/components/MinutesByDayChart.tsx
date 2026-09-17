import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { useUiLang } from "@/lib/uiLang";

type Props = {
  userId: string;
  level: string;
};

export function MinutesByDayChart({ userId, level }: Props) {
  const { lang } = useUiLang();
  const { data: minutesByDay } = useQuery({
    queryKey: ["minutes-by-day", userId, level, lang],
    enabled: !!userId && !!level,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("activities")
        .select("activity_type, duration_minutes, created_at")
        .eq("level", level)
        .gte("created_at", since);
      const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
      const labelFmt = new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "short",
      });
      const bucketOf = (type: string) =>
        type === "listening"
          ? "Listening"
          : type === "vocabulary"
            ? "Reading"
            : type === "conversation"
              ? "Talking"
              : type === "writing"
                ? "Writing"
                : null;
      type Buckets = { Listening: number; Reading: number; Talking: number; Writing: number };
      const empty = (): Buckets => ({ Listening: 0, Reading: 0, Talking: 0, Writing: 0 });
      const totals = new Map<string, Buckets>();
      for (const row of data ?? []) {
        const bucket = bucketOf(row.activity_type) as keyof Buckets | null;
        if (!bucket) continue;
        const key = dayFmt.format(new Date(row.created_at));
        const entry = totals.get(key) ?? empty();
        entry[bucket] += row.duration_minutes ?? 0;
        totals.set(key, entry);
      }
      const days: ({ date: string; name: string } & Buckets)[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const key = dayFmt.format(d);
        days.push({ date: key, name: labelFmt.format(d), ...(totals.get(key) ?? empty()) });
      }
      return days;
    },
  });

  const hasMinutes = (minutesByDay ?? []).some(
    (d) => d.Listening + d.Reading + d.Talking + d.Writing > 0,
  );

  if (!hasMinutes) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium">Minutes per day</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Each bar is your practice time that day, split by activity.
      </p>
      <div className="mt-3 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={minutesByDay ?? []} margin={{ left: -24, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={44} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} tickFormatter={(v: number) => `${v}m`} />
            <Tooltip
              formatter={(value: number, name: string) => [`${value} min`, name]}
              contentStyle={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}
              labelClassName="text-foreground"
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} iconSize={10} />
            <Bar dataKey="Listening" stackId="min" fill="var(--color-chart-1)" />
            <Bar dataKey="Reading" stackId="min" fill="var(--color-chart-2)" />
            <Bar dataKey="Talking" stackId="min" fill="var(--color-chart-3)" />
            <Bar dataKey="Writing" stackId="min" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
