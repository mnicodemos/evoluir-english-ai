import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: "token" } } }) },
  },
}));

import {
  TRANSCRIBE_CLIENT_TIMEOUT_MS,
  TRANSCRIBE_TIMEOUT_MESSAGE,
  getTranscriptionAudioFormat,
  transcribeAudio,
} from "./transcribe";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("transcription audio payload", () => {
  it("keeps compact WAV uploads in their native format", () => {
    expect(getTranscriptionAudioFormat(new Blob(["wav"], { type: "audio/wav" }))).toEqual({
      mimeType: "audio/wav",
      extension: "wav",
    });
  });

  it("supports WebM/Opus without converting it to a larger WAV payload", () => {
    expect(
      getTranscriptionAudioFormat(new Blob(["opus"], { type: "audio/webm;codecs=opus" })),
    ).toEqual({ mimeType: "audio/webm", extension: "webm" });
  });

  it("rejects unsupported audio formats before upload", () => {
    expect(() => getTranscriptionAudioFormat(new Blob(["mp3"], { type: "audio/mpeg" }))).toThrow(
      "This audio format is not supported.",
    );
  });
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
