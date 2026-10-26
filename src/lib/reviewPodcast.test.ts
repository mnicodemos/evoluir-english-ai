import { describe, expect, it } from "vitest";

import { findCurriculumLesson } from "./curriculum";
import {
  hasReviewPodcast,
  parseReviewPodcast,
  PODCAST_LINE_MAX,
  PODCAST_SPEAKERS,
  reviewOutline,
  reviewPodcastMessages,
} from "./reviewPodcast";

const line = (speaker: "evo" | "leo", text = "Hello and welcome to the review.") => ({
  speaker,
  text,
  pt: "Olá e bem-vindo à revisão.",
});
const episode = (count = 16) => ({
  title: "Review of Units 1 and 2",
  lines: Array.from({ length: count }, (_, i) => line(i % 2 ? "leo" : "evo")),
});

describe("review podcast", () => {
  it("belongs to the two review lessons, never the review Test or a core lesson", () => {
    expect(hasReviewPodcast(findCurriculumLesson("a1-u6-l1"))).toBe(true);
    expect(hasReviewPodcast(findCurriculumLesson("b2-u6-l2"))).toBe(true);
    expect(hasReviewPodcast(findCurriculumLesson("a1-u6-l3"))).toBe(false);
    expect(hasReviewPodcast(findCurriculumLesson("a1-u1-l1"))).toBe(false);
    expect(hasReviewPodcast(null)).toBe(false);
  });

  it("asks for the units under review only, the same way every time", () => {
    const plan = findCurriculumLesson("a1-u6-l1")!;
    const outline = reviewOutline(plan);
    expect(outline).toContain("Hearing Greetings and Names");
    expect(outline).not.toContain("Listening to Daily Routines");
    expect(reviewPodcastMessages(plan)).toEqual(reviewPodcastMessages(plan));
    expect(reviewPodcastMessages(plan)[0]!.content).toContain("CEFR A1");
  });

  it("gives EVO and Leo their own voices", () => {
    expect(PODCAST_SPEAKERS.evo.voice).toBe("evo");
    expect(PODCAST_SPEAKERS.leo.voice).toBe("host");
  });

  it("reads a script wrapped in text or a code fence", () => {
    const raw = "```json\n" + JSON.stringify(episode()) + "\n```";
    expect(parseReviewPodcast(raw)?.lines).toHaveLength(16);
  });

  it("refuses scripts too short, too long or with lines the voice cannot say at once", () => {
    expect(parseReviewPodcast(JSON.stringify(episode(5)))).toBeNull();
    expect(parseReviewPodcast(JSON.stringify(episode(40)))).toBeNull();
    const long = episode();
    long.lines[3] = line("leo", "x".repeat(PODCAST_LINE_MAX + 1));
    expect(parseReviewPodcast(JSON.stringify(long))).toBeNull();
    expect(parseReviewPodcast("no json here")).toBeNull();
  });
});
