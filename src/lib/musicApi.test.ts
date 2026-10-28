import { describe, expect, it } from "vitest";
import { MUSIC_SIGN_IN_MESSAGE, musicErrorMessage, musicRequestHeaders } from "./musicApi";

describe("Music Lab request", () => {
  it("sends the access token as a Bearer header with JSON", () => {
    expect(musicRequestHeaders("abc")).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer abc",
    });
  });
  it("refuses to build a request without a session", () => {
    expect(musicRequestHeaders(null)).toBeNull();
    expect(musicRequestHeaders("")).toBeNull();
  });
  it("asks to sign in again on 401", () => {
    expect(musicErrorMessage(401, "Please sign in to create a song.")).toBe(MUSIC_SIGN_IN_MESSAGE);
  });
  it("keeps the one-song-per-24-hours message on 429", () => {
    expect(musicErrorMessage(429, "You can create one song every 24 hours for now.")).toContain(
      "24 hours",
    );
  });
  it("hides provider details on 502", () => {
    expect(musicErrorMessage(502, "Gemini quota exceeded key=xyz")).not.toContain("xyz");
  });
});
