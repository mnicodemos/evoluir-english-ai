import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";

import { loadPremiumVideos } from "@/lib/premiumVideos.functions";

const seenKey = (userId: string) => `evoluir-extra-videos-seen:${userId}`;

function readSeen(userId: string): number {
  try {
    return Number(window.localStorage.getItem(seenKey(userId)) ?? "0") || 0;
  } catch {
    return 0;
  }
}

/**
 * "New" for the Premium extra videos (owner request, 2026-10-31: students
 * should notice them): true while the owner has published more videos than
 * this device last saw on /learning/videos, so the learning path pill shows a
 * "New" mark and the Dashboard bell an item until the student opens the page;
 * a video added later brings it back. Shares the page's query.
 */
export function useExtraVideosNews(userId: string | undefined) {
  const fetchVideos = useServerFn(loadPremiumVideos);
  const { data } = useQuery({
    queryKey: ["premium-videos", userId],
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
    queryFn: () => fetchVideos(),
  });
  const total = data?.videos.length ?? 0;
  const [seen, setSeen] = useState<number | null>(null);
  useEffect(() => {
    if (userId) setSeen(readSeen(userId));
  }, [userId]);

  const markSeen = useCallback(() => {
    if (!userId || total === 0) return;
    try {
      window.localStorage.setItem(seenKey(userId), String(total));
    } catch {
      /* the mark comes back next visit; nothing breaks */
    }
    setSeen(total);
  }, [userId, total]);

  return { hasNew: seen !== null && total > seen, total, markSeen };
}
