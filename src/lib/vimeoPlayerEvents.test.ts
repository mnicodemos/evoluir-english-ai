import { describe, expect, it } from "vitest";

import { isVimeoEndedMessage, isVimeoReadyMessage } from "./vimeoPlayerEvents";

describe("Vimeo Player API events", () => {
  it("recognizes ready and ended events as objects or JSON strings", () => {
    expect(isVimeoReadyMessage({ event: "ready" })).toBe(true);
    expect(isVimeoReadyMessage(JSON.stringify({ event: "ready" }))).toBe(true);
    expect(isVimeoEndedMessage({ event: "ended" })).toBe(true);
    expect(isVimeoEndedMessage(JSON.stringify({ event: "ended" }))).toBe(true);
  });

  it("does not treat loading, playback start, or progress as completion", () => {
    for (const event of ["loaded", "play", "playing", "timeupdate", "pause", "ready"]) {
      expect(isVimeoEndedMessage({ event })).toBe(false);
    }
  });

  it("rejects malformed and unrelated messages", () => {
    expect(isVimeoEndedMessage("{")).toBe(false);
    expect(isVimeoEndedMessage(null)).toBe(false);
    expect(isVimeoEndedMessage("ended")).toBe(false);
    expect(isVimeoReadyMessage({ method: "ready" })).toBe(false);
  });
});
