/**
 * Lesson content generation shared by the curriculum server functions: the AI
 * call, video choice, quiz/flashcard schemas with item-by-item salvage, and
 * writeLesson, which stores a generated lesson.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { getCurriculum, type CurriculumLesson } from "@/lib/curriculum";
import { flashcardCount, listenCardCount, quizQuestionCount } from "@/lib/lessonPlanSizing";
import { resolveQuizEvidenceSkill, type QuizEvidenceSkill } from "@/lib/pedagogy/quizSkill";

import { callGateway } from "./ai-gateway.server";
import { hashAiRequest } from "./ai-usage.server";
import { findLessonVideo, type LessonVideo } from "./lessonVideo.server";

export async function callContentAi(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  userId: string,
  operation: "lesson_generation" | "quiz_generation",
  jsonMode = false,
): Promise<string> {
  return callGateway(messages, jsonMode, { userId, operation });
}

/** CEFR descriptors used to keep every generated lesson at the student's exact level. */
export const CEFR: Record<string, string> = {
  a1: "CEFR A1 (beginner): very simple everyday expressions, present simple, basic high-frequency words, short sentences, no idioms.",
  a2: "CEFR A2 (elementary): routine topics, past simple and 'going to', simple connectors, common everyday vocabulary.",
  b1: "CEFR B1 (intermediate): familiar topics, opinions and plans, present perfect, conditionals 0-1, common phrasal verbs.",
  b2: "CEFR B2 (upper-intermediate): abstract topics, argument and nuance, passive voice, conditionals 2-3, natural collocations and idioms.",
  c1: "CEFR C1 (advanced): complex ideas, implicit meaning, advanced idioms, register control, sophisticated linking.",
  c2: "CEFR C2 (proficient): precise, subtle and stylistic language, rare idioms, nuance of connotation and tone.",
};

const SKILL_BRIEF: Record<string, string> = {
  listening:
    "Focus on listening: the script must sound like natural spoken English with a short dialogue the student can shadow.",
  reading:
    "Focus on reading: the script must include a short text plus guidance on how to read it for gist and detail.",
  talking:
    "Focus on speaking: give model sentences, useful phrases and prompts the student can say out loud.",
  writing:
    "Focus on writing: give a model text, a simple structure and sentence patterns the student can copy.",
  vocabulary:
    "Focus on vocabulary: teach a clear word set with meaning, collocation and natural examples.",
  grammar:
    "Focus on grammar: explain the form, the meaning, the common Brazilian-learner mistake and how to fix it.",
};

/** Finds a captioned video (max 7 minutes) on the same topic as the lesson. */
async function pickVideo(
  supabase: SupabaseClient<Database>,
  plan: CurriculumLesson,
): Promise<LessonVideo> {
  const { data } = await supabase.from("lessons").select("video_url").not("video_url", "is", null);
  const used = new Set(((data ?? []) as { video_url: string }[]).map((row) => row.video_url));
  return findLessonVideo(`${plan.title} ${plan.level.toUpperCase()}`, plan.skill, used, {
    objective: plan.objective,
    level: plan.level,
  });
}

export const quizItemSchema = z
  .object({
    question: z.string().trim().min(1).max(400),
    options: z.array(z.string().trim().min(1).max(240)).length(4),
    correct_answer: z.string().trim().min(1).max(240),
    explanation: z.string().trim().min(1).max(400),
    pedagogical_skill: z.string().trim().max(40).optional(),
  })
  .strict()
  .refine(
    (item) => item.options.includes(item.correct_answer),
    "Correct answer must match an option",
  );

export type GeneratedQuizItem = z.infer<typeof quizItemSchema>;

/**
 * Persists generated quiz questions with a server-validated pedagogical skill.
 * The label produced during generation is only accepted when it is one of the
 * skills the evidence pipeline already supports. When it cannot be resolved the
 * failure is recorded through the existing observability mechanism instead of
 * assigning an arbitrary skill.
 */
