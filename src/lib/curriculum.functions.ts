import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  finalTestKey,
  findCurriculumLesson,
  getCoreCurriculum,
  getCurriculum,
  normalizeLevel,
  type CurriculumLesson,
} from "@/lib/curriculum";
import { resolveQuizEvidenceSkill, type QuizEvidenceSkill } from "@/lib/pedagogy/quizSkill";

import { callGateway } from "./ai-gateway.server";
import { findLessonVideo, type LessonVideo } from "./lessonVideo.server";

async function callContentAi(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  userId: string,
  operation: "lesson_generation" | "quiz_generation",
  jsonMode = false,
): Promise<string> {
  return callGateway(messages, jsonMode, { userId, operation });
}

/** CEFR descriptors used to keep every generated lesson at the student's exact level. */
const CEFR: Record<string, string> = {
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
  return findLessonVideo(`${plan.title} ${plan.level.toUpperCase()}`, plan.skill, used);
}

const quizItemSchema = z
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

type GeneratedQuizItem = z.infer<typeof quizItemSchema>;

/**
 * Persists generated quiz questions with a server-validated pedagogical skill.
 * The label produced during generation is only accepted when it is one of the
 * skills the evidence pipeline already supports. When it cannot be resolved the
 * failure is recorded through the existing observability mechanism instead of
 * assigning an arbitrary skill.
 */
