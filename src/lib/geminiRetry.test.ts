import { describe, expect, it } from "vitest";
import {
  geminiBackoffMs,
  isTemporaryGeminiStatus,
  GEMINI_ATTEMPTS_PER_MODEL,
} from "./gemini.server";
import { teacherErrorMessage } from "./teacherChat";

describe("gemini retry policy", () => {
  it("retries only temporary statuses", () => {
    expect(isTemporaryGeminiStatus(503)).toBe(true);
    expect(isTemporaryGeminiStatus(429)).toBe(true);
    expect(isTemporaryGeminiStatus(400)).toBe(false);
    expect(isTemporaryGeminiStatus(403)).toBe(false);
  });
  it("uses bounded backoff", () => {
    expect(GEMINI_ATTEMPTS_PER_MODEL).toBe(2);
    expect(geminiBackoffMs(1)).toBe(1500);
    expect(geminiBackoffMs(2)).toBe(3000);
    expect(geminiBackoffMs(1, 60)).toBe(5000);
  });
  it("maps provider overload to busy, not quota", () => {
    expect(
      teacherErrorMessage(new Error("The AI service is very busy right now (high demand).")),
    ).toBe("busy");
    expect(teacherErrorMessage(new Error("Another AI request is already running."))).toBe("busy");
  });
});