export async function insertQuizQuestions(
  supabase: SupabaseClient<Database>,
  userId: string,
  lessonId: string,
  quiz: GeneratedQuizItem[],
  structuralDefault: QuizEvidenceSkill | null,
) {
  const rows = quiz.map((q, index) => ({
    lesson_id: lessonId,
    question: String(q.question).slice(0, 400),
    question_type: "multiple_choice",
    options: q.options as string[],
    correct_answer: String(q.correct_answer),
    explanation: String(q.explanation ?? "").slice(0, 400),
    sort_order: index,
    created_by: userId,
    pedagogical_skill: resolveQuizEvidenceSkill(q.pedagogical_skill, structuralDefault),
  }));

  const { error: quizError } = await supabase.from("quizzes").insert(rows);
  if (quizError) throw new Error(quizError.message);

  const unmapped = rows.filter((row) => row.pedagogical_skill === null).length;
  if (unmapped === 0) return;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("record_pedagogical_failure", {
      p_user_id: userId,
      p_source_type: "quiz",
      p_source_id: lessonId,
      p_idempotency_key: `quiz_generation:${lessonId}`,
      p_stage: "source",
      p_error_code: "MISSING_PEDAGOGICAL_MAPPING",
      p_error_message: `${unmapped} generated Quiz question(s) lack a valid pedagogical mapping`,
      p_already_claimed: false,
    });
  } catch {
    console.error("Missing pedagogical mapping could not be recorded for lesson", lessonId);
  }
}

const flashcardSchema = z
  .object({
    word: z.string().trim().min(1).max(120),
    translation: z.string().max(200).default(""),
    definition: z.string().trim().min(1).max(300),
    pronunciation: z.string().max(120).default(""),
    example: z.string().trim().min(1).max(400),
    difficulty: z.enum(["easy", "medium", "hard"]),
    prompt: z.string().trim().min(1).max(240),
    answer: z.string().trim().min(1).max(500),
    card_type: z.enum(["listen", "question"]),
    listen_text: z.string().max(500),
  })
  .strict();

/**
 * The lesson shape the AI must return. The amount of flashcards and questions is
 * decided per lesson by `lessonPlanSizing`, so a simple lesson is not padded and
 * a dense one is fully covered.
 */
function generatedLessonSchema(cardTotal: number, listenTotal: number, quizTotal: number) {
  return z
    .object({
      summary: z.string().trim().min(1).max(3000),
      transcript: z.string().trim().min(1).max(15000),
      transcript_pt: z.string().max(15000),
      flashcards: z
        .array(flashcardSchema)
        .length(cardTotal)
        .refine(
          (cards) => cards.filter((card) => card.card_type === "listen").length === listenTotal,
          `Exactly ${listenTotal} listening cards are required`,
        ),
      quiz: z.array(quizItemSchema).length(quizTotal),
    })
    .strict();
}

const QUIZ_KEYS = ["question", "options", "correct_answer", "explanation", "pedagogical_skill"];
const CARD_KEYS = [
  "word",
  "translation",
  "definition",
  "pronunciation",
  "example",
  "difficulty",
  "prompt",
  "answer",
  "card_type",
  "listen_text",
];

function pickKeys(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  return Object.fromEntries(keys.filter((k) => k in source).map((k) => [k, source[k]]));
}

/** Keeps the individually valid parts of a lesson reply that failed strict validation. */
function salvageLessonContent(value: unknown, cardTotal: number, quizTotal: number) {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const summary = text(source["summary"], 3000);
  const transcript = text(source["transcript"], 15000);
  if (!summary || !transcript) return null;
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  const quiz = list(source["quiz"])
    .map((item) => quizItemSchema.safeParse(pickKeys(item, QUIZ_KEYS)))
    .flatMap((r) => (r.success ? [r.data] : []))
    .slice(0, quizTotal);
  const flashcards = list(source["flashcards"])
    .map((item) => flashcardSchema.safeParse(pickKeys(item, CARD_KEYS)))
    .flatMap((r) => (r.success ? [r.data] : []))
    .slice(0, cardTotal);
  return {
    summary,
    transcript,
    transcript_pt: text(source["transcript_pt"], 15000),
    flashcards,
    quiz,
  };
}

export function jsonValue(raw: string): unknown {
  try {
    return JSON.parse(
      raw
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim(),
    ) as unknown;
  } catch {
    return null;
  }
}

/**
 * The exact request a path lesson is written from, shared by writeLesson and
 * the admin comparison (same prompt, only the Gemini speed differs).
 */
