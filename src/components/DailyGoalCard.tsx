import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Hourglass, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

const presets = [10, 15, 20, 30, 45, 60];

export function useMinutesToday(userId?: string) {
  return useQuery({
    queryKey: ["minutes-today", userId],
    enabled: !!userId,
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("activities")
        .select("duration_minutes")
        .gte("created_at", start.toISOString());
      if (error) throw error;
      return (data ?? []).reduce((sum, a) => sum + (a.duration_minutes ?? 0), 0);
    },
  });
}

export function DailyGoalCard({ userId, goalMinutes }: { userId: string; goalMinutes: number }) {
  const queryClient = useQueryClient();
  const { data: done = 0 } = useMinutesToday(userId);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(goalMinutes));

  useEffect(() => {
    if (open) setValue(String(goalMinutes));
  }, [open, goalMinutes]);

  const save = useMutation({
    mutationFn: async (minutes: number) => {
      const { error } = await supabase.from("profiles").update({ daily_minutes: minutes }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setOpen(false);
      toast.success("Daily goal updated");
    },
    onError: () => toast.error("Could not update your goal. Please try again."),
  });

  const minutes = Number(value);
  const valid = Number.isFinite(minutes) && minutes >= 5 && minutes <= 240;
  const percent = goalMinutes > 0 ? Math.min(100, Math.round((done / goalMinutes) * 100)) : 0;

  return (
    <div className="card-soft flex flex-col justify-center p-5">
      <div className="flex items-center gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[oklch(0.95_0.06_25)]">
          <Hourglass className="size-6 text-[oklch(0.55_0.18_25)]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="whitespace-nowrap text-lg font-bold sm:text-base md:text-lg">
            {done}{" "}
            <span className="text-xs font-medium text-muted-foreground sm:text-sm md:text-base">
              / {goalMinutes} <span className="inline">minutes</span>
            </span>
          </p>
          <p className="text-base text-muted-foreground sm:text-sm">Your daily goal</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Change your daily goal">
              <Pencil className="size-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Daily goal</DialogTitle>
              <DialogDescription>How many minutes of English do you want to practise each day?</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                  <Button
                    key={p}
                    type="button"
                    variant={Number(value) === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => setValue(String(p))}
                  >
                    {p} min
                  </Button>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor="daily-goal">Custom (5–240 minutes)</Label>
                <Input
                  id="daily-goal"
                  type="number"
                  min={5}
                  max={240}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => save.mutate(minutes)} disabled={!valid || save.isPending}>
                {save.isPending ? "Saving..." : "Save goal"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Progress value={percent} className="mt-4 h-2" />
      <p className={`mt-2 text-xs ${done >= goalMinutes ? "text-success/80" : "text-muted-foreground"}`}>
        {done >= goalMinutes ? (
          "Goal reached today. Great work!"
        ) : (
          <>
            <span>{goalMinutes - done}</span>{" "}
            <span>minutes left today</span>{" "}
            <span>({percent}%)</span>
          </>
        )}
      </p>
    </div>
  );
}
