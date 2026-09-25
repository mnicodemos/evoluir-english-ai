import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Lock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { LEVELS, findLevel } from "@/lib/level";
import { cn } from "@/lib/utils";
import { refreshAfterLevelChange } from "@/lib/refreshKeys";

/**
 * Shows the student's CEFR level. The student can switch to the current level
 * or any level previously conquered (max_level); higher levels stay locked.
 * Switching levels never erases progress: each level's course state is kept
 * (lessons are keyed per level), so coming back shows everything as left.
 */
export function LevelCard({
  level,
  maxLevel,
  compact = false,
}: {
  level: string;
  maxLevel?: string | null;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const [changing, setChanging] = useState(false);
  const current = findLevel(level);
  const currentIndex = LEVELS.indexOf(current);
  const highest = findLevel(maxLevel || level);
  const highestIndex = LEVELS.indexOf(highest);

  const changeLevel = async (target: (typeof LEVELS)[number]) => {
    const targetIndex = LEVELS.indexOf(target);
    if (changing || targetIndex === currentIndex || targetIndex > highestIndex) return;
    setChanging(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("not authenticated");
      const { error } = await supabase
        .from("profiles")
        .update({ level: target.value })
        .eq("id", user.id);
      if (error) throw error;
      await refreshAfterLevelChange(queryClient);
      toast.success(`Level changed to ${target.label}.`, {
        description: "Your progress in every level is kept.",
      });
    } catch {
      toast.error("Could not change your level. Please try again.");
    } finally {
      setChanging(false);
    }
  };

  return (
    <div
      className={cn(
        "card-soft flex h-full min-w-0 flex-col justify-center",
        compact ? "p-3" : "p-4",
      )}
    >
      <div className="flex items-center gap-4">
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-xl bg-accent",
            compact ? "size-9" : "size-12",
          )}
        >
          <GraduationCap className={cn("text-accent-foreground", compact ? "size-4" : "size-6")} />
        </span>
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "truncate font-bold",
              compact ? "text-sm" : "text-lg sm:text-base md:text-lg",
            )}
          >
            {current.label}
          </p>
          <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-base sm:text-xs")}>
            <span>Your English level</span>
            <span> · </span>
            <span>{current.cefr}</span>
          </p>
        </div>
      </div>

      <div className={cn("grid grid-cols-6", compact ? "mt-2 gap-1" : "mt-3 gap-2")}>
        {LEVELS.map((l, i) => {
          const locked = i > highestIndex;
          const active = i === currentIndex;
          const conquered = !locked && !active;
          return (
            <button
              key={l.value}
              type="button"
              disabled={locked || active || changing}
              onClick={() => void changeLevel(l)}
              title={
                locked
                  ? `${l.label} — locked`
                  : active
                    ? `${l.label} — current`
                    : `Change to ${l.label}`
              }
              className={cn(
                "flex w-full min-w-0 items-center justify-center gap-1 rounded-lg border px-1 text-xs font-semibold transition sm:text-sm",
                compact ? "h-6" : "h-10",
                active && "border-transparent bg-success text-success-foreground",
                conquered &&
                  "border-border text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                locked && "cursor-not-allowed border-border/50 text-muted-foreground/50",
              )}
            >
              {locked && <Lock className="size-3.5 shrink-0" />}
              {l.value.toUpperCase()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
