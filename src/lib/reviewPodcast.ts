/**
 * Curriculum lesson audio: each lesson opens with an original dialogue between
 * EVO and her co-host LEO instead of a YouTube video. Review I and Review II
 * keep their unit-review scripts; other lessons use their own objective and
 * topic. The script is shared per curriculum lesson in lesson_content_templates,
 * and each line's speech audio is cached for reuse. Pure prompt construction is tested.
 */
import { z } from "zod";

import { getCurriculum, type CurriculumLesson } from "./curriculum";

/** EVO speaks in her usual voice; LEO, the co-host, in a second one. */
export const PODCAST_SPEAKERS = {
  evo: { name: "EVO", voice: "evo" },
  leo: { name: "LEO", voice: "host" },
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
  lines: z
    .array(lineSchema)
    .min(12)
    .max(36)
    .refine(
      (lines) =>
        lines.reduce(
          (total, line) => total + line.text.trim().split(/\s+/).filter(Boolean).length,
          0,
        ) >= 420,
      "The dialogue must contain enough spoken words for at least three minutes of audio.",
    ),
});

export type ReviewPodcast = z.infer<typeof podcastSchema>;
export type PodcastLine = ReviewPodcast["lines"][number];

/** Audio is the learner-facing media experience in Phase 1 for every non-final lesson. */
export function hasReviewPodcast(plan: CurriculumLesson | null | undefined): boolean {
  return !!plan && plan.reviewUnits.length > 0 && !plan.isReviewTest;
}

/** Phase 1: every non-final lesson gets a lesson-specific EVO + LEO dialogue. */
export function hasLessonPodcast(plan: CurriculumLesson | null | undefined): boolean {
  if (!plan || plan.isReviewTest) return false;
  return true;
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
        `Write 30 to 36 lines and at least 450 spoken English words in total; each line at most 60 words and ${PODCAST_LINE_MAX} characters, plain spoken English with no stage directions, emojis or markdown. ` +
        "For every line add 'pt', a natural Brazilian Portuguese translation. " +
        'Reply with JSON only: {"title": "...", "lines": [{"speaker": "evo" | "leo", "text": "...", "pt": "..."}]}',
    },
    {
      role: "user" as const,
      content: `Review lesson: ${plan.title}
Objective: ${plan.objective}
CEFR level: ${plan.level.toUpperCase()}
Units under review:
${reviewOutline(plan)}`,
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
        "and LEO, her co-host (male), who speaks like a learner at the same level. Both have distinct voices; " +
        "never invent personal lives, places or memories for them. " +
        `Level: CEFR ${plan.level.toUpperCase()}. Style: ${style} ` +
        `Target skill: ${plan.skill}. Lesson title: ${plan.title}. Objective: ${plan.objective}. ` +
        "Focus on this lesson's topic and objective. Use examples that teach the objective naturally in conversation; " +
        "do not drift into unrelated topics or teach grammar above the stated CEFR level. " +
        "Make this sound like a real, relaxed conversation, not a lesson script being read aloud. Every reply must connect to the previous line: react to what the other person just said, ask a natural follow-up, or build on an example. " +
        "Use contractions and everyday spoken English where appropriate; vary sentence length and rhythm. Keep turns concise, avoid long mini-lectures, lists, repeated definitions, stiff transitions, and saying the same point twice. " +
        "Let EVO and LEO show curiosity, warmth, light humour where natural, and a distinct personality without forced jokes. Use smooth transitions and callbacks to examples already mentioned. " +
        "Conversation arc: EVO opens briefly with the topic; LEO responds with a believable question or observation; they explore examples together; LEO makes one common, level-appropriate mistake and EVO corrects it kindly in context; they recap naturally and give the listener a short speaking challenge with a model answer; they close warmly and briefly. " +
        "Alternate speakers naturally, with no abrupt topic changes. EVO speaks first. Do not make every turn a question-answer pair or have either speaker narrate the structure of the episode. " +
        `Write 30 to 36 lines and at least 450 spoken English words in total; each line at most 60 words and ${PODCAST_LINE_MAX} characters, plain spoken English with no stage directions, emojis or markdown. ` +
        "For every line add 'pt', a natural Brazilian Portuguese translation. " +
        'Reply with JSON only: {"title": "...", "lines": [{"speaker": "evo" | "leo", "text": "...", "pt": "..."}]}',
    },
    {
      role: "user" as const,
      content: `Lesson: ${plan.title}
Unit: ${plan.unitTitle}
Level: ${plan.level.toUpperCase()}
Skill: ${plan.skill}
Objective: ${plan.objective}
Other lessons in this unit for context only:
${unitOutline}`,
    },
  ];
}

/** The script inside an AI reply (JSON, possibly wrapped in text or a code fence). */
function extractPodcastJson(raw: string): string | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return start < 0 || end <= start ? null : raw.slice(start, end + 1);
}

export function parseReviewPodcast(raw: string): ReviewPodcast | null {
  const json = extractPodcastJson(raw);
  if (!json) return null;
  try {
    const parsed = podcastSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export type PodcastValidationDiagnostic = {
  reason: "no_json_object" | "invalid_json" | "insufficient_spoken_words" | "schema_validation_failed";
  lineCount: number | null;
  spokenWordCount: number | null;
  validationIssues: Array<{ path: string; code: string }>;
};

/**
 * Safe failure diagnostics for server logs. Never returns dialogue, translations,
 * titles, raw model output, or Zod messages that could contain submitted values.
 */
export function diagnoseReviewPodcast(raw: string): PodcastValidationDiagnostic {
  const json = extractPodcastJson(raw);
  if (!json) {
    return {
      reason: "no_json_object",
      lineCount: null,
      spokenWordCount: null,
      validationIssues: [],
    };
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(json);
  } catch {
    return {
      reason: "invalid_json",
      lineCount: null,
      spokenWordCount: null,
      validationIssues: [],
    };
  }

  const record =
    candidate !== null && typeof candidate === "object"
      ? (candidate as Record<string, unknown>)
      : null;
  const lines = Array.isArray(record?.lines) ? record.lines : null;
  const lineCount = lines?.length ?? null;
  const spokenWordCount = lines
    ? lines.reduce((total, line) => {
        if (line === null || typeof line !== "object") return total;
        const text = (line as Record<string, unknown>).text;
        return typeof text === "string"
          ? total + text.trim().split(/\s+/).filter(Boolean).length
          : total;
      }, 0)
    : null;

  const parsed = podcastSchema.safeParse(candidate);
  if (parsed.success) {
    return {
      reason: "schema_validation_failed",
      lineCount,
      spokenWordCount,
      validationIssues: [],
    };
  }

  const validationIssues = parsed.error.issues.map((issue) => ({
    path: issue.path.length ? issue.path.join(".") : "(root)",
    code: issue.code,
  }));
  const insufficientWords = parsed.error.issues.some(
    (issue) => issue.code === "custom" && issue.path.join(".") === "lines",
  );

  return {
    reason: insufficientWords ? "insufficient_spoken_words" : "schema_validation_failed",
    lineCount,
    spokenWordCount,
    validationIssues,
  };
}
