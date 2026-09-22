/**
 * Picks a YouTube lesson video that matches the lesson topic, lasts at most
 * 7 minutes and has closed captions. It searches YouTube with the captions
 * filter and falls back to a curated, hand-checked pool per skill.
 */

export type LessonVideo = { url: string; seconds: number };

/** Curriculum lessons only use videos up to 7 minutes long. */
export const MAX_VIDEO_SECONDS = 7 * 60;
const MIN_VIDEO_SECONDS = 90;

/** YouTube search filter: subtitles/CC only. */
const CC_FILTER = "EgIoAQ%3D%3D";

/** Hand-checked videos with captions, used when the live search is unavailable. */
export const fallbackPool: Record<string, LessonVideo[]> = {
  listening: [
    { url: "https://www.youtube.com/watch?v=Y681hXWwhQY", seconds: 380 },
    { url: "https://www.youtube.com/watch?v=sdVSJIk3eA0", seconds: 298 },
    { url: "https://www.youtube.com/watch?v=igIoTbHxo8k", seconds: 229 },
    { url: "https://www.youtube.com/watch?v=tAdO5O1kSRE", seconds: 379 },
  ],
  reading: [
    { url: "https://www.youtube.com/watch?v=xh8M_x57pa4", seconds: 270 },
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

/** Walks the YouTube search payload and collects every video with a duration. */
function collect(node: unknown, out: { id: string; seconds: number }[]): void {
  if (Array.isArray(node)) {
    node.forEach((item) => collect(item, out));
    return;
  }
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, any>;
  const id = typeof obj["videoId"] === "string" ? (obj["videoId"] as string) : null;
  const length = obj["lengthText"]?.simpleText as string | undefined;
  if (id && length) {
    const seconds = toSeconds(length);
    if (seconds && seconds >= MIN_VIDEO_SECONDS && seconds <= MAX_VIDEO_SECONDS) out.push({ id, seconds });
  }
  Object.values(obj).forEach((value) => collect(value, out));
}

async function searchYoutube(query: string): Promise<{ id: string; seconds: number }[]> {
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
  const found: { id: string; seconds: number }[] = [];
  collect(data, found);
  const seen = new Set<string>();
  return found.filter((v) => (seen.has(v.id) ? false : seen.add(v.id)));
}

/** A lesson video is easiest to follow between 2½ and 6 minutes. */
const IDEAL_SECONDS = 300;

/** Closest to the ideal teaching length wins, so 20-second clips never do. */
function bestByLength(results: { id: string; seconds: number }[]) {
  return [...results].sort(
    (a, b) => Math.abs(a.seconds - IDEAL_SECONDS) - Math.abs(b.seconds - IDEAL_SECONDS),
  );
}

/**
 * Returns a captioned video matching the lesson topic, preferring one that is
 * not already used by another lesson of this student. The queries describe the
 * lesson itself — topic, objective, skill and CEFR level — instead of relying on
 * the title alone, and the candidate closest to a teaching length is chosen.
 */
export async function findLessonVideo(
  topic: string,
  skill: string,
  used: Set<string>,
  options: { objective?: string; level?: string } = {},
): Promise<LessonVideo> {
  const level = options.level ? options.level.toUpperCase() : "";
  const objective = (options.objective ?? "").split(/[.,;]/)[0]?.trim() ?? "";
  const queries = [
    `${topic} english lesson ${level}`.trim(),
    objective ? `learn english ${objective} lesson` : "",
    `${skill} english lesson ${topic}`,
  ].filter(Boolean);

  for (const query of queries) {
    try {
      const results = bestByLength(await searchYoutube(query));
      const fresh = results.find((v) => !used.has(`https://www.youtube.com/watch?v=${v.id}`));
      const pick = fresh ?? results[0];
      if (pick) return { url: `https://www.youtube.com/watch?v=${pick.id}`, seconds: pick.seconds };
    } catch (err) {
      console.error("YouTube lesson video search failed", err);
    }
  }

  const pool = fallbackPool[skill] ?? fallbackPool["grammar"]!;
  const others = Object.entries(fallbackPool)
    .filter(([key]) => key !== skill)
    .flatMap(([, list]) => list);
  return pool.find((v) => !used.has(v.url)) ?? others.find((v) => !used.has(v.url)) ?? pool[0]!;
}
