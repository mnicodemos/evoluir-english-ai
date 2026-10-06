import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { waitForPlaybackEnd } from "@/lib/speech";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("waitForPlaybackEnd", () => {
  it("resolves at once when the sound already finished", async () => {
    await expect(waitForPlaybackEnd(() => true, 5_000)).resolves.toBeUndefined();
  });

  it("resolves as soon as the sound ends", async () => {
    let done = false;
    let resolved = false;
    void waitForPlaybackEnd(() => done, 5_000).then(() => (resolved = true));
    await vi.advanceTimersByTimeAsync(600);
    expect(resolved).toBe(false);
    done = true;
    await vi.advanceTimersByTimeAsync(200);
    expect(resolved).toBe(true);
  });

  it("never waits forever when the end signal is lost", async () => {
    let resolved = false;
    void waitForPlaybackEnd(() => false, 3_000).then(() => (resolved = true));
    await vi.advanceTimersByTimeAsync(2_800);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(400);
    expect(resolved).toBe(true);
  });
});
