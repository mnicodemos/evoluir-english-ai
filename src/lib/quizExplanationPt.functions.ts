import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { explanationsToTranslate, parseExplanationsPt } from "./quizExplanationPt";

/**
 * The Portuguese of a lesson quiz's explanations, keyed by question id
 * (owner request, 2026-10-30). Read through the student's own session, so
 * only quizzes they can see are translated. One short AI call per lesson
 * text, shared by every student through the AI cache (operation
 * "dictionary": a translation, the same daily limit as the word lookup).
 */
export const loadQuizExplanationsPt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ lessonId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<Record<string, string>> => {
    const { data: rows, error } = await context.supabase
      .from("quizzes")
      .select("id, explanation, sort_order")
      .eq("lesson_id", data.lessonId)
      .order("sort_order")
      .order("id");
    if (error) throw new Error("Could not load the explanations");
    const questions = (rows ?? []).filter((row) => row.explanation?.trim());
    if (!questions.length) return {};

    const texts = explanationsToTranslate(questions.map((row) => row.explanation));
    const { hashAiRequest } = await import("./ai-usage.server");
    const cacheKey = `quiz-explanation-pt:v1:${await hashAiRequest(texts)}`;
    const { callGateway } = await import("./ai-gateway.server");
    const raw = await callGateway(
      [
        {
          role: "system",
          content:
            "You translate short English grammar and vocabulary explanations for Brazilian beginners. Reply with JSON only.",
        },
        {
          role: "user",
          content:
            `Translate each explanation into simple Brazilian Portuguese, one line each, in the same order. ` +
            `Keep the English words being taught (in quotes or examples) in English. ` +
            `Return {"pt":["..."]} with exactly ${texts.length} items.\n` +
            JSON.stringify(texts),
        },
      ],
      true,
      {
        userId: context.userId,
        operation: "dictionary",
        cacheKey,
        fast: true,
        maxOutputTokens: 2000,
      },
    );
    const pt = parseExplanationsPt(raw, texts.length);
    return Object.fromEntries(
      questions.flatMap((row, index) => (pt[index] ? [[row.id, pt[index]!]] : [])),
    );
  });