async function insertQuizQuestions(
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

  await supabase.from("quizzes").insert(rows);

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

const generatedLessonSchema = z
  .object({
    summary: z.string().trim().min(1).max(3000),
    transcript: z.string().trim().min(1).max(15000),
    transcript_pt: z.string().max(15000),
    flashcards: z
      .array(flashcardSchema)
      .length(7)
      .refine(
        (cards) => cards.filter((card) => card.card_type === "listen").length === 3,
        "Exactly three listening cards are required",
      ),
    quiz: z.array(quizItemSchema).length(10),
  })
  .strict();

function jsonValue(raw: string): unknown {
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

async function writeLesson(
  supabase: SupabaseClient<Database>,
  userId: string,
  plan: CurriculumLesson,
): Promise<string> {
  const descriptor = CEFR[plan.level] ?? CEFR["b1"]!;
  const reviewScope = plan.reviewUnits.length
    ? getCurriculum(plan.level)
        .filter((lesson) => plan.reviewUnits.includes(lesson.unit) && lesson.unit <= 5)
        .map((lesson) => `${lesson.unit}.${lesson.position} ${lesson.title}: ${lesson.objective}`)
        .join("\n")
    : "";
  const reviewInstructions = plan.isReviewTest
    ? "This is the optional Unit 6 review Test. Build its summary and all 10 quiz questions from the supplied Units 1-5 course outline. Cover all five units fairly. Do not introduce new material. The test does not determine CEFR promotion."
    : plan.reviewUnits.length
      ? `This is a consolidation lesson. Summarize and practise only Units ${plan.reviewUnits.join(" and ")} from the supplied course outline. Connect their main grammar, vocabulary and communication skills without introducing new material.`
      : "";

  const raw = await callContentAi(
    [
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
          "Give exactly 7 flashcards and 10 quiz questions. " +
          "Exactly 3 flashcards must have card_type 'listen'. For these, the prompt must be a listening question or repeat instruction, the answer must reveal the sentence or phrase, and listen_text must contain that same English audio sentence. " +
          "The other 4 flashcards must have card_type 'question'. Randomly vary them between grammar use, meaning, key expressions, sentence completion, and real-life situations from the lesson, without repeating the same format. " +
          "Every flashcard must use content from THIS lesson transcript, and every flashcard field must be in English only - never Portuguese, never a translation. " +
          "Every flashcard answer, definition and example must be SHORT: one brief sentence or phrase, maximum 15 words. " +
          `${plan.reviewUnits.length ? "Every quiz question must review content from the supplied previous-unit outline, with balanced grammar, vocabulary and usage." : "EVERY quiz question must test ONLY the grammar point of this lesson (form, structure, tense, word order, correct usage)."} ` +
          "Never ask about a dialogue, a video, a story, a character, a speaker or anything the student had to watch, listen to or read. " +
          "Each question must be self-contained: a sentence to complete or correct, or a direct grammar rule question.",
      },
      {
        role: "user",
        content: `Lesson title: ${plan.title}\nObjective: ${plan.objective}\nMain skill: ${plan.skill}\nCEFR level: ${plan.level.toUpperCase()}\nUnit: ${plan.unitTitle}${reviewScope ? `\nPrevious-unit course outline:\n${reviewScope}` : ""}`,
      },
    ],
    userId,
    "lesson_generation",
    true,
  );

  const parsedContent = generatedLessonSchema.safeParse(jsonValue(raw));
  if (!parsedContent.success) {
    throw new Error("The AI could not write this lesson. Please try again.");
  }
  const content = parsedContent.data;

  const video = await pickVideo(supabase, plan);

  const { data: lesson, error } = await supabase
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

  if (error || !lesson) throw new Error(error?.message ?? "Could not save this lesson.");

  const generatedCards = (content.flashcards ?? []).filter(
    (c) => c.word && (c.answer || c.definition || c.example),
  );
  const listenCards = generatedCards.filter((card) => card.card_type === "listen").slice(0, 3);
  const variedCards = generatedCards.filter((card) => card.card_type !== "listen").slice(0, 4);
  const cards = [...listenCards, ...variedCards]
    .map((card) => ({ card, random: Math.random() }))
    .sort((a, b) => a.random - b.random)
    .map(({ card }) => card);
  if (cards.length) {
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
    .slice(0, 10)
    .filter(
      (q) => q.question && Array.isArray(q.options) && q.options.length > 1 && q.correct_answer,
    );
  if (plan.isReviewTest && quiz.length !== 10) {
    throw new Error("The AI could not write all 10 review questions. Please try again.");
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
export const openCurriculumLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ key: z.string().min(3).max(40) }).parse(input))
  .handler(async ({ data, context }): Promise<{ lessonId: string }> => {
    const { supabase, userId } = context;

    const plan = findCurriculumLesson(data.key);
    if (!plan) throw new Error("This lesson is not part of your learning path.");

    const { data: existing } = await supabase
      .from("lessons")
      .select("id")
      .eq("created_by", userId)
      .eq("curriculum_key", plan.key)
      .maybeSingle();
    if (existing?.id) return { lessonId: existing.id as string };

    if (plan.index > 0) {
      const previous = getCurriculum(plan.level)[plan.index - 1]!;
      const { data: prevLesson } = await supabase
        .from("lessons")
        .select("id")
        .eq("created_by", userId)
        .eq("curriculum_key", previous.key)
        .maybeSingle();

      const prevId = prevLesson?.id as string | undefined;
      const done = prevId
        ? (
            await supabase
              .from("user_lessons")
              .select("completed_at")
              .eq("user_id", userId)
              .eq("lesson_id", prevId)
              .maybeSingle()
          ).data?.completed_at
        : null;

      if (!done) throw new Error("Finish the previous lesson first to unlock this one.");
    }

    const lessonId = await writeLesson(supabase, userId, plan);
    return { lessonId };
  });

/** Number of questions in the Final Test that closes a level. */
const FINAL_TEST_TOTAL = 30;

type GeneratedTest = {
  quiz?: GeneratedQuizItem[];
};
const generatedTestSchema = z
  .object({ quiz: z.array(quizItemSchema).length(FINAL_TEST_TOTAL) })
  .strict();

/**
 * Opens the Final Test of the student's level. It only unlocks when all 30
 * lessons of the level are completed; the 30 questions are written by the AI
 * the first time and reused afterwards.
 */
export const openFinalTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ level: z.string().min(2).max(10) }).parse(input))
  .handler(async ({ data, context }): Promise<{ lessonId: string }> => {
    const { supabase, userId } = context;
    const level = normalizeLevel(data.level);
    const key = finalTestKey(level);

    const { data: existing } = await supabase
      .from("lessons")
      .select("id")
      .eq("created_by", userId)
      .eq("curriculum_key", key)
      .maybeSingle();
    if (existing?.id) return { lessonId: existing.id as string };

    // Only the 30 core lessons in Units 1-5 are required. Unit 6 is optional.
    const plan = getCoreCurriculum(level);
    const { data: rows } = await supabase
      .from("lessons")
      .select("id, curriculum_key")
      .eq("created_by", userId)
      .in(
        "curriculum_key",
        plan.map((l) => l.key),
      );
    const lessonIds = ((rows ?? []) as { id: string }[]).map((r) => r.id);

    let done = 0;
    if (lessonIds.length) {
      const { data: states } = await supabase
        .from("user_lessons")
        .select("lesson_id, completed_at")
        .eq("user_id", userId)
        .in("lesson_id", lessonIds);
      done = ((states ?? []) as { completed_at: string | null }[]).filter(
        (s) => s.completed_at,
      ).length;
    }
    if (done < plan.length) {
      throw new Error("Finish all 30 lessons of this level to unlock the Final Test.");
    }

    const descriptor = CEFR[level] ?? CEFR["b1"]!;
    const raw = await callContentAi(
      [
        {
          role: "system",
          content:
            `You are a CEFR examiner writing the final exam of a ${level.toUpperCase()} English course for a Brazilian learner. ` +
            `${descriptor} ` +
            `The exam checks the grammar the level requires: tenses, structures, word order, connectors and correct usage. ` +
            `Reply with strict JSON: {"quiz":[{"question":"","options":["4 options"],"correct_answer":"exactly one of the options","explanation":"one short sentence","pedagogical_skill":"grammar"}]}. ` +
            `Give exactly ${FINAL_TEST_TOTAL} questions, all different, ordered from easier to harder, all inside ${level.toUpperCase()}. ` +
            `Every question must be a self-contained grammar question (complete or correct a sentence, choose the right form). ` +
            `Never ask about a dialogue, a video, a story, a character or any listening/reading passage.`,
        },
        {
          role: "user",
          content: `Write the ${FINAL_TEST_TOTAL}-question final test for level ${level.toUpperCase()}.`,
        },
      ],
      userId,
      "quiz_generation",
      true,
    );

    const parsedContent = generatedTestSchema.safeParse(jsonValue(raw));
    if (!parsedContent.success)
      throw new Error("The AI could not write the Final Test. Please try again.");
    const content: GeneratedTest = parsedContent.data;
    const quiz = (content.quiz ?? [])
      .filter(
        (q) => q.question && Array.isArray(q.options) && q.options.length > 1 && q.correct_answer,
      )
      .slice(0, FINAL_TEST_TOTAL);
    if (quiz.length < 10)
      throw new Error("The AI could not write the Final Test. Please try again.");

    const { data: lesson, error } = await supabase
      .from("lessons")
      .insert({
        title: `Final Test — ${level.toUpperCase()}`,
        category: "final-test",
        level,
        objective: `Prove you master level ${level.toUpperCase()} and move up to the next one.`,
        summary: "",
        transcript: "",
        transcript_pt: "",
        sort_order: 999,
        curriculum_key: key,
        unit_number: 7,
        position_in_unit: 1,
        skill: "grammar",
        created_by: userId,
        generated: true,
      })
      .select("id")
      .single();

    if (error || !lesson) throw new Error(error?.message ?? "Could not open the Final Test.");

    // The Final Test prompt constrains every item to grammar, so grammar is the
    // structural default when the generated label is absent or unsupported.
    await insertQuizQuestions(supabase, userId, lesson.id as string, quiz, "grammar");

    return { lessonId: lesson.id as string };
  });
