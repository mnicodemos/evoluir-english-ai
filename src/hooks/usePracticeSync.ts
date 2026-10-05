import { useQuery } from "@tanstack/react-query";

import { useUserLessons } from "@/hooks/useLearning";
import { supabase } from "@/integrations/supabase/client";

/**
 * When the current practice round began: the latest lesson completion, so every
 * device of the same account agrees on the round boundary.
 */
export function useRoundStart(): string | null | undefined {
  const { data } = useUserLessons();
  if (!data) return undefined;
  const times = data.map((row) => row.completed_at).filter(Boolean) as string[];
  return times.length ? times.sort().at(-1)! : null;
}

/** Practice saved on the server for this account, shared across devices. */
export function useSavedPractice() {
  return useQuery({
    queryKey: ["saved-practice"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId)
        return {
          listening: [] as string[],
          lastListening: null as { at: string; score: number | null } | null,
          writing: [] as { prompt: string; at: string }[],
        };
      const [listening, writing] = await Promise.all([
        supabase
          .from("activities")
          .select("created_at, score")
          .eq("user_id", userId)
          .eq("activity_type", "listening")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("writing_submissions")
          .select("prompt, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
          .limit(1000),
      ]);
      return {
        listening: (listening.data ?? []).map((row) => row.created_at),
        // The latest saved Listening session, shown as "last result" on the page.
        lastListening: listening.data?.[0]
          ? { at: listening.data[0].created_at, score: listening.data[0].score ?? null }
          : null,
        writing: (writing.data ?? []).map((row) => ({ prompt: row.prompt, at: row.created_at })),
      };
    },
  });
}
