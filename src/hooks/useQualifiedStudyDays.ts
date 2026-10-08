import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { plusDayComplete } from "@/lib/plus";
import { STUDY_TIME_ZONE } from "@/lib/today";

const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: STUDY_TIME_ZONE });

function increment(counts: Map<string, number>, timestamp: string | null) {
  if (!timestamp) return;
  const key = dayFormatter.format(new Date(timestamp));
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

/**
 * Calendar days that satisfy the database's Study Streak rule. This hook only
 * reads the evidence; the database remains the sole authority that credits a streak.
 */
export function useQualifiedStudyDays({
  userId,
  start,
  end,
  queryKey,
}: {
  userId: string;
  start: Date;
  end: Date;
  queryKey: string;
}) {
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  return useQuery({
    queryKey: ["qualified-study-days", userId, queryKey],
    enabled: !!userId,
    queryFn: async () => {
      const [activities, lessons, vocabulary, plusSteps] = await Promise.all([
        supabase
          .from("activities")
          .select("activity_type, created_at")
          .eq("user_id", userId)
          .in("activity_type", ["writing", "listening"])
          .gte("created_at", startIso)
          .lt("created_at", endIso),
        supabase
          .from("user_lessons")
          .select("completed_at")
          .eq("user_id", userId)
          .not("completed_at", "is", null)
          .gte("completed_at", startIso)
          .lt("completed_at", endIso),
        supabase
          .from("user_vocabulary")
          .select("last_reviewed_at")
          .eq("user_id", userId)
          .not("last_reviewed_at", "is", null)
          .gte("last_reviewed_at", startIso)
          .lt("last_reviewed_at", endIso),
        // Evoluir+ Goals steps (migration 0051): a day with every step done counts.
        supabase
          .from("plus_goal_steps" as never)
          .select("day, done_at")
          .eq("user_id" as never, userId as never)
          .gte("day" as never, dayFormatter.format(start) as never)
          .lte("day" as never, dayFormatter.format(end) as never),
      ]);

      if (activities.error) throw activities.error;
      if (lessons.error) throw lessons.error;
      if (vocabulary.error) throw vocabulary.error;

      const writing = new Map<string, number>();
      const listening = new Map<string, number>();
      const words = new Map<string, number>();
      const completedLessons = new Set<string>();

      for (const row of activities.data ?? []) {
        increment(row.activity_type === "writing" ? writing : listening, row.created_at);
      }
      for (const row of vocabulary.data ?? []) increment(words, row.last_reviewed_at);
      // Before the Plus migration is applied the table is missing: no Plus days.
      const plusByDay = new Map<string, { doneAt: string | null }[]>();
      for (const row of (plusSteps.error ? [] : (plusSteps.data ?? [])) as {
        day: string;
        done_at: string | null;
      }[]) {
        plusByDay.set(row.day, [...(plusByDay.get(row.day) ?? []), { doneAt: row.done_at }]);
      }
      const plusDays = [...plusByDay.entries()]
        .filter(([, steps]) => plusDayComplete(steps))
        .map(([day]) => day);
      for (const row of lessons.data ?? []) {
        if (row.completed_at) completedLessons.add(dayFormatter.format(new Date(row.completed_at)));
      }

      const candidates = new Set([
        ...writing.keys(),
        ...listening.keys(),
        ...words.keys(),
        ...completedLessons,
        ...plusDays,
      ]);
      return new Set(
        [...candidates].filter(
          (day) =>
            (writing.get(day) ?? 0) >= 3 ||
            (listening.get(day) ?? 0) >= 3 ||
            (words.get(day) ?? 0) >= 10 ||
            completedLessons.has(day) ||
            plusDays.includes(day),
        ),
      );
    },
  });
}
