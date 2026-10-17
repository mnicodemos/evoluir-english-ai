import { toast } from "sonner";

import { addFocusLog } from "@/hooks/useFocusLog";
import { focusStop } from "@/lib/focusTimer";
import { studyToday } from "@/lib/today";

/**
 * Stop from the /life section or the floating window: a focus block stopped
 * early keeps the minutes it ran in the week's minutes, but only a finished
 * block counts as a 🍅 (user decision).
 */
export function stopFocusSaving(t: (label: string) => string) {
  const stopped = focusStop();
  if (!stopped) return;
  addFocusLog({ day: studyToday(), minutes: stopped.minutes, key: stopped.key, partial: true });
  toast(`${stopped.minutes} ${t("min saved; a stopped block does not count as a 🍅.")}`);
}
