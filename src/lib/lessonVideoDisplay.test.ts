import { describe, expect, it } from "vitest";

import {
  formatVideoDuration,
  isPlayableVideoUrl,
  videoReviewPoints,
  youtubeVideoId,
} from "./lessonVideoDisplay";

describe("youtubeVideoId", () => {
  it("reads the id of watch and embed URLs", () => {
    expect(youtubeVideoId("https://www.youtube.com/watch?v=XySNOXSiBMo")).toBe("XySNOXSiBMo");
    expect(youtubeVideoId("https://www.youtube.com/embed/XySNOXSiBMo")).toBe("XySNOXSiBMo");
    expect(youtubeVideoId("https://youtu.be/XySNOXSiBMo")).toBe("XySNOXSiBMo");
  });

  it("returns null for a non-YouTube URL", () => {
    expect(youtubeVideoId("https://example.com/video")).toBeNull();
  });
});

describe("isPlayableVideoUrl", () => {
  it("accepts https YouTube links and direct video files", () => {
    expect(isPlayableVideoUrl("https://www.youtube.com/watch?v=XySNOXSiBMo")).toBe(true);
    expect(isPlayableVideoUrl("https://cdn.example.com/lesson.mp4")).toBe(true);
  });

  it("falls back for a missing, insecure or unsupported URL", () => {
    expect(isPlayableVideoUrl(null)).toBe(false);
    expect(isPlayableVideoUrl("")).toBe(false);
    expect(isPlayableVideoUrl("not a url")).toBe(false);
    expect(isPlayableVideoUrl("http://www.youtube.com/watch?v=XySNOXSiBMo")).toBe(false);
    expect(isPlayableVideoUrl("https://example.com/page.html")).toBe(false);
  });
});

describe("videoReviewPoints", () => {
  it("returns up to three short points taken from the lesson summary", () => {
    const points = videoReviewPoints(
      "Use the present perfect for experiences. Use for with a period. Use since with a starting point. A fourth sentence here.",
    );
    expect(points).toHaveLength(3);
    expect(points[0]).toBe("Use the present perfect for experiences.");
  });

  it("invents nothing when there is no summary", () => {
    expect(videoReviewPoints(null)).toEqual([]);
    expect(videoReviewPoints("")).toEqual([]);
  });
});

describe("formatVideoDuration", () => {
  it("formats stored seconds in whole minutes", () => {
    expect(formatVideoDuration(301)).toBe("5 min");
    expect(formatVideoDuration(30)).toBe("1 min");
  });

  it("returns null when no duration is stored", () => {
    expect(formatVideoDuration(0)).toBeNull();
    expect(formatVideoDuration(null)).toBeNull();
  });
});
