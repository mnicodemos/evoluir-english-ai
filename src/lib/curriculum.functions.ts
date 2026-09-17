import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  finalTestKey,
  findCurriculumLesson,
  getCurriculum,
  normalizeLevel,
  type CurriculumLesson,
} from "@/lib/curriculum";

import { callGateway, parseJson } from "./ai-gateway.server";
import { findLessonVideo, type LessonVideo } from "./lessonVideo.server";

async function callContentAi(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  jsonMode = false,
): Promise<string> {
  return callGateway(messages, jsonMode);
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
  listening: "Focus on listening: the script must sound like natural spoken English with a short dialogue the student can shadow.",
  reading: "Focus on reading: the script must include a short text plus guidance on how to read it for gist and detail.",
  talking: "Focus on speaking: give model sentences, useful phrases and prompts the student can say out loud.",
  writing: "Focus on writing: give a model text, a simple structure and sentence patterns the student can copy.",
  vocabulary: "Focus on vocabulary: teach a clear word set with meaning, collocation and natural examples.",
  grammar: "Focus on grammar: explain the form, the meaning, the common Brazilian-learner mistake and how to fix it.",
};

/** Finds a captioned video (max 7 minutes) on the same topic as the lesson. */
async function pickVideo(
  supabase: { from: (t: string) => any },
  plan: CurriculumLesson,
): Promise<LessonVideo> {
  const { data } = await supabase.from("lessons").select("video_url").not("video_url", "is", null);
  const used = new Set(((data ?? []) as { video_url: string }[]).map((row) => row.video_url));
  return findLessonVideo(`${plan.title} ${plan.level.toUpperCase()}`, plan.skill, used);
}

type GeneratedLesson = {
  summary?: string;
  transcript?: string;
  transcript_pt?: string;
  flashcards?: {
    word?: string;
    translation?: string;
    definition?: string;
    pronunciation?: string;
    example?: string;
    difficulty?: string;
    prompt?: string;
    answer?: string;
    card_type?: string;
    listen_text?: string;
  }[];
  quiz?: { question?: string; options?: string[]; correct_answer?: string; explanation?: string }[];
};

