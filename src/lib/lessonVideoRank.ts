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

/**
 * Channels and titles made for teachers, not learners (owner review of A1,
 * 2026-10-26: "Reading effectively - a 3-stage lesson guide" reached a student).
 */
const TEACHER_CHANNELS = [
  "teaching english with oxford",
  "teachingenglish",
  "cambridge english teacher",
];
const TEACHER_TITLE =
  /\b(for teachers|lesson plans?|lesson guide|teaching tips|how to teach|esl teachers?|tefl|celta)\b/;

/** Series pitched above beginners (6 Minute English is B1-B2). */
const ABOVE_BEGINNER_TITLE = /\b6 minute english\b/;

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
  // Generic words of lesson titles and objectives (owner review of A1,
  // 2026-10-26: "Describing", "People" and "Writing" matched videos about the
  // weather, health and fiction writing).
  "listening",
  "listen",
  "hearing",
  "reading",
  "talking",
  "talk",
  "talks",
  "speaking",
  "writing",
  "describing",
  "describe",
  "description",
  "descriptions",
  "people",
  "words",
  "simple",
  "short",
  "everyday",
  "giving",
  "making",
  "telling",
  "using",
  "practice",
  "beginner",
  "beginners",
  "understand",
  "catch",
  "details",
  "find",
  "correct",
  "correctly",
  "common",
  "core",
  "key",
  "clear",
  "clearly",
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

/** The title's words, or the objective's when the title has only generic ones ("Describing Your Day"). */
export function lessonKeywords(topic: string, objective = ""): string[] {
  const fromTitle = topicKeywords(topic);
  return fromTitle.length > 0 ? fromTitle : topicKeywords(objective);
}

export function isTrustedChannel(channel: string): boolean {
  const name = normalize(channel).trim();
  return TRUSTED_CHANNELS.some((trusted) => name === trusted || name.startsWith(trusted));
}

/**
 * A word matches the start of a title word, so its other forms match too
 * ("greetings" in "greeting", "introductions" in "introduce"): words of seven
 * letters or more keep about 60% of them (at least six), shorter ones all of
 * them, so "advert" no longer matches "adverbs" (owner review of A2,
 * 2026-10-26: "Adverbs of Frequency" for "Reading a Job Advert"); a final y
 * also matches "ies" ("family" in "families").
 */
function mentions(title: string, word: string): boolean {
  const stem = word.length >= 7 ? word.slice(0, Math.max(6, Math.ceil(word.length * 0.6))) : word;
  const plural = word.endsWith("y") ? `${word.slice(0, -1)}ie` : null;
  return title
    .split(/[^a-z0-9']+/)
    .some((part) => part.startsWith(stem) || (plural !== null && part.startsWith(plural)));
}

function isBeginnerLevel(level: string): boolean {
  return /^a[12]$/i.test(level.trim());
}

/** Never shown: made for teachers, or (A1-A2) off-topic or pitched above beginners. */
export function unsuitableVideo(
  candidate: VideoCandidate,
  keywords: string[],
  level: string,
): boolean {
  const title = normalize(candidate.title);
  const channel = normalize(candidate.channel).trim();
  if (TEACHER_CHANNELS.some((name) => channel.startsWith(name)) || TEACHER_TITLE.test(title))
    return true;
  if (!isBeginnerLevel(level)) return false;
  // A trusted channel is not enough for a beginner: the lesson's topic must be
  // in the title (owner review of A1: "The benefits of doing nothing" for greetings).
  if (keywords.length > 0 && !keywords.some((word) => mentions(title, word))) return true;
  return ABOVE_BEGINNER_TITLE.test(title);
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

/**
 * Best first; candidates with nothing of the lesson and no teaching channel,
 * and the unsuitable ones (unsuitableVideo), are dropped.
 */
export function rankVideoCandidates(
  results: VideoCandidate[],
  topic: string,
  level: string,
  objective = "",
): VideoCandidate[] {
  const keywords = lessonKeywords(topic, objective);
  return results
    .filter((candidate) => !unsuitableVideo(candidate, keywords, level))
    .map((candidate, rank) => ({ candidate, score: scoreVideo(candidate, rank, keywords, level) }))
    .filter((entry) => entry.score > -5)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.candidate);
}
