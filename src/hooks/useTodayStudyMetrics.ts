import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayStudyMetrics } from "@/lib/studyDay";
import { studyDayStartIso } from "@/lib/today";

/** Daily evidence only; the AI's cumulative study snapshot remains independent. */
export function useTodayStudyMetrics(userId?: string) {
  const queryClient = useQueryClient();
  const start = studyDayStartIso();
  const end = new Date(new Date(start).getTime() + 86_400_000).toISOString();

  useEffect(() => {
    if (!userId) return;
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["today-study-metrics", userId] });
    };
    const channel = supabase.channel(`today-study-metrics-${userId}`);
    for (const table of ["user_lessons", "user_flashcards", "user_vocabulary", "quiz_results"]) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
        refresh,
      );
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return useQuery({
    queryKey: ["today-study-metrics", userId, start],
    enabled: !!userId,
    staleTime: 60_000,
    // Safety refresh when Realtime is unavailable; keep last successful data visible.
    refetchInterval: 60_000,
    queryFn: async () => {
      if (!userId) throw new Error("A signed-in student is required");
      // Recompute on every poll so the query crosses São Paulo midnight even
      // when the component stays mounted and the device timezone differs.
      const currentStart = studyDayStartIso();
      const currentEnd = new Date(new Date(currentStart).getTime() + 86_400_000).toISOString();
      const [lessons, cards, words, quizzes] = await Promise.all([
        supabase
          .from("user_lessons")
          .select("completed_at, video_completed_at")
          .eq("user_id", userId)
          .or(
            `and(completed_at.gte.${currentStart},completed_at.lt.${currentEnd}),and(video_completed_at.gte.${currentStart},video_completed_at.lt.${currentEnd})`,
          ),
        supabase
          .from("user_flashcards")
          .select("mastery_level, times_reviewed, last_reviewed_at")
          .eq("user_id", userId)
          .gte("last_reviewed_at", start)
          .lt("last_reviewed_at", end),
        supabase
          .from("user_vocabulary")
          .select("mastery_level, last_reviewed_at")
          .eq("user_id", userId)
          .gte("last_reviewed_at", start)
          .lt("last_reviewed_at", end),
        // Keep the existing latest-30 quiz window before the daily aggregation.
        supabase
          .from("quiz_results")
          .select("score, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      for (const result of [lessons, cards, words, quizzes]) if (result.error) throw result.error;
      return todayStudyMetrics(
        {
          lessons: lessons.data ?? [],
          cards: cards.data ?? [],
          words: words.data ?? [],
          quizzes: quizzes.data ?? [],
        },
        new Date(start),
      );
    },
  });
}
