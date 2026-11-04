import type { ReactElement } from "react";
import { toast, type ExternalToast } from "sonner";

/** Every pronunciation-evaluation toast shares this id, so leaving the
 *  Vocabulary page can dismiss whatever is visible at once. */
export const PRONUNCIATION_TOAST_ID = "vocabulary-pronunciation-result";

export type PronunciationToastKind = "info" | "success" | "warning" | "error";

/**
 * Pronunciation toasts live only on the Vocabulary page: `notify` is a no-op
 * while inactive, so a late async answer after the student leaves never shows
 * a toast on another screen. Re-entering the page re-enables them.
 */
export function createPronunciationToaster() {
  let active = true;
  return {
    setActive(value: boolean) {
      active = value;
    },
    /** Removes the visible pronunciation toast, if any. Other toasts stay. */
    dismiss() {
      toast.dismiss(PRONUNCIATION_TOAST_ID);
    },
    /** Clears whatever notification is on screen (owner request, 2026-11-02:
     *  pressing "I know it" must not leave a stale alert above the card). */
    dismissAll() {
      toast.dismiss();
    },
    notify(kind: PronunciationToastKind, message: string, options?: ExternalToast) {
      if (!active) return;
      const opts: ExternalToast = { id: PRONUNCIATION_TOAST_ID, ...options };
      if (kind === "success") toast.success(message, opts);
      else if (kind === "warning") toast.warning(message, opts);
      else if (kind === "error") toast.error(message, opts);
      else toast.info(message, opts);
    },
    /** Rich result card (score badge, what EVO heard), same id and page lock. */
    custom(render: (id: string | number) => ReactElement, options?: ExternalToast) {
      if (!active) return;
      toast.custom(render, { id: PRONUNCIATION_TOAST_ID, ...options });
    },
  };
}

export type PronunciationToaster = ReturnType<typeof createPronunciationToaster>;
