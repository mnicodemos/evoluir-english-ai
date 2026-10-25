/**
 * Ranks YouTube search results for a lesson (audit, 2026-10-25: the closest
 * to 5 minutes used to win, so result 15, unrelated to the lesson, could beat
 * the first one). Relevance comes first: the lesson's own words in the video
 * title, a known English-teaching channel and the search's own order; the
 * length only breaks near-ties. Pure, so it is tested.
 */

export type VideoCandidate = {
  id: string;
  seconds: number;
  title: string;
  channel: string;
};

/** Channels that publish English lessons for learners, with captions. */
export const TRUSTED_CHANNELS = [
  "bbc learning english",
  "english with lucy",
  "mmmenglish",
  "engvid",
  "rachel's english",
  "learn english with emmaspeaks",
  "english addict with mr steve",
  "speak english with vanessa",
  "learn english with tv series",
  "british council learnenglish",
  "learn english with esl kids",
  "english with emma",
  "learn english with rebecca",
  "linguamarina",
  "englishclass101.com",
  "learn english with papa teach me",
  "oxford online english",
  "english speaking success",
  "bob the canadian",
  "simple english videos",
];

const STOPWORDS = new Set([
  "english",
  "lesson",
  "lessons",
  "learn",
  "with",
  "your",
  "about",
  "from",
  "into",
  "unit",
  "review",
  "that",
  "this",
  "them",
  "what",
  "when",
  "where",
  "which",
  "their",
  "basic",
]);

const LEVEL_WORDS: Record<string, string[]> = {
  a1: ["a1", "beginner", "beginners", "basic"],
  a2: ["a2", "beginner", "elementary", "basic"],
  b1: ["b1", "intermediate", "pre-intermediate"],
  b2: ["b2", "intermediate", "upper-intermediate", "upper intermediate"],
  c1: ["c1", "advanced"],
  c2: ["c2", "advanced", "proficiency"],
};

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** The lesson title's meaningful words (no level codes, no filler). */
export function topicKeywords(topic: string): string[] {
  const words = normalize(topic)
    .split(/[^a-z0-9']+/)
    .map((word) => word.replace(/'s$/, ""))
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word) && !/^[abc][12]$/.test(word));
  return [...new Set(words)];
}

export function isTrustedChannel(channel: string): boolean {
  const name = normalize(channel).trim();
  return TRUSTED_CHANNELS.some((trusted) => name === trusted || name.startsWith(trusted));
}

/** A word matches its plural or "-ing" form too ("greeting" in "greetings"). */
function mentions(title: string, word: string): boolean {
  const stem = word.length > 5 ? word.slice(0, -1) : word;
  return title.includes(stem);
}

export function scoreVideo(
  candidate: VideoCandidate,
  rank: number,
  keywords: string[],
  level: string,
): number {
  const title = normalize(candidate.title);
  const hits = keywords.filter((word) => mentions(title, word)).length;
  const trusted = isTrustedChannel(candidate.channel);
  const levelHit = (LEVEL_WORDS[level.toLowerCase()] ?? []).some((word) => title.includes(word));
  // Nothing of the lesson in the title and no teaching channel: almost never.
  const relevance = hits === 0 && !trusted ? -10 : 0;
  return (
    hits * 3 +
    (trusted ? 4 : 0) +
    (levelHit ? 2 : 0) +
    relevance -
    rank * 0.4 -
    Math.abs(candidate.seconds - 300) / 300
  );
}

/** Best first; candidates with nothing of the lesson and no teaching channel are dropped. */
export function rankVideoCandidates(
  results: VideoCandidate[],
  topic: string,
  level: string,
): VideoCandidate[] {
  const keywords = topicKeywords(topic);
  return results
    .map((candidate, rank) => ({ candidate, score: scoreVideo(candidate, rank, keywords, level) }))
    .filter((entry) => entry.score > -5)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.candidate);
}
