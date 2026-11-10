import { describe, expect, it } from "vitest";

import { isVimeoEndedMessage } from "./vimeoPlayerEvents";

describe("isVimeoEndedMessage", () => {
  it("accepts Vimeo ended events as objects or JSON strings", () => {
    expect(isVimeoEndedMessage({ event: "ended" })).toBe(true);
    expect(isVimeoEndedMessage(JSON.stringify({ event: "ended" }))).toBe(true);
  });

  it("does not treat page load, playback start, or progress as completion", () => {
    expect(isVimeoEndedMessage({ event: "loaded" })).toBe(false);
    expect(isVimeoEndedMessage({ event: "play" })).toBe(false);
    expect(isVimeoEndedMessage({ event: "timeupdate", data: { percent: 1 } })).toBe(false);
  });

  it("rejects malformed and unrelated messages", () => {
    expect(isVimeoEndedMessage("{")).toBe(false);
    expect(isVimeoEndedMessage(null)).toBe(false);
    expect(isVimeoEndedMessage("ended")).toBe(false);
  });
});
