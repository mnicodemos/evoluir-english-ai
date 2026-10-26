/**
 * Picks a YouTube lesson video that matches the lesson topic, lasts at most
 * 7 minutes and has closed captions. It searches YouTube through the official
 * Data API when YOUTUBE_API_KEY is set (youtubeApi.ts), else the results page,
 * with the captions filter, ranks the results by relevance (rankVideoCandidates) and, from B1,
 * falls back to a curated pool per skill. A1-A2 get no video rather than a
 * pool one (owner review, 2026-10-26: the pool's B1-B2 videos reached A1
 * lessons on other topics). A video the owner approved in Admin → Vídeos
 * (lesson_videos) always wins over both (pickVideo).
 */
import { rankVideoCandidates, type VideoCandidate } from "./lessonVideoRank";
import {
  apiSearchUrl,
  apiVideosUrl,
  candidatesFromApi,
  type ApiSearchResponse,
  type ApiVideosResponse,
} from "./youtubeApi";

export type LessonVideo = { url: string; seconds: number };

/** Curriculum lessons only use videos up to 7 minutes long. */
export const MAX_VIDEO_SECONDS = 7 * 60;
const MIN_VIDEO_SECONDS = 90;

/** YouTube search filter: subtitles/CC only. */
const CC_FILTER = "EgIoAQ%3D%3D";

/** Hand-checked videos with captions, used when the live search is unavailable. */
/** Pool videos taken out after the owner's review (2026-10-26), still on older lessons. */
const RETIRED_POOL_URLS = ["https://www.youtube.com/watch?v=xh8M_x57pa4"];

/** Every pool URL, so a pool video is never reused as a lesson's found video. */
export function isPoolVideo(url: string): boolean {
  return (
    RETIRED_POOL_URLS.includes(url) ||
    Object.values(fallbackPool).some((list) => list.some((video) => video.url === url))
  );
}

export const fallbackPool: Record<string, LessonVideo[]> = {
  listening: [
    { url: "https://www.youtube.com/watch?v=Y681hXWwhQY", seconds: 380 },
    { url: "https://www.youtube.com/watch?v=sdVSJIk3eA0", seconds: 298 },
    { url: "https://www.youtube.com/watch?v=igIoTbHxo8k", seconds: 229 },
    { url: "https://www.youtube.com/watch?v=tAdO5O1kSRE", seconds: 379 },
  ],
  reading: [
    { url: "https://www.youtube.com/watch?v=LbO3lRXT0ww", seconds: 186 },
    { url: "https://www.youtube.com/watch?v=4swFGRhQoMI", seconds: 314 },
    { url: "https://www.youtube.com/watch?v=A419UZ5nD0w", seconds: 221 },
  ],
  talking: [
    { url: "https://www.youtube.com/watch?v=BB7PJl3souA", seconds: 269 },
    { url: "https://www.youtube.com/watch?v=SXdYRJ11zoI", seconds: 336 },
    { url: "https://www.youtube.com/watch?v=Zb-vT3UsIL4", seconds: 229 },
    { url: "https://www.youtube.com/watch?v=aA8sgiw-8jA", seconds: 240 },
  ],
  writing: [
    { url: "https://www.youtube.com/watch?v=3-QoPcJHQws", seconds: 175 },
    { url: "https://www.youtube.com/watch?v=1X2LwclN878", seconds: 321 },
    { url: "https://www.youtube.com/watch?v=fSHQ-oi3pDc", seconds: 292 },
    { url: "https://www.youtube.com/watch?v=u95vIYwzc20", seconds: 214 },
  ],
  vocabulary: [
    { url: "https://www.youtube.com/watch?v=Q7HBdzgvmIs", seconds: 300 },
    { url: "https://www.youtube.com/watch?v=nh8r9SDmHn4", seconds: 150 },
    { url: "https://www.youtube.com/watch?v=CLFTOxoEMu8", seconds: 358 },
    { url: "https://www.youtube.com/watch?v=6FBk6t_-0_Q", seconds: 295 },
  ],
  grammar: [
    { url: "https://www.youtube.com/watch?v=553eeL1Dvho", seconds: 356 },
    { url: "https://www.youtube.com/watch?v=XySNOXSiBMo", seconds: 373 },
    { url: "https://www.youtube.com/watch?v=s59ygVYxpag", seconds: 274 },
    { url: "https://www.youtube.com/watch?v=o-GWYDA4IQY", seconds: 368 },
  ],
};

function toSeconds(text: string): number | null {
  const parts = text.split(":").map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p))) return null;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  return null;
}

function runsText(value: unknown): string {
  const node = value as { runs?: { text?: string }[]; simpleText?: string } | undefined;
  return node?.runs?.map((run) => run.text ?? "").join("") ?? node?.simpleText ?? "";
}

/** Walks the YouTube search payload and collects every video with a duration, title and channel. */
function collect(node: unknown, out: VideoCandidate[]): void {
  if (Array.isArray(node)) {
    node.forEach((item) => collect(item, out));
    return;
  }
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  const id = typeof obj["videoId"] === "string" ? (obj["videoId"] as string) : null;
  const length = (obj["lengthText"] as { simpleText?: string } | undefined)?.simpleText;
  if (id && length) {
    const seconds = toSeconds(length);
    if (seconds && seconds >= MIN_VIDEO_SECONDS && seconds <= MAX_VIDEO_SECONDS)
      out.push({
        id,
        seconds,
        title: runsText(obj["title"]),
        channel: runsText(obj["ownerText"]) || runsText(obj["longBylineText"]),
      });
  }
  Object.values(obj).forEach((value) => collect(value, out));
}

