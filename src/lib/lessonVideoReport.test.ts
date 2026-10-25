import { describe, expect, it } from "vitest";

import { getCurriculum } from "./curriculum";
import { canonicalYoutubeUrl, lessonVideoReport } from "./lessonVideoReport";

describe("lesson video report", () => {
  it("lists every lesson with the approved video and the videos students got", () => {
    const curriculum = getCurriculum("a1");
    const key = curriculum[0]!.key;
    const report = lessonVideoReport(
      curriculum,
      [
        {
          curriculum_key: key,
          video_url: "https://www.youtube.com/watch?v=AAAAAAAAAAA",
          video_seconds: 240,
        },
      ],
      [
        {
          curriculum_key: key,
          video_url: "https://www.youtube.com/watch?v=BBBBBBBBBBB",
          video_duration_seconds: 300,
        },
        {
          curriculum_key: key,
          video_url: "https://www.youtube.com/watch?v=BBBBBBBBBBB",
          video_duration_seconds: 300,
        },
        {
          curriculum_key: key,
          video_url: "https://www.youtube.com/watch?v=CCCCCCCCCCC",
          video_duration_seconds: 0,
        },
        {
          curriculum_key: "other",
          video_url: "https://www.youtube.com/watch?v=DDDDDDDDDDD",
          video_duration_seconds: 1,
        },
      ],
    );
    expect(report).toHaveLength(curriculum.length);
    expect(report[0]!.approved?.id).toBe("AAAAAAAAAAA");
    expect(report[0]!.used.map((video) => [video.id, video.lessons])).toEqual([
      ["BBBBBBBBBBB", 2],
      ["CCCCCCCCCCC", 1],
    ]);
    expect(report[0]!.used[1]!.seconds).toBeNull();
    expect(report[1]!.approved).toBeNull();
  });

  it("stores one form of a YouTube link", () => {
    expect(canonicalYoutubeUrl("https://youtu.be/dQw4w9WgXcQ?t=3")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(canonicalYoutubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(canonicalYoutubeUrl("https://vimeo.com/123")).toBeNull();
  });
});
