import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { currentUserId } from "@/lib/currentUserId";

/** Vocabulary score = learned words / total available words, as a 0-100 percentage. */
export function useVocabularyProgress() {
  return useQuery({
    queryKey: ["vocabulary-progress"],
    queryFn: async () => {
      const userId = (await currentUserId()) ?? "";
      const [total, mine] = await Promise.all([
        supabase.from("vocabulary").select("id", { count: "exact", head: true }),
        supabase.from("user_vocabulary").select("word_id, mastery_level").eq("user_id", userId),
      ]);
      const totalWords = total.count ?? 0;
      const learned = (mine.data ?? []).filter((row) => (row.mastery_level ?? 0) >= 75).length;
      return {
        learned,
        totalWords,
        percent: totalWords > 0 ? Math.round((learned / totalWords) * 100) : 0,
      };
    },
  });
}
