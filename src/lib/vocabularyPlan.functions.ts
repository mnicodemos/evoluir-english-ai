import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { callGateway } from "./ai-gateway.server";
import { studyToday } from "./today";
import { getCurriculum } from "./curriculum";
import {
  lessonBatchKey,
  ownedWordSet,
  selectNewWords,
  templateVocabularyCandidates,
  VOCABULARY_BATCH_SIZE,
} from "./vocabularyBatch";

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
const DAILY_COUNT = VOCABULARY_BATCH_SIZE;

type AiWord = {
  word?: string;
  translation?: string;
  meaning?: string;
  pronunciation?: string;
  example?: string;
  lesson_title?: string;
  difficulty?: string;
};

const aiWordSchema = z.object({
  word: z.string().trim().min(1).max(120),
  translation: z.string().trim().min(1).max(200),
  meaning: z.string().trim().min(1).max(400),
  pronunciation: z.string().max(120).catch(""),
  example: z.string().trim().min(1).max(400),
  lesson_title: z.string().max(240).catch(""),
  difficulty: z.enum(["easy", "medium", "hard"]).catch("medium"),
});

/**
 * Keeps every well-formed word and drops only the broken ones, so one bad item
 * (extra field, odd difficulty) never throws away the whole batch.
 */
export function parseWords(
  raw: string,
): { success: true; data: { words: AiWord[] } } | { success: false } {
  try {
    const value = JSON.parse(
      raw
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim(),
    ) as unknown;
    // Gemini may answer {"words": [...]}, another wrapper key, or a bare array.
    const list = Array.isArray(value)
      ? value
      : value && typeof value === "object"
        ? (Object.values(value as Record<string, unknown>).find(Array.isArray) as
            unknown[] | undefined)
        : undefined;
    const items = Array.isArray(list) ? list.slice(0, 20) : [];
    const words = items.flatMap((item) => {
      const parsed = aiWordSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
    return words.length ? { success: true, data: { words } } : { success: false };
  } catch {
    return { success: false };
  }
}

/**
 * Returns today's ten new words, built by the AI from the lessons in the student's path.
 * Words already offered today are reused, and words the student has already seen are never repeated.
 */
export const dailyWords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        level: z.string().default("intermediate"),
        // false = only read the words already saved for this batch (no AI call).
        generate: z.boolean().default(true),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<DailyWord[]> => {
    // The batch must be saved even if the student leaves the lesson screen
    // while the words are being written.
    const { keepAlive } = await import("./keepAlive.server");
    return keepAlive(buildDailyWords(data, context));
  });

async function buildDailyWords(
  data: { level: string; generate: boolean },
  context: { supabase: SupabaseClient<Database>; userId: string },
): Promise<DailyWord[]> {
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
    .eq("level", data.level)
    .order("created_at");

  const todays = (existing.data ?? []) as DailyWord[];
  if (todays.length >= DAILY_COUNT) return todays.slice(0, DAILY_COUNT);
  if (!data.generate) return todays;

  // Words must come only from this level's lessons, so a mastered word never counts
  // toward another level when the student changes level.
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, title, category, objective, curriculum_key")
    .eq("created_by", userId)
    .like("curriculum_key", `${data.level}-%`)
    .order("sort_order")
    .limit(30);
  const lessonList = (lessons ?? []) as {
    id: string;
    title: string;
    category: string;
    objective: string;
    curriculum_key: string | null;
  }[];

  // Duplicate check is scoped to THIS student at this level: global sample words and
  // other students' words must not block a word that is new for this learner.
  const { data: known } = await supabase
    .from("vocabulary")
    .select("word")
    .eq("created_by", userId)
    .eq("level", data.level)
    .limit(1000);
  const usedWords = ownedWordSet((known ?? []) as { word: string }[]);

  const missing = DAILY_COUNT - todays.length;

  // Reuse complete, translated flashcards from the shared lesson catalogue first.
  // This path is a fast database read; Gemini is only needed for the remaining slots.
  const curriculum = getCurriculum(data.level);
  const lessonTitles = new Map(curriculum.map((lesson) => [lesson.key, lesson.title]));
  let templateCandidates: AiWord[] = [];
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: templates } = await supabaseAdmin
      .from("lesson_content_templates")
      .select("curriculum_key, content")
      .in(
        "curriculum_key",
        curriculum.map((lesson) => lesson.key),
      )
      .order("created_at", { ascending: false })
      .limit(120);
    templateCandidates = templateVocabularyCandidates(
      (templates ?? []) as { curriculum_key: string; content: unknown }[],
      lessonTitles,
    );
  } catch {
    // The shared catalogue is an optimisation; the existing AI path remains available.
  }
  const templateWords = selectNewWords(templateCandidates, usedWords, missing);
  const remaining = Math.max(0, missing - templateWords.length);
  // The model often repeats words the student already owns, so ask for a few
  // spare candidates only when the shared templates cannot fill the batch.
  const askCount = Math.min(remaining + 6, 20);

  // When the literal lesson words are exhausted (the model keeps returning words the
  // student already owns), the retry widens the source to the lessons' topics and
  // situations at the same level, so a completed lesson always unlocks new words.
  async function askAi(exclude: Set<string>, widen = false) {
    const source = widen
      ? `Pick exactly 20 useful English words or short expressions for the topics and situations of the lessons listed by the user, at the student's level. Prefer less obvious, level-appropriate vocabulary: collocations, phrasal verbs and expressions are welcome. `
      : `Pick exactly ${askCount} useful English words or short expressions that come from the lessons listed by the user. `;
    const raw = await callGateway(
      [
        {
          role: "system",
          content:
            "You are a CELTA English teacher choosing daily vocabulary for a Brazilian learner. " +
            source +
            "Never pick a word the user lists as already known. " +
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
            exclude.size
              ? `Already known — do NOT use these words: ${[...exclude].join(", ")}.`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
      true,
      { userId, operation: "vocabulary_generation", fast: true, maxOutputTokens: 4000 },
    );
    const parsed = parseWords(raw);
    if (!parsed.success)
      throw new Error("The AI returned an invalid vocabulary list. Please try again.");
    return parsed.data.words as AiWord[];
  }

  const exclude = new Set(usedWords);
  for (const word of templateWords) exclude.add(String(word.word ?? "").trim().toLowerCase());

  // Keep the student-facing request to one Gemini round trip. A second
  // sequential call (plus a six-second limiter wait) could exceed the host's
  // request deadline and show a timeout even when the first batch was usable.
  // Skip Gemini entirely when shared lesson templates already fill the batch.
  const aiWords = remaining > 0 ? await askAi(exclude) : [];
  const aiFresh = selectNewWords(aiWords, exclude, remaining);
  const fresh = [...templateWords, ...aiFresh];

  if (!fresh.length) {
    if (todays.length) return todays;
    throw new Error("The AI could not pick today's words. Please try again in a moment.");
  }

  const byTitle = new Map(lessonList.map((l) => [l.title.toLowerCase(), l]));
  const lessonForWord = (word: AiWord) =>
    byTitle.get(String(word.lesson_title ?? "").toLowerCase()) ??
    lessonList.find((lesson) => lesson.title === word.lesson_title);
  const rows = fresh.map((w) => {
    const lesson = lessonForWord(w);
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
  });
  const { data: inserted, error } = await supabase.from("vocabulary").insert(rows).select(SELECT);

  let saved = (inserted ?? []) as DailyWord[];
  if (error) {
    if (error.code !== "23505") throw new Error(error.message);
    // A word that already exists elsewhere (another level, or the old global
    // "one row per word" constraint until migration 0056 is applied) must not
    // throw away the whole batch: the words are saved one by one and only the
    // clashing ones are skipped.
    saved = [];
    for (const row of rows) {
      const one = await supabase.from("vocabulary").insert(row).select(SELECT).maybeSingle();
      if (one.error) {
        if (one.error.code !== "23505") throw new Error(one.error.message);
        continue;
      }
      if (one.data) saved.push(one.data as DailyWord);
    }
    if (!saved.length && !todays.length)
      throw new Error("The AI could not pick today's words. Please try again in a moment.");
  }
  return [...todays, ...saved].slice(0, DAILY_COUNT);
}
