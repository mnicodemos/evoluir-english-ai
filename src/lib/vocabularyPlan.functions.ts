import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { callGateway } from "./ai-gateway.server";
import { studyToday } from "./today";

export type DailyWord = {
  id: string;
  word: string;
  translation: string;
  meaning: string;
  pronunciation: string;
  example: string;
  category: string;
  difficulty: string;
  lesson_id: string | null;
};

const SELECT =
  "id, word, translation, meaning, pronunciation, example, category, difficulty, lesson_id";
const DAILY_COUNT = 10;

type AiWord = {
  word?: string;
  translation?: string;
  meaning?: string;
  pronunciation?: string;
  example?: string;
  lesson_title?: string;
  difficulty?: string;
};

const aiWordsSchema = z
  .object({
    words: z
      .array(
        z
          .object({
            word: z.string().trim().min(1).max(120),
            translation: z.string().trim().min(1).max(200),
            meaning: z.string().trim().min(1).max(400),
            pronunciation: z.string().max(120),
            example: z.string().trim().min(1).max(400),
            lesson_title: z.string().max(240),
            difficulty: z.enum(["easy", "medium", "hard"]),
          })
          .strict(),
      )
      .min(1)
      .max(10),
  })
  .strict();

function parseWords(raw: string) {
  try {
    const value = JSON.parse(
      raw
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim(),
    ) as unknown;
    return aiWordsSchema.safeParse(value);
  } catch {
    return aiWordsSchema.safeParse(null);
  }
}

/**
 * Returns today's ten new words, built by the AI from the lessons in the student's path.
 * Words already offered today are reused, and words the student has already seen are never repeated.
 */
export const dailyWords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ level: z.string().default("intermediate") }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<DailyWord[]> => {
    const { supabase, userId } = context;
    const today = studyToday();

    // A fresh set of ten words is unlocked by each COMPLETED lesson, so retaking a
    // lesson reuses the same batch instead of creating a duplicate one.
    const { count } = await supabase
      .from("user_lessons")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("completed_at", "is", null);
    const batchKey = lessonBatchKey(count ?? 0);

    const existing = await supabase
      .from("vocabulary")
      .select(SELECT)
      .eq("created_by", userId)
      .eq("batch_key", batchKey)
      .order("created_at");

    const todays = (existing.data ?? []) as DailyWord[];
    if (todays.length >= DAILY_COUNT) return todays.slice(0, DAILY_COUNT);


    // Words must come only from this level's lessons, so a mastered word never counts
    // toward another level when the student changes level.
    const { data: lessons } = await supabase
      .from("lessons")
      .select("id, title, category, objective")
      .eq("created_by", userId)
      .like("curriculum_key", `${data.level}-%`)
      .order("sort_order")
      .limit(30);
    const lessonList = (lessons ?? []) as {
      id: string;
      title: string;
      category: string;
      objective: string;
    }[];

    const { data: known } = await supabase.from("vocabulary").select("word").limit(1000);
    const usedWords = new Set(
      ((known ?? []) as { word: string }[]).map((w) => w.word.toLowerCase()),
    );

    const missing = DAILY_COUNT - todays.length;
    const raw = await callGateway(
      [
        {
          role: "system",
          content:
            "You are a CELTA English teacher choosing daily vocabulary for a Brazilian learner. " +
            `Pick exactly ${missing} useful English words or short expressions that come from the lessons listed by the user. ` +
            'Reply with strict JSON: {"words":[{"word":"","translation":"Brazilian Portuguese","meaning":"short definition in simple English",' +
            '"pronunciation":"simple phonetic hint","example":"natural English sentence using the word",' +
            '"lesson_title":"the exact lesson title this word comes from","difficulty":"easy|medium|hard"}]}',
        },
        {
          role: "user",
          content: [
            `Student level: ${data.level}.`,
            lessonList.length
              ? `Lessons in the learning path:\n${lessonList.map((l) => `- ${l.title} (${l.category}): ${l.objective}`).join("\n")}`
              : "No lessons yet — choose everyday communication words.",
            usedWords.size ? `Do NOT use these words again: ${[...usedWords].join(", ")}.` : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
      true,
      { userId, operation: "vocabulary_generation" },
    );

    const parsed = parseWords(raw);
    if (!parsed.success)
      throw new Error("The AI returned an invalid vocabulary list. Please try again.");
    const fresh = (parsed.data.words as AiWord[])
      .filter((w) => w.word && w.translation && !usedWords.has(String(w.word).toLowerCase()))
      .slice(0, missing);

    if (!fresh.length) {
      if (todays.length) return todays;
      throw new Error("The AI could not pick today's words. Please try again in a moment.");
    }

    const byTitle = new Map(lessonList.map((l) => [l.title.toLowerCase(), l]));
    const { data: inserted, error } = await supabase
      .from("vocabulary")
      .insert(
        fresh.map((w) => {
          const lesson = byTitle.get(String(w.lesson_title ?? "").toLowerCase());
          return {
            word: String(w.word).slice(0, 120),
            translation: String(w.translation).slice(0, 200),
            meaning: String(w.meaning ?? "").slice(0, 400),
            pronunciation: String(w.pronunciation ?? "").slice(0, 120),
            example: String(w.example ?? "").slice(0, 400),
            category: lesson?.category ?? "general",
            difficulty: ["easy", "medium", "hard"].includes(String(w.difficulty))
              ? String(w.difficulty)
              : "medium",
            lesson_id: lesson?.id ?? null,
            level: data.level,
            created_by: userId,
            offered_for: today,
            batch_key: batchKey,
          };
        }),
      )
      .select(SELECT);

    if (error) throw new Error(error.message);
    return [...todays, ...((inserted ?? []) as DailyWord[])].slice(0, DAILY_COUNT);
  });
