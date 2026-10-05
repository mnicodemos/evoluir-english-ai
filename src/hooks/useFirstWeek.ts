import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { firstWeekProgress, showFirstWeek, type FirstWeekEvidence } from "@/lib/firstWeek";

/**
 * Evidence for the guided first week, read only for accounts young enough to
 * see the guide. Every count is filtered by the student's own id.
 */
export function useFirstWeek(
  profile: { id: string; created_at?: string | null; league_opt_in?: boolean } | null | undefined,
) {
  const eligible = !!profile && showFirstWeek(profile.created_at, 0);
  const { data: evidence } = useQuery({
    queryKey: ["first-week", profile?.id, profile?.league_opt_in],
    enabled: eligible,
    queryFn: async (): Promise<FirstWeekEvidence> => {
      const userId = profile!.id;
      const count = { count: "exact" as const, head: true };
      const activities = (type: string) =>
        supabase
          .from("activities")
          .select("id", count)
          .eq("user_id", userId)
          .eq("activity_type", type);
      const [conversations, writings, listenings, lessons, words, mistakes] = await Promise.all([
        activities("conversation"),
        activities("writing"),
        activities("listening"),
        supabase
          .from("user_lessons")
          .select("id", count)
          .eq("user_id", userId)
          .not("completed_at", "is", null),
        supabase
          .from("user_vocabulary")
          .select("id", count)
          .eq("user_id", userId)
          .not("last_reviewed_at", "is", null),
        supabase
          .from("learning_errors")
          .select("id", count)
          .eq("user_id", userId)
          .not("last_reviewed_at", "is", null),
      ]);
      return {
        conversations: conversations.count ?? 0,
        writings: writings.count ?? 0,
        listenings: listenings.count ?? 0,
        lessonsCompleted: lessons.count ?? 0,
        wordsReviewed: words.count ?? 0,
        mistakesReviewed: mistakes.count ?? 0,
        joinedLeague: !!profile!.league_opt_in,
      };
    },
  });
  if (!eligible || !evidence) return null;
  const progress = firstWeekProgress(evidence);
  return showFirstWeek(profile!.created_at, progress.doneCount) ? progress : null;
}
