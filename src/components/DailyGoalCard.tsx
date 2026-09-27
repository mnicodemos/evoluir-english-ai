import { useQuery } from "@tanstack/react-query";
import { Check, CircleDotDashed, Hourglass } from "lucide-react";

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
  mobileSummary = false,
}: {
  userId: string;
  goalMinutes: number;
  compact?: boolean;
  mobileSummary?: boolean;
}) {
  const { data: done = 0 } = useMinutesToday(userId);
  const percent = goalMinutes > 0 ? Math.min(100, Math.round((done / goalMinutes) * 100)) : 0;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col justify-center sm:h-full",
        compact ? "px-3 py-2" : "card-soft p-5",
        mobileSummary && "items-center px-1.5 py-2 sm:items-stretch sm:px-3",
      )}
    >
      <div className={cn("flex items-center gap-3", mobileSummary && "flex-col gap-1 text-center sm:flex-row sm:gap-3 sm:text-left")}>
        {compact ? (
          <CircleDotDashed className={cn("size-[1.925rem] shrink-0 text-brand-green", mobileSummary && "size-6 sm:size-[1.925rem]")} strokeWidth={3.2} />
        ) : (
          <span className="grid size-12 shrink-0 place-items-center rounded-md bg-success/10">
            <Hourglass className="size-6 text-warning" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate font-bold",
              compact ? "font-display text-base" : "text-lg sm:text-base md:text-lg",
              mobileSummary && "whitespace-normal text-[13px] leading-tight sm:truncate sm:text-base",
            )}
          >
            {done}{" "}
            <span className={cn("text-xs font-medium text-muted-foreground sm:text-sm md:text-base", mobileSummary && "text-[10px] sm:text-sm")}>
              / {goalMinutes} <span className="inline">minutes</span>
            </span>
          </p>
          <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-base sm:text-sm", mobileSummary && "text-[10px] leading-tight sm:text-xs")}>
            Your daily goal
          </p>
        </div>
        {compact && done >= goalMinutes && (
          <span
            className={cn(
              "grid size-5 shrink-0 place-items-center rounded-full bg-brand-green text-primary-foreground",
              mobileSummary && "hidden sm:grid",
            )}
          >
            <Check className="size-3" strokeWidth={3} />
          </span>
        )}
      </div>
      <Progress
        value={percent}
        className={cn("h-2.5 bg-secondary/80", compact ? "mt-1.5 [&>div]:bg-brand-green" : "mt-4", mobileSummary && "hidden sm:block")}
      />
      <p
        className={cn(
          "mt-2 text-xs",
          compact && "hidden 2xl:block",
          done >= goalMinutes ? "text-success/80" : "text-muted-foreground",
        )}
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
