/**
 * Review podcasts (owner request, 2026-10-26): the review lessons of each
 * level (Unit 6, "Review I" and "Review II") open with a short podcast, a
 * conversation between EVO and her co-host Leo about the units under review,
 * instead of a YouTube video. The script is written by the AI once per
 * lesson and level and shared (lesson_content_templates, its own prompt
 * hash), and each line's audio is cached for everyone, so every student of
 * that lesson hears the same episode at no further cost. Pure, so it is tested.
 */
import { z } from "zod";

import { getCurriculum, type CurriculumLesson } from "./curriculum";

/** EVO speaks in her usual voice; Leo, the co-host, in a second one. */
export const PODCAST_SPEAKERS = {
  evo: { name: "EVO", voice: "evo" },
  leo: { name: "Leo", voice: "host" },
} as const;

export type PodcastSpeaker = keyof typeof PODCAST_SPEAKERS;

/** Each line is spoken in one audio request (the voice route takes 500 characters). */
export const PODCAST_LINE_MAX = 420;

const lineSchema = z.object({
  speaker: z.enum(["evo", "leo"]),
  text: z.string().trim().min(1).max(PODCAST_LINE_MAX),
  pt: z.string().trim().min(1).max(700),
});

export const podcastSchema = z.object({
  title: z.string().trim().min(3).max(120),
  lines: z.array(lineSchema).min(12).max(30),
});

export type ReviewPodcast = z.infer<typeof podcastSchema>;
export type PodcastLine = ReviewPodcast["lines"][number];

/** Every curriculum lesson uses an EVO + Leo audio dialogue except the review test. */
export function hasLessonPodcast(plan: CurriculumLesson | null | undefined): boolean {
  return !!plan && !plan.isReviewTest;
}

/** How the conversation sounds at each level. */
const LEVEL_STYLE: Record<string, string> = {
  a1: "Very short, simple sentences (6-10 words), present simple, the most common words. Leo is a beginner who asks simple questions; EVO answers with one clear example each time.",
  a2: "Short, simple sentences (8-12 words), past simple and going to where the units use them. Leo is an elementary learner; EVO explains with short examples.",
  b1: "Natural, friendly sentences (10-16 words), everyday connectors. Leo shares opinions and small mistakes; EVO corrects them kindly with examples.",
  b2: "Natural conversation with some nuance (12-20 words), phrasal verbs and collocations from the units. Leo pushes back a little; EVO explains the difference between similar forms.",
  c1: "Fluent, idiomatic conversation (15-25 words) with precise vocabulary and register from the units. Both hosts discuss subtle points and give contrasting examples.",
  c2: "Sophisticated, natural conversation (15-28 words) with nuance, irony and idiom where the units allow. Both hosts analyse fine distinctions of meaning and register.",
};

/** The units under review, as in the review lesson's own prompt. */
export function reviewOutline(plan: CurriculumLesson): string {
  return getCurriculum(plan.level)
    .filter((lesson) => plan.reviewUnits.includes(lesson.unit) && lesson.unit <= 5)
    .map((lesson) => `- ${lesson.unitTitle} · ${lesson.title}: ${lesson.objective}`)
    .join("\n");
}