/** Durations the lessons accept, for both search paths. */
function fitsLesson(candidate: VideoCandidate): boolean {
  return candidate.seconds >= MIN_VIDEO_SECONDS && candidate.seconds <= MAX_VIDEO_SECONDS;
}

/** A refused API call (403 quota or a bad key, 400 ...), with its status. */
export class YoutubeApiError extends Error {
  constructor(readonly status: number) {
    super(`YouTube Data API failed: ${status}`);
  }
}

/** The official search: one search (100 units) plus one durations read (1 unit). */
async function searchYoutubeApi(query: string, key: string): Promise<VideoCandidate[]> {
  const search = await fetch(apiSearchUrl(query, key));
  // Thrown, so findLessonVideo logs it and it shows in the Admin.
  if (!search.ok) throw new YoutubeApiError(search.status);
  const found = (await search.json()) as ApiSearchResponse;
  const ids = (found.items ?? []).flatMap((item) => (item.id?.videoId ? [item.id.videoId] : []));
  if (ids.length === 0) return [];
  const details = await fetch(apiVideosUrl(ids, key));
  if (!details.ok) throw new YoutubeApiError(details.status);
  return candidatesFromApi(found, (await details.json()) as ApiVideosResponse).filter(fitsLesson);
}

async function searchYoutube(query: string): Promise<VideoCandidate[]> {
  const key = process.env["YOUTUBE_API_KEY"];
  if (key) return searchYoutubeApi(query, key);
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=${CC_FILTER}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!response.ok) return [];
  const html = await response.text();
  const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!match?.[1]) return [];
  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return [];
  }
  const found: VideoCandidate[] = [];
  collect(data, found);
  const seen = new Set<string>();
  return found.filter((v) => (seen.has(v.id) ? false : seen.add(v.id)));
}

/** The search queries of a lesson, most specific first. */
function lessonQueries(topic: string, skill: string, objectiveText: string, levelCode: string) {
  const level = levelCode.toUpperCase();
  const beginner = level === "A1" || level === "A2";
  const objective = objectiveText.split(/[.,;]/)[0]?.trim() ?? "";
  return [
    `${topic} english lesson ${beginner ? "for beginners" : level}`.trim(),
    objective ? `learn english ${objective} lesson` : "",
    `${skill} english lesson ${topic}`,
  ].filter(Boolean);
}

/**
 * Admin → Vídeos "Buscar vídeos do nível" (owner request, 2026-10-26: every
 * lesson should have its video fixed before the first student opens it): the
 * best API result of at most two queries, or null when none fits. Never the
 * pool. Throws YoutubeApiError (quota, bad key) so the batch stops.
 */
export async function prefillLessonVideo(
  plan: { title: string; level: string; objective: string; skill: string },
  key: string,
): Promise<LessonVideo | null> {
  const topic = `${plan.title} ${plan.level.toUpperCase()}`;
  for (const query of lessonQueries(topic, plan.skill, plan.objective, plan.level).slice(0, 2)) {
    const pick = rankVideoCandidates(
      await searchYoutubeApi(query, key),
      topic,
      plan.level,
      plan.objective,
    )[0];
    if (pick) return { url: `https://www.youtube.com/watch?v=${pick.id}`, seconds: pick.seconds };
  }
  return null;
}

/**
 * Returns a captioned video matching the lesson topic, preferring one that is
 * not already used by another lesson of this student. The queries describe the
 * lesson itself — topic, objective, skill and CEFR level — instead of relying on
 * the title alone, and the most relevant candidate is chosen (the lesson's
 * words in its title, a teaching channel, the search order; length last).
 */
export async function findLessonVideo(
  topic: string,
  skill: string,
  used: Set<string>,
  options: { objective?: string; level?: string } = {},
): Promise<LessonVideo | null> {
  const level = options.level ? options.level.toUpperCase() : "";
  const beginner = level === "A1" || level === "A2";
  const queries = lessonQueries(topic, skill, options.objective ?? "", level);

  let found = 0;
  for (const query of queries) {
    try {
      const raw = await searchYoutube(query);
      found += raw.length;
      const results = rankVideoCandidates(raw, topic, options.level ?? "", options.objective ?? "");
      const fresh = results.find((v) => !used.has(`https://www.youtube.com/watch?v=${v.id}`));
      const pick = fresh ?? results[0];
      if (pick) return { url: `https://www.youtube.com/watch?v=${pick.id}`, seconds: pick.seconds };
    } catch (err) {
      console.error("YouTube lesson video search failed", err);
    }
  }

  // No result at all means YouTube refused the search, not that nothing fits.
  if (found === 0) console.error("YouTube lesson video search returned no results");
  if (beginner) return null;
  const pool = fallbackPool[skill] ?? fallbackPool["grammar"]!;
  const others = Object.entries(fallbackPool)
    .filter(([key]) => key !== skill)
    .flatMap(([, list]) => list);
  return pool.find((v) => !used.has(v.url)) ?? others.find((v) => !used.has(v.url)) ?? pool[0]!;
}
