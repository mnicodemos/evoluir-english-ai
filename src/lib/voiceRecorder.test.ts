import { describe, expect, it } from "vitest";

import { trimSilence } from "@/lib/voice-recorder";

const RATE = 16000;

function buildClip(): Float32Array {
  const samples = new Float32Array(RATE * 3); // 3 seconds
  // Speech only between 1.0s and 2.0s; the rest is silence.
  for (let index = RATE; index < RATE * 2; index += 1) {
    samples[index] = Math.sin((index / RATE) * 440 * 2 * Math.PI) * 0.4;
  }
  return samples;
}

describe("trimSilence", () => {
  it("drops the silence around the speech but keeps a safety margin", () => {
    const trimmed = trimSilence(buildClip(), RATE);
    expect(trimmed.length).toBeLessThan(RATE * 2);
    expect(trimmed.length).toBeGreaterThanOrEqual(RATE);
  });

  it("keeps the recording untouched when there is no detectable speech", () => {
    const silence = new Float32Array(RATE);
    expect(trimSilence(silence, RATE).length).toBe(RATE);
  });
});
