import { describe, expect, it } from "vitest";

import { encodeWav, trimSilence } from "@/lib/voice-recorder";

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


describe("encodeWav", () => {
  it("downsamples to 16 kHz, mono, 16-bit PCM and keeps a one-second clip near 32 KB", async () => {
    const samples = new Float32Array(44100);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.sin((index / 44100) * 440 * 2 * Math.PI) * 0.25;
    }

    const wav = encodeWav([samples], 44100);
    const view = new DataView(await wav.arrayBuffer());

    expect(wav.type).toBe("audio/wav");
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(32000);
    expect(wav.size).toBe(32044);
  });
});