export function lessonGenerationRequest(plan: CurriculumLesson) {
  const descriptor = CEFR[plan.level] ?? CEFR["b1"]!;
  const reviewScope = plan.reviewUnits.length
    ? getCurriculum(plan.level)
        .filter((lesson) => plan.reviewUnits.includes(lesson.unit) && lesson.unit <= 5)
        .map((lesson) => `${lesson.unit}.${lesson.position} ${lesson.title}: ${lesson.objective}`)
        .join("\n")
    : "";
  const quizTotal = quizQuestionCount(plan);
  const cardTotal = flashcardCount(plan);
  const listenTotal = listenCardCount(cardTotal);
  const questionCards = cardTotal - listenTotal;
  const reviewInstructions = plan.isReviewTest
    ? `This is the optional Unit 6 review Test. Build its summary and all ${quizTotal} quiz questions from the supplied Units 1-5 course outline. Cover all five units fairly. Do not introduce new material. The test does not determine CEFR promotion.`
    : plan.reviewUnits.length
      ? `This is a consolidation lesson. Summarize and practise only Units ${plan.reviewUnits.join(" and ")} from the supplied course outline. Connect their main grammar, vocabulary and communication skills without introducing new material.`
      : "";

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    {
      role: "system",
      content:
        `You are a CELTA English teacher writing lesson ${plan.position} of ${plan.unitTitle} in a structured ${plan.level.toUpperCase()} course for a Brazilian learner. ` +
        `${descriptor} ` +
        `${SKILL_BRIEF[plan.skill] ?? ""} ` +
        `${reviewInstructions} ` +
        `Keep EVERY part of the lesson inside ${plan.level.toUpperCase()}: grammar, vocabulary, sentence length and idioms must match this level exactly. ` +
        'Reply with strict JSON: {"summary":"120-180 words explaining the language point with clear examples, in simple English",' +
        '"transcript":"a 450-600 word mini-lesson script in English, written in short paragraphs separated by blank lines",' +
        '"transcript_pt":"a faithful Brazilian Portuguese translation of the script, same paragraph structure",' +
        '"flashcards":[{"card_type":"listen|question","prompt":"front of card, uppercase English instruction or question","answer":"back of card, short English answer","listen_text":"English sentence to hear only on the answer side; empty for non-listen cards","word":"short label from the lesson","definition":"short English-only definition or explanation, no Portuguese","pronunciation":"simple phonetic hint","example":"natural English sentence from or based on this lesson","difficulty":"easy|medium|hard"}],' +
        '"quiz":[{"question":"","options":["4 options"],"correct_answer":"exactly one of the options","explanation":"one short sentence","pedagogical_skill":"grammar or vocabulary - grammar when the item tests form, structure, tense or word order; vocabulary when it tests word choice, collocation, linking expressions or register"}]}. ' +
        `Give exactly ${cardTotal} flashcards and ${quizTotal} quiz questions. ` +
        `Exactly ${listenTotal} flashcards must have card_type 'listen'. For these, the prompt must be a listening question or repeat instruction, the answer must reveal the sentence or phrase, and listen_text must contain that same English audio sentence. ` +
        `The other ${questionCards} flashcards must have card_type 'question'. Randomly vary them between grammar use, meaning, key expressions, sentence completion, and real-life situations from the lesson, without repeating the same format. ` +
        "The flashcards must train recognition and recall of the lesson vocabulary and key expressions; they must NOT repeat the quiz questions or test the same items in the same way. " +
        "Every flashcard must use content from THIS lesson transcript, and every flashcard field must be in English only - never Portuguese, never a translation. " +
        "Every flashcard answer, definition and example must be SHORT: one brief sentence or phrase, maximum 15 words. " +
        `${plan.reviewUnits.length ? "Every quiz question must review content from the supplied previous-unit outline, with balanced grammar, vocabulary and usage." : "EVERY quiz question must test ONLY the grammar point of this lesson (form, structure, tense, word order, correct usage)."} ` +
        "The quiz must check understanding and use, not memorisation: move from recognising the form to applying it in a new sentence, and vary the structure of the questions. " +
        "Never ask about a dialogue, a video, a story, a character, a speaker or anything the student had to watch, listen to or read. " +
        "Each question must be self-contained: a sentence to complete or correct, or a direct grammar rule question.",
    },
    {
      role: "user",
      content: `Lesson title: ${plan.title}\nObjective: ${plan.objective}\nMain skill: ${plan.skill}\nCEFR level: ${plan.level.toUpperCase()}\nUnit: ${plan.unitTitle}${reviewScope ? `\nPrevious-unit course outline:\n${reviewScope}` : ""}`,
    },
  ];
  return { messages, cardTotal, listenTotal, quizTotal, questionCards };
}

/**
 * How a model reply would fare as lesson content: strict validation, and what
 * the item-by-item salvage would keep. Read-only (nothing is saved).
 */
