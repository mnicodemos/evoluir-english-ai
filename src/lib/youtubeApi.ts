/**
 * YouTube Data API v3 for lesson videos (owner decision, 2026-10-26: the page
 * scraping of youtube.com/results returned nothing from the app's server, so
 * every lesson fell back to the generic pool). One search costs 100 of the
 * free 10,000 daily units, so a lesson's video is searched once and reused by
 * every student of that lesson (pickVideo). Pure parsing here, so it is tested;
 * the requests live in lessonVideo.server.ts.
 */
import type { VideoCandidate } from "./lessonVideoRank";

/** "PT4M30S" → 270; "PT1H2M" → 3720; anything else → null. */
export function parseIsoDuration(text: string): number | null {
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(text.trim());
  if (!match || text.trim() === "P" || text.trim() === "PT") return null;
  const [, d, h, m, s] = match.map((part) => Number(part ?? 0));
  const seconds = d! * 86400 + h! * 3600 + m! * 60 + s!;
  return seconds > 0 ? seconds : null;
}

/** The API returns titles HTML-escaped ("Don&#39;t"). */
export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export type ApiSearchResponse = {
  items?: { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string } }[];
};

export type ApiVideosResponse = {
  items?: { id?: string; contentDetails?: { duration?: string } }[];
};

/** Search order kept; videos without a known duration are dropped. */
export function candidatesFromApi(
  search: ApiSearchResponse,
  videos: ApiVideosResponse,
): VideoCandidate[] {
  const durations = new Map<string, number>();
  for (const item of videos.items ?? []) {
    const seconds = item.id ? parseIsoDuration(item.contentDetails?.duration ?? "") : null;
    if (item.id && seconds) durations.set(item.id, seconds);
  }
  const out: VideoCandidate[] = [];
  for (const item of search.items ?? []) {
    const id = item.id?.videoId;
    const seconds = id ? durations.get(id) : undefined;
    if (!id || !seconds || out.some((video) => video.id === id)) continue;
    out.push({
      id,
      seconds,
      title: decodeEntities(item.snippet?.title ?? ""),
      channel: decodeEntities(item.snippet?.channelTitle ?? ""),
    });
  }
  return out;
}

/** The search request: captioned, safe, English, at most 25 results. */
export function apiSearchUrl(query: string, key: string): string {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    q: query,
    maxResults: "25",
    videoCaption: "closedCaption",
    videoEmbeddable: "true",
    relevanceLanguage: "en",
    safeSearch: "strict",
    key,
  });
  return `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
}

export function apiVideosUrl(ids: string[], key: string): string {
  const params = new URLSearchParams({ part: "contentDetails", id: ids.join(","), key });
  return `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;
}
