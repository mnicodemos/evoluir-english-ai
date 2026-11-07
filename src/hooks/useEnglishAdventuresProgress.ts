import { useCallback, useEffect, useState } from "react";

import { useProfile } from "@/hooks/useProfile";
import {
  englishAdventureProgress,
  readCompletedAdventures,
  saveCompletedAdventure,
} from "@/lib/englishAdventuresProgress";

/** Completed adventures on this device, out of the 40 activities planned for the track. */
export function useEnglishAdventuresProgress() {
  const { data: profile } = useProfile();
  const userId = profile?.id;
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    if (!userId) {
      setIds([]);
      return;
    }
    const sync = () => setIds(readCompletedAdventures(userId));
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [userId]);

  const markCompleted = useCallback(
    (adventureId: string) => {
      if (!userId) return;
      setIds(saveCompletedAdventure(userId, adventureId));
    },
    [userId],
  );

  return { ...englishAdventureProgress(ids), markCompleted };
}
