import { useQuery } from "@tanstack/react-query";
import { Hourglass } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { countsAsLearningMinutes, LEARNING_ACTIVITY_TYPES } from "@/lib/studyDay";
import { cn } from "@/lib/utils";

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

export function DailyGoalCard({
  userId,
  goalMinutes,
  compact = false,
}: {
  userId: string;
  goalMinutes: number;
  compact?: boolean;
}) {
  const { data: done = 0 } = useMinutesToday(userId);
  const percent = goalMinutes > 0 ? Math.min(100, Math.round((done / goalMinutes) * 100)) : 0;

  return (
    <div className={cn("card-soft flex min-w-0 flex-col justify-center", compact ? "p-3" : "p-5")}>
      <div className="flex items-center gap-4">
        <span className={cn("grid shrink-0 place-items-center rounded-xl bg-warning/15", compact ? "size-9" : "size-12")}>
          <Hourglass className={cn("text-warning", compact ? "size-4" : "size-6")} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-bold", compact ? "text-base" : "text-lg sm:text-base md:text-lg")}>
            {done}{" "}
            <span className="text-xs font-medium text-muted-foreground sm:text-sm md:text-base">
              / {goalMinutes} <span className="inline">minutes</span>
            </span>
          </p>
          <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-base sm:text-sm")}>Your daily goal</p>
        </div>
      </div>
      <Progress value={percent} className={cn("h-2", compact ? "mt-2" : "mt-4")} />
      <p
        className={cn("mt-2 text-xs", compact && "hidden 2xl:block", done >= goalMinutes ? "text-success/80" : "text-muted-foreground")}
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
