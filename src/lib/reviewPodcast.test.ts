import { describe, expect, it } from "vitest";

import { findCurriculumLesson } from "./curriculum";
import {
  afterPodcastLine,
  diagnoseReviewPodcast,
  hasLessonPodcast,
  isChallengeLine,
  lessonPodcastMessages,
  parseReviewPodcast,
  PODCAST_LINE_MAX,
  PODCAST_SPEAKERS,
  podcastLength,
  reviewOutline,
  reviewPodcastMessages,
  shadowPauseMs,
} from "./reviewPodcast";

const line = (
  speaker: "evo" | "leo",
  text = "Hello and welcome to the review. Today we will explore useful English examples, practise clear expressions, and connect each idea to everyday conversations so learners can speak with confidence.",
) => ({
  speaker,
  text,
  pt: "Olá e bem-vindo à revisão.",
});
const episode = (count = 16) => ({
  title: "Review of Units 1 and 2",
  lines: Array.from({ length: count }, (_, i) => line(i % 2 ? "leo" : "evo")),
});

describe("lesson audio dialogue", () => {
  it("enables audio for every non-final lesson and preserves review audio", () => {
    expect(hasLessonPodcast(findCurriculumLesson("b1-u2-l2"))).toBe(true);
    expect(hasLessonPodcast(findCurriculumLesson("b1-u2-l1"))).toBe(true);
    expect(hasLessonPodcast(findCurriculumLesson("b1-u2-l3"))).toBe(true);
    expect(hasLessonPodcast(findCurriculumLesson("a1-u1-l1"))).toBe(true);
    expect(hasLessonPodcast(findCurriculumLesson("a1-u6-l1"))).toBe(true);
    expect(hasLessonPodcast(findCurriculumLesson("b2-u6-l2"))).toBe(true);
    expect(hasLessonPodcast(findCurriculumLesson("a1-u6-l3"))).toBe(false);
    expect(hasLessonPodcast(null)).toBe(false);
  });

  it("asks for the units under review only, the same way every time", () => {
    const plan = findCurriculumLesson("a1-u6-l1")!;
    const outline = reviewOutline(plan);
    expect(outline).toContain("Hearing Greetings and Names");
    expect(outline).not.toContain("Listening to Daily Routines");
    expect(reviewPodcastMessages(plan)).toEqual(reviewPodcastMessages(plan));
    expect(reviewPodcastMessages(plan)[0]!.content).toContain("CEFR A1");
  });

  it("creates a lesson-specific dialogue from the lesson objective", () => {
    const plan = findCurriculumLesson("a1-u1-l1")!;
    const messages = lessonPodcastMessages(plan);
    expect(messages).toEqual(lessonPodcastMessages(plan));
    expect(messages[0]!.content).toContain("CEFR A1");
    expect(messages[1]!.content).toContain(plan.title);
    expect(messages[1]!.content).toContain(plan.objective);
    expect(messages[0]!.content).toContain("real, relaxed conversation");
    expect(messages[0]!.content).toContain("LEO");
    expect(messages[0]!.content).toContain("at least 250 spoken English words");
    expect(messages[0]!.content).toContain("13-17 spoken words per line");
    expect(messages[0]!.content).toContain('"challenge" on the challenge line');
  });

  it("asks for a longer dialogue from B1", () => {
    const plan = findCurriculumLesson("b1-u1-l1")!;
    expect(lessonPodcastMessages(plan)[0]!.content).toContain("Write 30 to 36 lines");
    expect(lessonPodcastMessages(plan)[0]!.content).toContain("at least 500 spoken English words");
    expect(podcastLength("A2")).toEqual({ lines: "16 to 22", words: 250 });
  });

  it("keeps a valid mark and drops an unknown one", () => {
    const lines = Array.from({ length: 12 }, (_, index) => ({
      ...line(index % 2 ? "leo" : "evo"),
      ...(index === 3 ? { mark: "mistake" } : index === 5 ? { mark: "shout" } : {}),
    }));
    const podcast = parseReviewPodcast(JSON.stringify({ title: "A test episode", lines }));
    expect(podcast?.lines[3]?.mark).toBe("mistake");
    expect(podcast?.lines[5]?.mark).toBeUndefined();
  });

  it("finds the challenge line, marked or said in words", () => {
    expect(isChallengeLine({ text: "Tell me about you.", mark: "challenge" })).toBe(true);
    expect(isChallengeLine({ text: "What's your name? Pause and answer out loud." })).toBe(true);
    expect(isChallengeLine({ text: "Let's pause here for a moment." })).toBe(false);
  });

  it("labels EVO and LEO and gives them their own voices", () => {
    expect(PODCAST_SPEAKERS.evo.name).toBe("EVO");
    expect(PODCAST_SPEAKERS.leo.name).toBe("LEO");
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

  it("keeps parseReviewPodcast returning the validated podcast", () => {
    const podcast = {
      title: "Lesson audio",
      lines: Array.from({ length: 36 }, (_, index) => ({
        speaker: index % 2 === 0 ? "evo" : "leo",
        text: "This is a simple spoken sentence for our English lesson today and practice.",
        pt: "Esta é uma frase de exemplo para a aula de inglês.",
      })),
    };
    expect(parseReviewPodcast(JSON.stringify(podcast))).toEqual(podcast);
  });

  it("diagnoses replies without a JSON object without exposing content", () => {
    expect(diagnoseReviewPodcast("No structured response was returned.")).toEqual({
      reason: "no_json_object",
      lineCount: null,
      spokenWordCount: null,
      validationIssues: [],
    });
  });

  it("diagnoses malformed JSON without exposing parser errors or raw response", () => {
    expect(diagnoseReviewPodcast('{"title": broken}')).toEqual({
      reason: "invalid_json",
      lineCount: null,
      spokenWordCount: null,
      validationIssues: [],
    });
  });

  it("reports line and spoken-word counts when the minimum word requirement fails", () => {
    const shortPodcast = {
      title: "Short audio",
      lines: Array.from({ length: 12 }, () => ({
        speaker: "evo",
        text: "Hello there friend today.",
        pt: "Olá, amigo, hoje.",
      })),
    };

    expect(parseReviewPodcast(JSON.stringify(shortPodcast))).toBeNull();
    expect(diagnoseReviewPodcast(JSON.stringify(shortPodcast))).toMatchObject({
      reason: "insufficient_spoken_words",
      lineCount: 12,
      spokenWordCount: 48,
    });
  });

  it("reports schema paths and codes without logging dialogue or translations", () => {
    const invalidPodcast = {
      title: "Lesson audio",
      lines: Array.from({ length: 36 }, (_, index) => ({
        speaker: index === 0 ? "invalid" : index % 2 === 0 ? "evo" : "leo",
        text: "This is a simple spoken sentence for our English lesson today and practice.",
        pt: "Esta é uma frase de exemplo para a aula de inglês.",
      })),
    };

    const diagnostic = diagnoseReviewPodcast(JSON.stringify(invalidPodcast));
    expect(diagnostic.reason).toBe("schema_validation_failed");
    expect(diagnostic.lineCount).toBe(36);
    expect(diagnostic.spokenWordCount).toBeGreaterThanOrEqual(420);
    expect(diagnostic.validationIssues).toContainEqual({
      path: "lines.0.speaker",
      code: "invalid_enum_value",
    });
    expect(JSON.stringify(diagnostic)).not.toContain("simple spoken sentence");
    expect(JSON.stringify(diagnostic)).not.toContain("frase de exemplo");
  });
});

describe("lesson audio pauses", () => {
  it("stops on the challenge for Your turn, unless it is the last line", () => {
    const challenge = { text: "Tell me about you.", mark: "challenge" };
    expect(afterPodcastLine(challenge, true, false)).toEqual({ kind: "turn" });
    expect(afterPodcastLine(challenge, true, true)).toEqual({ kind: "turn" });
    expect(afterPodcastLine(challenge, false, false)).toEqual({ kind: "next" });
  });

  it("pauses about half a second a word in Repeat after mode", () => {
    const line = { text: "I usually get up at seven in the morning, before work." };
    expect(afterPodcastLine(line, true, false)).toEqual({ kind: "next" });
    expect(afterPodcastLine(line, true, true)).toEqual({ kind: "pause", ms: 11 * 450 });
    expect(shadowPauseMs("Hi")).toBe(1_800);
    expect(shadowPauseMs(Array(40).fill("word").join(" "))).toBe(9_000);
  });
});
