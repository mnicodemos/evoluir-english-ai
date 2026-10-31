import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  loadVideoSocial,
  toggleVideoLike,
  type VideoSocialCounts,
} from "@/lib/premiumVideoSocial.functions";
import { haptic } from "@/lib/haptics";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

type SocialData = { ready: boolean; counts: Record<string, VideoSocialCounts> };

/**
 * Likes and comment counts of the extra videos on screen (migration 0103).
 * `ready` stays false until the migration is applied, so the screen hides the
 * buttons instead of showing zeros that cannot change. A like shows at once
 * and rolls back if the server refuses it.
 */
export function useVideoSocial(userId: string | undefined, videoIds: string[]) {
  const { lang } = useUiLang();
  const t = (text: string) => (lang === "pt" ? (uiPt[text] ?? text) : text);
  const queryClient = useQueryClient();
  const fetchSocial = useServerFn(loadVideoSocial);
  const like = useServerFn(toggleVideoLike);
  const ids = [...videoIds].sort();
  const queryKey = ["video-social", userId, ids.join(",")];

  const query = useQuery({
    queryKey,
    enabled: !!userId && ids.length > 0,
    staleTime: 30_000,
    queryFn: () => fetchSocial({ data: { videoIds: ids } }) as Promise<SocialData>,
  });

  const mutation = useMutation({
    mutationFn: (videoId: string) => like({ data: { videoId } }),
    onMutate: async (videoId) => {
      haptic("tap");
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SocialData>(queryKey);
      if (previous?.counts[videoId]) {
        const entry = previous.counts[videoId]!;
        queryClient.setQueryData<SocialData>(queryKey, {
          ...previous,
          counts: {
            ...previous.counts,
            [videoId]: {
              ...entry,
              liked: !entry.liked,
              likes: Math.max(0, entry.likes + (entry.liked ? -1 : 1)),
            },
          },
        });
      }
      return { previous };
    },
    onError: (error, _videoId, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error(t(error instanceof Error ? error.message : "Could not save your like."));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["video-social", userId] }),
  });

  return {
    ready: query.data?.ready ?? false,
    counts: query.data?.counts ?? {},
    toggleLike: (videoId: string) => mutation.mutate(videoId),
    refresh: () => queryClient.invalidateQueries({ queryKey: ["video-social", userId] }),
  };
}
