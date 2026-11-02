import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    custom: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

import { toast } from "sonner";
import { PRONUNCIATION_TOAST_ID, createPronunciationToaster } from "./pronunciationToast";

describe("pronunciation toasts restricted to the Vocabulary page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows an approved pronunciation with the exclusive id", () => {
    const t = createPronunciationToaster();
    t.notify("success", "Pronunciation OK — 85%. Next word!");
    expect(toast.success).toHaveBeenCalledWith("Pronunciation OK — 85%. Next word!", {
      id: PRONUNCIATION_TOAST_ID,
    });
  });

  it("shows the below-70% coaching with the exclusive id and keeps its options", () => {
    const t = createPronunciationToaster();
    t.notify("warning", "60% — below 70%. Please repeat the word.", { duration: 8000 });
    expect(toast.warning).toHaveBeenCalledWith("60% — below 70%. Please repeat the word.", {
      id: PRONUNCIATION_TOAST_ID,
      duration: 8000,
    });
  });

  it("a late answer after leaving the page shows nothing", () => {
    const t = createPronunciationToaster();
    t.setActive(false);
    t.notify("success", "Pronunciation OK — 85%. Next word!");
    t.notify("error", "Could not check that pronunciation.");
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("re-entering the page re-enables the toasts", () => {
    const t = createPronunciationToaster();
    t.setActive(false);
    t.setActive(true);
    t.notify("info", "The check is already running.");
    expect(toast).toHaveBeenCalledWith("The check is already running.", {
      id: PRONUNCIATION_TOAST_ID,
    });
  });

  it("dismiss removes only the pronunciation toast", () => {
    const t = createPronunciationToaster();
    t.dismiss();
    expect(toast.dismiss).toHaveBeenCalledWith(PRONUNCIATION_TOAST_ID);
    expect(toast.dismiss).toHaveBeenCalledTimes(1);
  });

  it("dismissAll clears whatever notification is visible, with no id filter", () => {
    const t = createPronunciationToaster();
    t.dismissAll();
    expect(toast.dismiss).toHaveBeenCalledWith();
    expect(toast.dismiss).toHaveBeenCalledTimes(1);
  });
});
