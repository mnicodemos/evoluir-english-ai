import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useProfile } from "@/hooks/useProfile";
import { loadNextStep } from "@/lib/pedagogy/nextStep.functions";

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
  return useQuery({
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
