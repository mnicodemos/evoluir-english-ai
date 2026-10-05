import { describe, expect, it } from "vitest";

import {
  attemptTimeout,
  canWaitForRetry,
  TRANSCRIPTION_MIN_ATTEMPT_MS,
} from "./transcriptionBudget";

describe("transcription budget", () => {
  it("uses the attempt cap while the budget is large", () => {
    expect(attemptTimeout(30_000, 10_000, 0)).toBe(10_000);
  });

  it("shrinks the attempt to what is left of the budget", () => {
    expect(attemptTimeout(20_000, 15_000, 12_000)).toBe(8_000);
  });

  it("refuses an attempt that cannot finish in time", () => {
    expect(attemptTimeout(20_000, 15_000, 20_000 - TRANSCRIPTION_MIN_ATTEMPT_MS + 1)).toBe(0);
    expect(attemptTimeout(20_000, 15_000, 25_000)).toBe(0);
  });

  it("only waits for a retry when the retry still has time", () => {
    expect(canWaitForRetry(20_000, 3_000, 10_000)).toBe(true);
    expect(canWaitForRetry(20_000, 3_000, 16_000)).toBe(false);
  });
});
