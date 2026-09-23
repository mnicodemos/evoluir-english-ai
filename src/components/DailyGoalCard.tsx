import { useQuery } from "@tanstack/react-query";
import { Hourglass } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { countsAsLearningMinutes, LEARNING_ACTIVITY_TYPES } from "@/lib/studyDay";

export function useMinutesToday(userId?: string) {
  return useQuery({
    queryKey: ["minutes-today", userId],
    enabled: !!userId,
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("activities")
        .select("duration_minutes, activity_type")
        .eq("user_id", userId!)
        .in("activity_type", [...LEARNING_ACTIVITY_TYPES])
        .gte("created_at", start.toISOString());
      if (error) throw error;
      return (data ?? []).reduce(
        (sum, a) =>
          sum + (countsAsLearningMinutes(a.activity_type) ? (a.duration_minutes ?? 0) : 0),
        0,
      );
    },
  });
}

export function DailyGoalCard({ userId, goalMinutes }: { userId: string; goalMinutes: number }) {
  const { data: done = 0 } = useMinutesToday(userId);
  const percent = goalMinutes > 0 ? Math.min(100, Math.round((done / goalMinutes) * 100)) : 0;

  return (
    <div className="card-soft flex min-w-0 flex-col justify-center p-5">
      <div className="flex items-center gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[oklch(0.95_0.06_25)]">
          <Hourglass className="size-6 text-[oklch(0.55_0.18_25)]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold sm:text-base md:text-lg">
            {done}{" "}
            <span className="text-xs font-medium text-muted-foreground sm:text-sm md:text-base">
              / {goalMinutes} <span className="inline">minutes</span>
            </span>
          </p>
          <p className="text-base text-muted-foreground sm:text-sm">Your daily goal</p>
        </div>
      </div>
      <Progress value={percent} className="mt-4 h-2" />
      <p
        className={`mt-2 text-xs ${done >= goalMinutes ? "text-success/80" : "text-muted-foreground"}`}
      >
        {done >= goalMinutes ? (
          "Goal reached today. Great work!"
        ) : (
          <>
            <span>{goalMinutes - done}</span> <span>minutes left today</span>{" "}
            <span>({percent}%)</span>
          </>
        )}
      </p>
    </div>
  );
}