async function writeLesson(
  supabase: { from: (t: string) => any },
  userId: string,
  plan: CurriculumLesson,
): Promise<string> {
  const descriptor = CEFR[plan.level] ?? CEFR["b1"]!;

  const raw = await callContentAi(
    [
      {
        role: "system",
        content:
          `You are a CELTA English teacher writing lesson ${plan.position} of ${plan.unitTitle} in a structured ${plan.level.toUpperCase()} course for a Brazilian learner. ` +
          `${descriptor} ` +
          `${SKILL_BRIEF[plan.skill] ?? ""} ` +
          `Keep EVERY part of the lesson inside ${plan.level.toUpperCase()}: grammar, vocabulary, sentence length and idioms must match this level exactly. ` +
          'Reply with strict JSON: {"summary":"120-180 words explaining the language point with clear examples, in simple English",' +
          '"transcript":"a 450-600 word mini-lesson script in English, written in short paragraphs separated by blank lines",' +
          '"transcript_pt":"a faithful Brazilian Portuguese translation of the script, same paragraph structure",' +
          '"flashcards":[{"card_type":"listen|question","prompt":"front of card, uppercase English instruction or question","answer":"back of card, short English answer","listen_text":"English sentence to hear only on the answer side; empty for non-listen cards","word":"short label from the lesson","definition":"short English-only definition or explanation, no Portuguese","pronunciation":"simple phonetic hint","example":"natural English sentence from or based on this lesson","difficulty":"easy|medium|hard"}],' +
          '"quiz":[{"question":"","options":["4 options"],"correct_answer":"exactly one of the options","explanation":"one short sentence"}]}. ' +
          "Give exactly 7 flashcards and 10 quiz questions. " +
          "Exactly 4 flashcards must have card_type 'listen'. For these, the prompt must be a listening question or repeat instruction, the answer must reveal the sentence or phrase, and listen_text must contain that same English audio sentence. " +
          "The other 3 flashcards must have card_type 'question' and should vary between grammar use, meaning, and a key expression from the lesson. " +
          "Every flashcard must use content from THIS lesson transcript, and every flashcard field must be in English only - never Portuguese, never a translation. " +
          "EVERY quiz question must test ONLY the grammar point of this lesson (form, structure, tense, word order, correct usage). " +
          "Never ask about a dialogue, a video, a story, a character, a speaker or anything the student had to watch, listen to or read. " +
          "Each question must be self-contained: a sentence to complete or correct, or a direct grammar rule question.",

      },
      {
        role: "user",
        content: `Lesson title: ${plan.title}\nObjective: ${plan.objective}\nMain skill: ${plan.skill}\nCEFR level: ${plan.level.toUpperCase()}\nUnit: ${plan.unitTitle}`,
      },
    ],
    true,
  );

  const content = parseJson<GeneratedLesson>(raw, {});
  if (!content.summary || !content.transcript) {
    throw new Error("The AI could not write this lesson. Please try again.");
  }

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

  const cards = (content.flashcards ?? []).slice(0, 7).filter((c) => c.word && (c.answer || c.definition || c.example));
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
        listen_text: String(c.card_type === "listen" ? c.listen_text || c.answer || c.example || c.word || "" : "").slice(0, 500),
        sort_order: index,
        difficulty: ["easy", "medium", "hard"].includes(String(c.difficulty)) ? String(c.difficulty) : "medium",
        created_by: userId,
      })),
    );
  }

  const quiz = (content.quiz ?? [])
    .slice(0, 10)
    .filter((q) => q.question && Array.isArray(q.options) && q.options.length > 1 && q.correct_answer);
  if (quiz.length) {
    await supabase.from("quizzes").insert(
      quiz.map((q, index) => ({
        lesson_id: lesson.id,
        question: String(q.question).slice(0, 400),
        question_type: "multiple_choice",
        options: q.options as string[],
        correct_answer: String(q.correct_answer),
        explanation: String(q.explanation ?? "").slice(0, 400),
        sort_order: index,
        created_by: userId,
      })),
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
  quiz?: { question?: string; options?: string[]; correct_answer?: string; explanation?: string }[];
};

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

    // Every lesson of the level must be completed first.
    const plan = getCurriculum(level);
    const { data: rows } = await supabase
      .from("lessons")
      .select("id, curriculum_key")
      .eq("created_by", userId)
      .in("curriculum_key", plan.map((l) => l.key));
    const lessonIds = ((rows ?? []) as { id: string }[]).map((r) => r.id);

    let done = 0;
    if (lessonIds.length) {
      const { data: states } = await supabase
        .from("user_lessons")
        .select("lesson_id, completed_at")
        .eq("user_id", userId)
        .in("lesson_id", lessonIds);
      done = ((states ?? []) as { completed_at: string | null }[]).filter((s) => s.completed_at).length;
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
            `Reply with strict JSON: {"quiz":[{"question":"","options":["4 options"],"correct_answer":"exactly one of the options","explanation":"one short sentence"}]}. ` +
            `Give exactly ${FINAL_TEST_TOTAL} questions, all different, ordered from easier to harder, all inside ${level.toUpperCase()}. ` +
            `Every question must be a self-contained grammar question (complete or correct a sentence, choose the right form). ` +
            `Never ask about a dialogue, a video, a story, a character or any listening/reading passage.`,
        },
        { role: "user", content: `Write the ${FINAL_TEST_TOTAL}-question final test for level ${level.toUpperCase()}.` },
      ],
      true,
    );

    const content = parseJson<GeneratedTest>(raw, {});
    const quiz = (content.quiz ?? [])
      .filter((q) => q.question && Array.isArray(q.options) && q.options.length > 1 && q.correct_answer)
      .slice(0, FINAL_TEST_TOTAL);
    if (quiz.length < 10) throw new Error("The AI could not write the Final Test. Please try again.");

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
        unit_number: 6,
        position_in_unit: 1,
        skill: "grammar",
        created_by: userId,
        generated: true,
      })
      .select("id")
      .single();

    if (error || !lesson) throw new Error(error?.message ?? "Could not open the Final Test.");

    await supabase.from("quizzes").insert(
      quiz.map((q, index) => ({
        lesson_id: lesson.id,
        question: String(q.question).slice(0, 400),
        question_type: "multiple_choice",
        options: q.options as string[],
        correct_answer: String(q.correct_answer),
        explanation: String(q.explanation ?? "").slice(0, 400),
        sort_order: index,
        created_by: userId,
      })),
    );

    return { lessonId: lesson.id as string };
  });
