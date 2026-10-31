import { describe, expect, it } from "vitest";

import { featureUsageReport } from "./featureUsage";

const now = new Date("2026-10-31T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();

describe("feature usage report", () => {
  it("counts students and uses in 7 and 30 days, admins left out", () => {
    const rows = featureUsageReport(
      [
        { feature: "extra_video", userId: "a", at: daysAgo(1) },
        { feature: "extra_video", userId: "a", at: daysAgo(2) },
        { feature: "extra_video", userId: "b", at: daysAgo(10) },
        { feature: "extra_video", userId: "c", at: daysAgo(40) },
        { feature: "extra_video", userId: "admin", at: daysAgo(1) },
        { feature: "quiz", userId: "b", at: daysAgo(3) },
      ],
      { adminIds: new Set(["admin"]), now },
    );
    const video = rows.find((row) => row.id === "extra_video")!;
    expect(video).toMatchObject({ students7: 1, uses7: 2, students30: 2, uses30: 3 });
    expect(rows.find((row) => row.id === "quiz")).toMatchObject({ students7: 1, uses30: 1 });
    expect(rows.find((row) => row.id === "video_like")).toMatchObject({
      uses30: 0,
      available: true,
    });
  });

  it("marks a feature whose table could not be read", () => {
    const rows = featureUsageReport([], {
      adminIds: new Set(),
      unavailable: new Set(["video_comment"]),
      now,
    });
    expect(rows.find((row) => row.id === "video_comment")?.available).toBe(false);
  });
});
