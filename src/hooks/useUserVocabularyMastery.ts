import type { QueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const USER_VOCABULARY_MASTERY_KEY = ["user-vocabulary-mastery"] as const;

export type WordMastery = {
  word_id: string;
  mastery_level: number;
  last_reviewed_at: string | null;
};

/**
 * The student's own word mastery, read once and shared by every reader
 * (study snapshot and the dashboard indicator). Same rows as before, same
 * meaning — only the duplicated request is gone. `last_reviewed_at` lets the
 * Today's Progress card separate words mastered today from older mastery.
 */
export function fetchUserVocabularyMastery(queryClient: QueryClient): Promise<WordMastery[]> {
  return queryClient.fetchQuery({
    queryKey: [...USER_VOCABULARY_MASTERY_KEY],
    staleTime: 30_000,
    queryFn: async (): Promise<WordMastery[]> => {
      const { data, error } = await supabase
        .from("user_vocabulary")
        .select("word_id, mastery_level, last_reviewed_at");
      if (error) throw error;
      return (data ?? []).map((row) => ({
        word_id: row.word_id,
        mastery_level: row.mastery_level ?? 0,
        last_reviewed_at: row.last_reviewed_at ?? null,
      }));
    },
  });
}
