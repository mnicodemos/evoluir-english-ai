import { describe, expect, it, vi } from "vitest";

const closes: { success: boolean }[] = [];

vi.mock("./ai-usage.server", () => ({
  hashAiRequest: async () => "hash",
  loadAiLimit: async () => ({ cache_ttl_seconds: 0 }),
  readAiCache: async () => null,
  reserveAiUsageWithWait: async () => ({ eventId: "e", startedAt: Date.now() }),
  // Slow on purpose: a background close would still be running when the
  // answer comes back.
  finishAiUsage: async (_ticket: unknown, result: { success: boolean }) => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    closes.push(result);
  },
  releaseAbandonedAiUsage: async () => {},
  writeAiCache: async () => {},
}));
vi.mock("./gemini.server", () => ({
  GEMINI_TEXT_MODEL: "gemini-test",
  GeminiError: class extends Error {
    status = 503;
  },
  callGemini: async () => "Start with: One reason I want this job is...",
}));

const { callGateway } = await import("./ai-gateway.server");

describe("AI usage record", () => {
  // User report, 2026-10-23: Writing help (operation teacher) answered "Your
  // previous message is still being answered" because the background close of
  // the last call was lost and its record stayed pending.
  it.each(["teacher", "chat", "talking"] as const)(
    "is closed before the %s answer is returned",
    async (operation) => {
      closes.length = 0;
      await callGateway([{ role: "user", content: "help" }], false, { userId: "u", operation });
      expect(closes).toEqual([{ success: true }]);
    },
  );
});
