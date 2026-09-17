import { useQuery } from "@tanstack/react-query";

import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";

/** Vocabulary score = learned words / total available words, as a 0-100 percentage. */
export function useVocabularyProgress() {
  return useQuery({
    queryKey: ["vocabulary-progress"],
    queryFn: async () => {
      const [total, mine] = await Promise.all([
        supabase.from("vocabulary").select("id", { count: "exact", head: true }),
        supabase.from("user_vocabulary").select("word_id, mastery_level"),
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

/**
 * Overall average = rounded mean of the four skill scores
 * (Listening, Reading, Talking, Writing).
 */
export function useOverallAverage() {
  const { data: profile } = useProfile();
  return useQuery({
    queryKey: ["overall-average", profile?.id, profile?.level],
    enabled: !!profile,
    queryFn: async () => {
      const { data: latest } = await supabase
        .from("progress")
        .select("listening_score, reading_score, speaking_score, writing_score")
        .eq("level", profile!.level)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const skills = [
        latest?.listening_score ?? 0,
        latest?.reading_score ?? 0,
        latest?.speaking_score ?? 0,
        latest?.writing_score ?? 0,
      ];
      return Math.round(skills.reduce((sum, s) => sum + s, 0) / skills.length);
    },
  });
}
