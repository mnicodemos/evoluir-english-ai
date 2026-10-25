import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: "token" } } }) },
  },
}));

import {
  TRANSCRIBE_CLIENT_TIMEOUT_MS,
  TRANSCRIBE_TIMEOUT_MESSAGE,
  transcribeAudio,
} from "./transcribe";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("transcribeAudio timeout", () => {
  it("gives up with a clear message when the check stalls", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );
    const result = transcribeAudio(new Blob(["x"], { type: "audio/wav" }));
    const check = expect(result).rejects.toThrow(TRANSCRIBE_TIMEOUT_MESSAGE);
    await vi.advanceTimersByTimeAsync(TRANSCRIBE_CLIENT_TIMEOUT_MS + 1);
    await check;
  });
});
