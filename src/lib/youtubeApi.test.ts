import { describe, expect, it } from "vitest";

import { apiSearchUrl, candidatesFromApi, decodeEntities, parseIsoDuration } from "./youtubeApi";

describe("YouTube Data API parsing", () => {
  it("reads ISO 8601 durations", () => {
    expect(parseIsoDuration("PT4M30S")).toBe(270);
    expect(parseIsoDuration("PT1H2M")).toBe(3720);
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(parseIsoDuration("P0D")).toBeNull();
    expect(parseIsoDuration("PT")).toBeNull();
    expect(parseIsoDuration("4:30")).toBeNull();
  });

  it("decodes escaped titles", () => {
    expect(decodeEntities("Don&#39;t say &quot;hi&quot; &amp; go")).toBe('Don\'t say "hi" & go');
  });

  it("joins search results with their durations in search order", () => {
    const candidates = candidatesFromApi(
      {
        items: [
          { id: { videoId: "bbbbbbbbbbb" }, snippet: { title: "Greetings", channelTitle: "A" } },
          { id: { videoId: "aaaaaaaaaaa" }, snippet: { title: "Names", channelTitle: "B" } },
          { id: { videoId: "ccccccccccc" }, snippet: { title: "No length", channelTitle: "C" } },
          { id: {}, snippet: { title: "A channel result" } },
        ],
      },
      {
        items: [
          { id: "aaaaaaaaaaa", contentDetails: { duration: "PT3M" } },
          { id: "bbbbbbbbbbb", contentDetails: { duration: "PT5M10S" } },
        ],
      },
    );
    expect(candidates).toEqual([
      { id: "bbbbbbbbbbb", seconds: 310, title: "Greetings", channel: "A" },
      { id: "aaaaaaaaaaa", seconds: 180, title: "Names", channel: "B" },
    ]);
  });

  it("asks for captioned, embeddable, safe videos", () => {
    const url = new URL(apiSearchUrl("greetings for beginners", "KEY"));
    expect(url.searchParams.get("videoCaption")).toBe("closedCaption");
    expect(url.searchParams.get("videoEmbeddable")).toBe("true");
    expect(url.searchParams.get("safeSearch")).toBe("strict");
    expect(url.searchParams.get("q")).toBe("greetings for beginners");
  });
});
