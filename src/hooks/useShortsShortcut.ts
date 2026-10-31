import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";

import { findLevel } from "@/lib/level";
import { loadPremiumVideos } from "@/lib/premiumVideos.functions";

const seenKey = (userId: string, level: string) => `evoluir-shorts-seen:${userId}:${level}`;

function readSeen(userId: string, level: string): number {
  try {
    return Number(window.localStorage.getItem(seenKey(userId, level)) ?? "0") || 0;
  } catch {
    return 0;
  }
}

/**
 * The shorts of the student's own level, for the phone Dashboard's shortcut
 * (owner request, 2026-10-31): `count` hides the shortcut when there are none,
 * and `hasNew` marks it while the level has more shorts than this device last
 * saw on the Shorts tab (markSeen, called by /learning/videos). Shares the
 * extra videos page's query.
 */
export function useShortsShortcut(
  userId: string | undefined,
  profileLevel: string | null | undefined,
) {
  const fetchVideos = useServerFn(loadPremiumVideos);
  const { data } = useQuery({
    queryKey: ["premium-videos", userId],
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
    queryFn: () => fetchVideos(),
  });
  const level = findLevel(profileLevel).value;
  const count = (data?.videos ?? []).filter(
    (video) => video.level === level && video.kind === "short",
  ).length;
  const [seen, setSeen] = useState<number | null>(null);
  useEffect(() => {
    if (userId) setSeen(readSeen(userId, level));
  }, [userId, level]);

  const markSeen = useCallback(() => {
    if (!userId || count === 0) return;
    try {
      window.localStorage.setItem(seenKey(userId, level), String(count));
    } catch {
      /* the mark comes back next visit; nothing breaks */
    }
    setSeen(count);
  }, [userId, level, count]);

  return { count, hasNew: seen !== null && count > seen, markSeen };
}
