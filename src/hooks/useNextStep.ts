import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";

import { useProfile } from "@/hooks/useProfile";
import { profileIsPremium } from "@/lib/billing/subscriptionView";
import {
  isExtraVideoDay,
  withExtraVideoQuickWin,
} from "@/lib/extraVideoQuickWin";
import { findLevel } from "@/lib/level";
import { loadNextStep } from "@/lib/pedagogy/nextStep.functions";
import { loadPremiumVideos } from "@/lib/premiumVideos.functions";
import { studyToday } from "@/lib/today";

export type NextStepData = Awaited<ReturnType<typeof loadNextStep>>;

/**
 * EVO's next step, shared by the Dashboard cards (the EVO card, Keep
 * improving and Your English Skills). loadNextStep is the page's heaviest
 * server read, so the last answer is kept in the browser and shown at once on
 * the next visit while the fresh one loads (user request: EVO's card had a
 * delay on every page load; 2026-10-25: Keep improving still waited for it).
 * Read after mount, so server and client render the same first.
 */
export function useNextStep(options: { enabled?: boolean } = {}) {
  const { data: profile } = useProfile();
  const storeKey = profile?.id ? `evoluir-next-step:${profile.id}:${profile.level ?? ""}` : null;
  const [stored, setStored] = useState<NextStepData | undefined>(undefined);
  useEffect(() => {
    if (!storeKey) return;
    try {
      const raw = window.localStorage.getItem(storeKey);
      setStored(raw ? (JSON.parse(raw) as NextStepData) : undefined);
    } catch {
      setStored(undefined);
    }
  }, [storeKey]);
  // "Watch an extra video" in the Quick Win's rotation (owner request,
  // 2026-10-31): on its days, for Premium students whose level has videos and
  // whose regular-video completion is confirmed by the server (extraVideoQuickWin.ts).
  const today = studyToday();
  const premium = !!profile && profileIsPremium(profile);
  const videoDay = premium && isExtraVideoDay(today);
  const fetchVideos = useServerFn(loadPremiumVideos);
  const {
    data: videos,
    isFetched: videosFetched,
    isError: videosError,
  } = useQuery({
    queryKey: ["premium-videos", profile?.id],
    enabled: !!profile?.id && videoDay,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: () => fetchVideos(),
  });
  const studentLevel = findLevel(profile?.level).value;
  const levelHasVideos = !!videos?.videos.some((video) => video.level === studentLevel);
  const select = useCallback(
    (step: NextStepData): NextStepData => {
      // Keep a stable video Quick Win while the server status is unknown.
      // A loading/error state must never be interpreted as "completed".
      // Once available, the persisted server record is the sole source of truth.
      const serverStatusKnown =
        videosFetched &&\n        !videosError &&\n        videos?.watchedToday !== null &&\n        videos?.watchedToday !== undefined;
      return withExtraVideoQuickWin<NextStepData>(step, {
        day: today,
        premium,
        // Until availability is confirmed, avoid exposing the underlying EVO
        // Quick Win or showing a false "nothing pending" state.
        levelHasVideos: serverStatusKnown ? levelHasVideos : true,
        watchedToday: serverStatusKnown && videos?.watchedToday === true,
      });
    },
    [
      today,
      premium,
      videosFetched,
      videosError,
      videos?.watchedToday,
      levelHasVideos,
    ],
  );

  return useQuery({
    select,
    queryKey: ["next-step", profile?.level ?? null],
    queryFn: async () => {
      const result = await loadNextStep({ data: undefined });
      if (storeKey) {
        try {
          window.localStorage.setItem(storeKey, JSON.stringify(result));
        } catch {
          // Storage full or blocked: the cards simply load as before.
        }
      }
      return result;
    },
    staleTime: 60 * 1000,
    placeholderData: () => stored,
    ...(options.enabled === undefined ? {} : { enabled: options.enabled }),
  });
}
