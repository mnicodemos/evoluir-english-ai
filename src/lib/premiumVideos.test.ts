import { describe, expect, it } from "vitest";

import { premiumVideoList } from "./premiumVideos";

describe("premium extra videos (by level)", () => {
  const rows = [
    {
      id: "2",
      level: "b1",
      title: "Phrasal verbs",
      video_url: "https://vimeo.com/2",
      created_at: "2026-10-31T10:00:00Z",
    },
    {
      id: "1",
      level: "a1",
      title: "Greetings",
      video_url: "https://vimeo.com/1",
      created_at: "2026-10-31T11:00:00Z",
    },
    {
      id: "3",
      level: "b1",
      title: "Small talk",
      video_url: "https://vimeo.com/3",
      created_at: "2026-10-31T09:00:00Z",
    },
    {
      id: "4",
      level: "zz",
      title: "Unknown",
      video_url: "https://vimeo.com/4",
      created_at: "2026-10-31T09:00:00Z",
    },
  ];

  it("orders by level, then oldest first, and drops unknown levels", () => {
    expect(premiumVideoList(rows, true).map((video) => video.id)).toEqual(["1", "3", "2"]);
  });

  it("hides the links from free students", () => {
    expect(premiumVideoList(rows, false).every((video) => video.url === null)).toBe(true);
    expect(premiumVideoList(rows, true)[0]?.url).toBe("https://vimeo.com/1");
  });
});

describe("Instagram Reels in the Shorts tab", () => {
  it("keeps one canonical Reel link", async () => {
    const { canonicalReelUrl, reelEmbedUrl } = await import("./premiumVideos");
    expect(canonicalReelUrl("https://www.instagram.com/reel/C1a2B3c4D5e/?igsh=abc")).toBe(
      "https://www.instagram.com/reel/C1a2B3c4D5e/",
    );
    expect(canonicalReelUrl("https://instagram.com/reels/C1a2B3c4D5e")).toBe(
      "https://www.instagram.com/reel/C1a2B3c4D5e/",
    );
    expect(canonicalReelUrl("https://www.instagram.com/evoluir/reel/C1a2B3c4D5e/")).toBe(
      "https://www.instagram.com/reel/C1a2B3c4D5e/",
    );
    expect(reelEmbedUrl("https://www.instagram.com/p/C1a2B3c4D5e/")).toBe(
      "https://www.instagram.com/reel/C1a2B3c4D5e/embed/",
    );
  });

  it("refuses other links", async () => {
    const { canonicalReelUrl } = await import("./premiumVideos");
    expect(canonicalReelUrl("https://vimeo.com/123456")).toBeNull();
    expect(canonicalReelUrl("http://www.instagram.com/reel/C1a2B3c4D5e/")).toBeNull();
    expect(canonicalReelUrl("https://evil-instagram.com/reel/C1a2B3c4D5e/")).toBeNull();
    expect(canonicalReelUrl("https://www.instagram.com/evoluir/")).toBeNull();
  });
});

describe("video kinds", () => {
  it("reads a missing kind as a regular video", () => {
    const base = { level: "a1", title: "T", video_url: "https://vimeo.com/1", created_at: "x" };
    const list = premiumVideoList(
      [
        { ...base, id: "1" },
        { ...base, id: "2", kind: "short" },
      ],
      true,
    );
    expect(list.map((video) => video.kind)).toEqual(["video", "short"]);
  });
});
