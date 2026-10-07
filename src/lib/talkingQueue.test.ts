import { describe, expect, it, vi } from "vitest";

import { BUSY_RETRY_DELAYS_MS, isTalkingBusy, retryWhileBusy, talkingTurn } from "./talkingQueue";

const busy = () => new Error("Another AI request is already running. Please wait a moment.");
const noWait = () => Promise.resolve();

describe("retryWhileBusy", () => {
  it("retries while the server reports another request running", async () => {
    const request = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(busy())
      .mockRejectedValueOnce(busy())
      .mockResolvedValue("Hi!");
    await expect(retryWhileBusy(request, { wait: noWait })).resolves.toBe("Hi!");
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("gives up after the last retry and never retries other errors", async () => {
    const always = vi.fn<() => Promise<string>>().mockRejectedValue(busy());
    await expect(retryWhileBusy(always, { wait: noWait })).rejects.toThrow("already running");
    expect(always).toHaveBeenCalledTimes(BUSY_RETRY_DELAYS_MS.length + 1);

    const other = vi.fn<() => Promise<string>>().mockRejectedValue(new Error("502"));
    await expect(retryWhileBusy(other, { wait: noWait })).rejects.toThrow("502");
    expect(other).toHaveBeenCalledTimes(1);
  });

  it("stops retrying once the screen is left", async () => {
    const abort = new AbortController();
    abort.abort();
    const request = vi.fn<() => Promise<string>>().mockRejectedValue(busy());
    await expect(retryWhileBusy(request, { signal: abort.signal, wait: noWait })).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe("talkingTurn", () => {
  it("starts a request only after the previous one ended", async () => {
    const order: string[] = [];
    let finishFirst: (() => void) | undefined;
    const first = talkingTurn(
      () =>
        new Promise<void>((resolve) => {
          order.push("first:start");
          finishFirst = () => {
            order.push("first:end");
            resolve();
          };
        }),
    );
    const second = talkingTurn(async () => {
      order.push("second:start");
    });
    await vi.waitFor(() => expect(finishFirst).toBeDefined());
    expect(order).toEqual(["first:start"]);
    finishFirst?.();
    await Promise.all([first, second]);
    expect(order).toEqual(["first:start", "first:end", "second:start"]);
  });

  it("recognises the server's busy message", () => {
    expect(isTalkingBusy(busy())).toBe(true);
    expect(isTalkingBusy(new Error("timeout"))).toBe(false);
  });
});
