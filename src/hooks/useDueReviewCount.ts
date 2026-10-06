import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchUserVocabularyMastery,
  USER_VOCABULARY_MASTERY_KEY,
} from "@/hooks/useUserVocabularyMastery";
import { countDueReviews } from "@/lib/reviewReminder";

/**
 * Vocabulary reviews waiting today, from the shared mastery rows (no extra
 * request). Keyed under the mastery key, so every place that refreshes mastery
 * after "I know it" also refreshes this count.
 */
export function useDueReviewCount(userId: string | undefined): number {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: [...USER_VOCABULARY_MASTERY_KEY, "due-reviews", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => countDueReviews(await fetchUserVocabularyMastery(queryClient)),
  });
  return data ?? 0;
}
