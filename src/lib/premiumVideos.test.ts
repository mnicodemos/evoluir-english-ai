import { describe, expect, it } from "vitest";

import { premiumVideoLesson, premiumVideoList } from "./premiumVideos";

describe("premium extra videos", () => {
  it("accepts curriculum lessons, never the review Test or unknown keys", () => {
    expect(premiumVideoLesson("b1-u2-l3")?.title).toBeTruthy();
    expect(premiumVideoLesson("b1-u6-l3")).toBeNull();
    expect(premiumVideoLesson("biz-u1-l1")).toBeNull();
  });

  it("orders by level, unit and lesson and hides links from free students", () => {
    const rows = [
      { curriculum_key: "b1-u2-l1", video_url: "https://vimeo.com/2", title: null },
      { curriculum_key: "a1-u1-l2", video_url: "https://vimeo.com/1", title: "My title" },
      { curriculum_key: "x-u1-l1", video_url: "https://vimeo.com/3", title: null },
    ];
    const free = premiumVideoList(rows, false);
    expect(free.map((video) => video.key)).toEqual(["a1-u1-l2", "b1-u2-l1"]);
    expect(free.every((video) => video.url === null)).toBe(true);
    expect(free[0]?.title).toBe("My title");
    expect(premiumVideoList(rows, true)[1]?.url).toBe("https://vimeo.com/2");
  });
});
