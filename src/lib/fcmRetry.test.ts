import { afterEach, describe, expect, it, vi } from "vitest";

import { isTemporaryFcmStatus, sendFcm } from "./fcm.server";

const credentials = { lovableKey: "k", connectionKey: "c" };
const message = { title: "Word of the day", body: "serendipity" };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function stubAnswers(statuses: number[]) {
  const calls = { count: 0 };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const status = statuses[Math.min(calls.count, statuses.length - 1)]!;
      calls.count += 1;
      return new Response(status === 200 ? "{}" : "error code: 502", { status });
    }),
  );
  return calls;
}

describe("FCM send", () => {
  // User report, 2026-10-23: the 9:00 word push got 502 for every device.
  it("tries a temporary failure again and delivers", async () => {
    vi.useFakeTimers();
    const calls = stubAnswers([502, 200]);
    const sending = sendFcm(credentials, "token", message);
    await vi.runAllTimersAsync();
    expect(await sending).toEqual({ ok: true });
    expect(calls.count).toBe(2);
  });

  it("gives up after two more tries", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const calls = stubAnswers([502]);
    const sending = sendFcm(credentials, "token", message);
    await vi.runAllTimersAsync();
    expect(await sending).toMatchObject({ ok: false, status: 502, stale: false });
    expect(calls.count).toBe(3);
  });

  it("does not repeat a final answer", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const calls = stubAnswers([400]);
    expect(await sendFcm(credentials, "token", message)).toMatchObject({ ok: false });
    expect(calls.count).toBe(1);
    expect(isTemporaryFcmStatus(404)).toBe(false);
    expect(isTemporaryFcmStatus(503)).toBe(true);
  });
});
