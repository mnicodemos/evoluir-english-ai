import { describe, expect, it } from "vitest";

import { speakingWaitSummary, turnTimingRow } from "./speakingTiming";

describe("turnTimingRow", () => {
  it("measures every stage from the moment the student stopped recording", () => {
    expect(
      turnTimingRow({
        stoppedAt: 1000,
        transcribedAt: 1800,
        firstTextAt: 2600,
        firstAudioAt: 3900,
      }),
    ).toEqual({ transcribe_ms: 800, first_text_ms: 1600, first_audio_ms: 2900 });
  });

  it("keeps no row for an answer that never reached the first sound", () => {
    expect(turnTimingRow({ stoppedAt: 1000, transcribedAt: 1800 })).toBeNull();
  });

  it("drops impossible values instead of saving them", () => {
    expect(
      turnTimingRow({ stoppedAt: 5000, transcribedAt: 4000, firstAudioAt: 5000 + 200_000 }),
    ).toBeNull();
    expect(turnTimingRow({ stoppedAt: 5000, transcribedAt: 4000, firstAudioAt: 7000 })).toEqual({
      transcribe_ms: null,
      first_text_ms: null,
      first_audio_ms: 2000,
    });
  });
});

describe("speakingWaitSummary", () => {
  it("reports the median and the slowest 10% per stage", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      transcribe_ms: 500 + i * 100,
      first_text_ms: 1000 + i * 100,
      first_audio_ms: 2000 + i * 100,
    }));
    const summary = speakingWaitSummary(rows);
    expect(summary.answers).toBe(10);
    expect(summary.firstAudio).toEqual({ medianMs: 2400, p90Ms: 2800 });
    expect(summary.transcribed.medianMs).toBe(900);
  });

  it("is empty before any answer was measured", () => {
    expect(speakingWaitSummary([]).firstAudio).toEqual({ medianMs: null, p90Ms: null });
  });
});
