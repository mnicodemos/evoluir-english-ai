import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  finalTestKey,
  finalTestLessonsRequired,
  findCurriculumLesson,
  getCoreCurriculum,
  getCurriculum,
  getUnitLessons,
  normalizeLevel,
  unitTestKey,
} from "@/lib/curriculum";
import { unitTestQuestionCount } from "@/lib/lessonPlanSizing";
import { isReviewLevel } from "@/lib/level";

import {
  callContentAi,
  CEFR,
  contentWriter,
  type GeneratedQuizItem,
  insertQuizQuestions,
  jsonValue,
  prepareLessonContent,
  quizItemSchema,
  writeLesson,
} from "./curriculumContent.server";
import { keepAlive } from "./keepAlive.server";

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
    // Once this lesson is ready, the next one of the path is prepared in the
    // background (shared per level) while the student studies, so opening it
    // later is quick. Started after this lesson's own AI call, never with it.
    const nextPlan = getCurriculum(plan.level)[plan.index + 1];
    const prepareNext = () => {
      if (nextPlan) void keepAlive(prepareLessonContent(nextPlan, userId));
    };

    if (existing?.id) {
      // A lesson saved without its quiz (interrupted generation) is repaired once.
      if (!plan.isReviewTest) {
        const { count } = await supabase
          .from("quizzes")
          .select("id", { count: "exact", head: true })
          .eq("lesson_id", existing.id);
        if (!count) await writeLesson(supabase, userId, plan, existing.id as string);
      }
      prepareNext();
      return { lessonId: existing.id as string };
    }

    // Levels below the highest one reached are open for review in any order
    // (a student placed at B2 never took the A2 lessons one by one).
    const { data: owner } = await supabase
      .from("profiles")
      .select("level, max_level")
      .eq("id", userId)
      .maybeSingle();
    const reviewLevel = isReviewLevel(plan.level, owner?.max_level ?? owner?.level);

    if (plan.index > 0 && !reviewLevel) {
      const previous = getCurriculum(plan.level)[plan.index - 1]!;
      const { data: prevLesson } = await supabase
        .from("lessons")
        .select("id")
        .eq("curriculum_key", previous.key)
        .limit(1)
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
    prepareNext();
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

    // 70% of the 30 core lessons in Units 1-5 are required. Unit 6 is optional.
    const plan = getCoreCurriculum(level);
    const { data: rows } = await supabase
      .from("lessons")
      .select("id, curriculum_key")
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
    if (done < finalTestLessonsRequired(plan.length)) {
      throw new Error(
        "Finish at least 70% of the lessons of this level (21 of 30) to unlock the Final Test.",
      );
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

    const { data: lesson, error } = await (
      await contentWriter()
    )
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

/**
 * Opens the Final Test of one unit. It integrates the six lessons of that unit
 * instead of repeating their quizzes, unlocks only when all six are completed,
 * and is written once and reused afterwards. Its result is independent: it is a
 * separate lesson row with its own quiz attempts and evidence.
 */
export const openUnitTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ level: z.string().min(2).max(10), unit: z.number().int().min(1).max(6) })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ lessonId: string }> => {
    const { supabase, userId } = context;
    const level = normalizeLevel(data.level);
    const key = unitTestKey(level, data.unit);

    const { data: existing } = await supabase
      .from("lessons")
      .select("id")
      .eq("created_by", userId)
      .eq("curriculum_key", key)
      .maybeSingle();
    if (existing?.id) return { lessonId: existing.id as string };

    const unitPlan = getUnitLessons(level, data.unit);
    if (!unitPlan.length) throw new Error("This unit is not part of your learning path.");

    // The lesson rows of the unit are the same ones the Learning Center reads:
    // some are shared rows (no author), so ownership must not be required here.
    const { data: rows } = await supabase
      .from("lessons")
      .select("id, curriculum_key")
      .in(
        "curriculum_key",
        unitPlan.map((lesson) => lesson.key),
      );

    const unitLessonIds = ((rows ?? []) as { id: string }[]).map((row) => row.id);

    let completed = 0;
    if (unitLessonIds.length) {
      const { data: states } = await supabase
        .from("user_lessons")
        .select("lesson_id, completed_at")
        .eq("user_id", userId)
        .in("lesson_id", unitLessonIds);
      completed = ((states ?? []) as { completed_at: string | null }[]).filter(
        (state) => state.completed_at,
      ).length;
    }
    if (completed < unitPlan.length) {
      throw new Error("Finish every lesson of this unit to unlock its Final Test.");
    }

    const total = unitTestQuestionCount(level);
    const descriptor = CEFR[level] ?? CEFR["b1"]!;
    const outline = unitPlan
      .map((lesson) => `${lesson.position}. ${lesson.title} (${lesson.skill}): ${lesson.objective}`)
      .join("\n");

    const raw = await callContentAi(
      [
        {
          role: "system",
          content:
            `You are a CEFR examiner writing the Final Test of one unit of a ${level.toUpperCase()} English course for a Brazilian learner. ` +
            `${descriptor} ` +
            `The test must INTEGRATE the six lessons of the unit: each question should combine or apply what different lessons taught, in a realistic context. ` +
            `Do not copy or rephrase the quiz of a single lesson, and do not test isolated memorisation. ` +
            `Reply with strict JSON: {"quiz":[{"question":"","options":["4 options"],"correct_answer":"exactly one of the options","explanation":"one short sentence","pedagogical_skill":"grammar or vocabulary"}]}. ` +
            `Give exactly ${total} questions, all different, ordered from easier to harder, all inside ${level.toUpperCase()}. ` +
            `Every question must be self-contained: a sentence to complete or correct, or a short context of one or two sentences followed by the question. ` +
            `Never ask about a dialogue, a video, a story, a character or any listening passage the student cannot see.`,
        },
        {
          role: "user",
          content: `Unit: ${unitPlan[0]!.unitTitle}\nLevel: ${level.toUpperCase()}\nLessons of this unit:\n${outline}\n\nWrite the ${total}-question integrated unit test.`,
        },
      ],
      userId,
      "quiz_generation",
      true,
    );

    const parsed = z
      .object({ quiz: z.array(quizItemSchema).length(total) })
      .strict()
      .safeParse(jsonValue(raw));
    if (!parsed.success)
      throw new Error("The AI could not write this unit test. Please try again.");

    const { data: lesson, error } = await (
      await contentWriter()
    )
      .from("lessons")
      .insert({
        title: `Unit ${data.unit} Final Test — ${level.toUpperCase()}`,
        category: "unit-test",
        level,
        objective: `Show that you can use everything from ${unitPlan[0]!.unitTitle} together.`,
        summary: "",
        transcript: "",
        transcript_pt: "",
        sort_order: 900 + data.unit,
        curriculum_key: key,
        unit_number: data.unit,
        position_in_unit: 7,
        skill: "grammar",
        created_by: userId,
        generated: true,
      })
      .select("id")
      .single();

    if (error || !lesson) throw new Error(error?.message ?? "Could not open this unit test.");

    // The label produced during generation is validated server-side; nothing is
    // assumed when it cannot be mapped to a supported pedagogical skill.
    await insertQuizQuestions(supabase, userId, lesson.id as string, parsed.data.quiz, null);

    return { lessonId: lesson.id as string };
  });