export function checkLessonContent(raw: string, plan: CurriculumLesson) {
  const { cardTotal, listenTotal, quizTotal } = lessonGenerationRequest(plan);
  const value = jsonValue(raw);
  const strict = generatedLessonSchema(cardTotal, listenTotal, quizTotal).safeParse(value);
  const salvaged = strict.success ? null : salvageLessonContent(value, cardTotal, quizTotal);
  return {
    strictValid: strict.success,
    issues: strict.success ? [] : strict.error.issues.slice(0, 5).map((issue) => issue.message),
    expected: { flashcards: cardTotal, quiz: quizTotal },
    salvaged: salvaged
      ? { flashcards: salvaged.flashcards?.length ?? 0, quiz: salvaged.quiz?.length ?? 0 }
      : null,
  };
}

type LessonContent = z.infer<ReturnType<typeof generatedLessonSchema>>;

/**
 * The shared, validated content of one curriculum lesson (migration 0053):
 * written by the AI the first time any student of the level needs it, then
 * copied for everyone else with no AI call. Null when there is none yet or
 * the table is not there (migration not applied): the AI writes it as before.
 */
async function readLessonTemplate(plan: CurriculumLesson, promptHash: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("lesson_content_templates" as never)
      .select("content")
      .eq("curriculum_key" as never, plan.key as never)
      .eq("prompt_hash" as never, promptHash as never)
      .maybeSingle();
    const { cardTotal, listenTotal, quizTotal } = lessonGenerationRequest(plan);
    const parsed = generatedLessonSchema(cardTotal, listenTotal, quizTotal).safeParse(
      (data as { content?: unknown } | null)?.content,
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function saveLessonTemplate(
  plan: CurriculumLesson,
  promptHash: string,
  content: LessonContent,
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("lesson_content_templates" as never)
      .upsert({ curriculum_key: plan.key, prompt_hash: promptHash, content } as never, {
        onConflict: "curriculum_key,prompt_hash",
        ignoreDuplicates: true,
      });
  } catch {
    /* sharing is an optimisation: the student's own lesson is already saved */
  }
}

/**
 * The lesson's content: the shared copy when one exists, otherwise written by
 * the AI (no "thinking" step, which only added wait and cost to this
 * structured reply). Only a reply that passes strict validation becomes the
 * shared copy; a salvaged one serves this student alone.
 */
async function lessonContentFor(plan: CurriculumLesson, userId: string): Promise<LessonContent> {
  const { messages, cardTotal, listenTotal, quizTotal } = lessonGenerationRequest(plan);
  const promptHash = await hashAiRequest({ messages, jsonMode: true });
  const shared = await readLessonTemplate(plan, promptHash);
  if (shared) return shared;

  let raw: string;
  try {
    raw = await callGateway(messages, true, {
      userId,
      operation: "lesson_generation",
      fast: true,
    });
  } catch (error) {
    // The background preparation of this very lesson may be running (one AI
    // call at a time per student): wait for its shared copy instead of failing.
    const code = (error as { code?: string } | null)?.code;
    if (code !== "concurrent_limit" && code !== "rate_limit") throw error;
    for (let waited = 0; waited < 60_000; waited += 3_000) {
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      const ready = await readLessonTemplate(plan, promptHash);
      if (ready) return ready;
    }
    throw error;
  }
  const rawValue = jsonValue(raw);
  const parsedContent = generatedLessonSchema(cardTotal, listenTotal, quizTotal).safeParse(
    rawValue,
  );
  if (parsedContent.success) {
    await saveLessonTemplate(plan, promptHash, parsedContent.data);
    return parsedContent.data;
  }
  // One imperfect item (an extra field, a wrong count, an answer that does not
  // match its options) must not throw the whole lesson away: keep every item
  // that is valid on its own, and only fail when too few remain.
  console.error(
    "Lesson content failed strict validation",
    plan.key,
    parsedContent.error.issues.slice(0, 5),
  );
  const salvaged = salvageLessonContent(rawValue, cardTotal, quizTotal);
  const minimumQuiz = plan.isReviewTest
    ? quizTotal
    : Math.min(quizTotal, Math.max(5, Math.ceil(quizTotal * 0.7)));
  if (!salvaged || salvaged.quiz.length < minimumQuiz) {
    throw new Error("The AI could not write this lesson. Please try again.");
  }
  return salvaged;
}

/**
 * Prepares a lesson's shared content in the background (the next lesson of
 * the path, while the student studies the current one), so opening it later
 * needs no AI wait. Never throws.
 */
export async function prepareLessonContent(plan: CurriculumLesson, userId: string) {
  try {
    await lessonContentFor(plan, userId);
  } catch (error) {
    console.warn("Preparing the next lesson failed", plan.key, error);
  }
}

export async function writeLesson(
  supabase: SupabaseClient<Database>,
  userId: string,
  plan: CurriculumLesson,
  /** Lesson saved earlier whose cards/quiz never arrived: only fill those in. */
  repairLessonId?: string,
): Promise<string> {
  const { listenTotal, quizTotal, questionCards } = lessonGenerationRequest(plan);
  const content = await lessonContentFor(plan, userId);

  if (!plan.isReviewTest) {
    const usable = (content.quiz ?? []).filter(
      (q) => q.question && Array.isArray(q.options) && q.options.length > 1 && q.correct_answer,
    );
    if (!usable.length) throw new Error("The AI could not write this lesson. Please try again.");
  }

  let lesson: { id: string } | null = repairLessonId ? { id: repairLessonId } : null;
  if (!lesson) {
    const video = await pickVideo(supabase, plan);
    const inserted = await supabase
      .from("lessons")
      .insert({
        title: plan.title,
        category: plan.category,
        level: plan.level,
        objective: plan.objective,
        summary: content.summary,
        transcript: content.transcript,
        transcript_pt: content.transcript_pt ?? "",
        video_url: video.url,
        video_duration_seconds: video.seconds,
        sort_order: plan.index,
        curriculum_key: plan.key,
        unit_number: plan.unit,
        position_in_unit: plan.position,
        skill: plan.skill,
        created_by: userId,
        generated: true,
      })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) {
      throw new Error(inserted.error?.message ?? "Could not save this lesson.");
    }
    lesson = { id: inserted.data.id as string };
  }

  const generatedCards = (content.flashcards ?? []).filter(
    (c) => c.word && (c.answer || c.definition || c.example),
  );
  const listenCards = generatedCards
    .filter((card) => card.card_type === "listen")
    .slice(0, listenTotal);
  const variedCards = generatedCards
    .filter((card) => card.card_type !== "listen")
    .slice(0, questionCards);
  const cards = [...listenCards, ...variedCards]
    .map((card) => ({ card, random: Math.random() }))
    .sort((a, b) => a.random - b.random)
    .map(({ card }) => card);
  // A repaired lesson keeps any flashcards that were already saved (no duplicates).
  const existingCards = repairLessonId
    ? ((
        await supabase
          .from("flashcards")
          .select("id", { count: "exact", head: true })
          .eq("lesson_id", repairLessonId)
      ).count ?? 0)
    : 0;
  if (cards.length && !existingCards) {
    await supabase.from("flashcards").insert(
      cards.map((c, index) => ({
        lesson_id: lesson.id,
        word: String(c.word).slice(0, 120),
        translation: String(c.translation ?? "").slice(0, 200),
        definition: String(c.definition ?? c.example ?? "").slice(0, 300),
        pronunciation: String(c.pronunciation ?? "").slice(0, 120),
        example: String(c.example ?? "").slice(0, 400),
        prompt: String(c.prompt ?? c.word ?? "").slice(0, 240),
        answer: String(c.answer ?? c.definition ?? c.example ?? "").slice(0, 500),
        card_type: c.card_type === "listen" ? "listen" : "question",
        listen_text: String(
          c.card_type === "listen" ? c.listen_text || c.answer || c.example || c.word || "" : "",
        ).slice(0, 500),
        sort_order: index,
        difficulty: ["easy", "medium", "hard"].includes(String(c.difficulty))
          ? String(c.difficulty)
          : "medium",
        created_by: userId,
      })),
    );
  }

  const quiz = (content.quiz ?? [])
    .slice(0, quizTotal)
    .filter(
      (q) => q.question && Array.isArray(q.options) && q.options.length > 1 && q.correct_answer,
    );
  if (plan.isReviewTest && quiz.length !== quizTotal) {
    throw new Error(`The AI could not write all ${quizTotal} review questions. Please try again.`);
  }
  if (quiz.length) {
    // Non-review lesson quizzes are constrained by the prompt to the lesson's
    // grammar point, so grammar is a structural default rather than a guess.
    await insertQuizQuestions(
      supabase,
      userId,
      lesson.id as string,
      quiz,
      plan.reviewUnits.length || plan.isReviewTest ? null : "grammar",
    );
  }

  return lesson.id as string;
}

/**
 * Opens one lesson of the fixed curriculum. The lesson only unlocks when the
 * previous one of the same level is finished; the content is written by the AI
 * the first time the student opens it and reused afterwards.
 */