/** The request for one review lesson's script (deterministic, so it is shared). */
export function reviewPodcastMessages(plan: CurriculumLesson) {
  const level = plan.level.toLowerCase();
  const style = LEVEL_STYLE[level] ?? LEVEL_STYLE["b1"]!;
  return [
    {
      role: "system" as const,
      content:
        "You write short review podcasts for Evoluir+, an English course for Brazilian learners. " +
        "The podcast is a warm, lively conversation between two hosts: EVO, the course's AI English mentor (female), " +
        "and Leo, her co-host (male), who speaks like a learner at the same level. Both are presented as hosts of the show; " +
        "never invent personal lives, places or memories for them. " +
        `Level: CEFR ${plan.level.toUpperCase()}. Style: ${style} ` +
        "Structure: 1) EVO welcomes the listener and says which units they will review; " +
        "2) the main grammar points of those units, each with one or two example sentences; " +
        "3) the most useful vocabulary and expressions, used in sentences; " +
        "4) one common mistake Brazilian learners make with this content, said wrong by Leo and corrected by EVO; " +
        "5) a quick challenge: EVO asks the listener a question, says 'Pause and answer out loud', then gives a model answer; " +
        "6) a short goodbye that invites the listener to the lesson's quiz. " +
        "Only review what the outline covers: no new grammar. Alternate the speakers naturally, EVO speaks first. " +
        `Write 16 to 24 lines; each line at most 60 words and ${PODCAST_LINE_MAX} characters, plain spoken English with no stage directions, emojis or markdown. ` +
        "For every line add 'pt', a natural Brazilian Portuguese translation. " +
        'Reply with JSON only: {"title": "...", "lines": [{"speaker": "evo" | "leo", "text": "...", "pt": "..."}]}',
    },
    {
      role: "user" as const,
      content: `Review lesson: ${plan.title}\nObjective: ${plan.objective}\nCEFR level: ${plan.level.toUpperCase()}\nUnits under review:\n${reviewOutline(plan)}`,
    },
  ];
}

/** A lesson-specific dialogue; review lessons keep their existing, detailed script. */
export function lessonPodcastMessages(plan: CurriculumLesson) {
  if (plan.reviewUnits.length > 0) return reviewPodcastMessages(plan);

  const level = plan.level.toLowerCase();
  const style = LEVEL_STYLE[level] ?? LEVEL_STYLE["b1"]!;
  const unitOutline = getCurriculum(plan.level)
    .filter((lesson) => lesson.unit === plan.unit && lesson.reviewUnits.length === 0)
    .map((lesson) => `- ${lesson.title} (${lesson.skill}): ${lesson.objective}`)
    .join("\n");

  return [
    {
      role: "system" as const,
      content:
        "You write original audio dialogues for Evoluir+, an English course for Brazilian learners. " +
        "The episode is a warm, lively conversation between EVO, the course's AI English mentor (female), " +
        "and Leo, her co-host (male), who speaks like a learner at the same level. Both have distinct voices; " +
        "never invent personal lives, places or memories for them. " +
        `Level: CEFR ${plan.level.toUpperCase()}. Style: ${style} ` +
        `Target skill: ${plan.skill}. Lesson title: ${plan.title}. Objective: ${plan.objective}. ` +
        "Focus on this lesson's topic and objective. Use examples that teach the objective naturally in conversation; " +
        "do not drift into unrelated topics or teach grammar above the stated CEFR level. " +
        "Structure: EVO welcomes the listener and introduces the topic; Leo asks realistic learner questions; " +
        "they model useful language in context; Leo makes one common, level-appropriate mistake and EVO corrects it kindly; " +
        "they give the listener a short speaking challenge with a model answer; they close by inviting the listener to practise. " +
        "Alternate the speakers naturally, EVO speaks first. " +
        `Write 16 to 24 lines; each line at most 60 words and ${PODCAST_LINE_MAX} characters, plain spoken English with no stage directions, emojis or markdown. ` +
        "For every line add 'pt', a natural Brazilian Portuguese translation. " +
        'Reply with JSON only: {"title": "...", "lines": [{"speaker": "evo" | "leo", "text": "...", "pt": "..."}]}',
    },
    {
      role: "user" as const,
      content:
        `Lesson: ${plan.title}\nUnit: ${plan.unitTitle}\nLevel: ${plan.level.toUpperCase()}\nSkill: ${plan.skill}\nObjective: ${plan.objective}\nOther lessons in this unit for context only:\n${unitOutline}`,
    },
  ];
}

/** The script inside an AI reply (JSON, possibly wrapped in text or a code fence). */
export function parseReviewPodcast(raw: string): ReviewPodcast | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = podcastSchema.safeParse(JSON.parse(raw.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
