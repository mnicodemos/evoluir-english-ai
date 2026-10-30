import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { studyToday } from "./today";

const SAVED_SELECT = "id, word";

/**
 * Words the student marked in the daily reading join their Vocabulary reviews
 * (owner request, 2026-10-30: marked words only lived on the device for the
 * day). Each becomes one of the student's own words (vocabulary, created_by
 * them, category "reading") and a review due now (user_vocabulary step 0), so
 * it shows under Review on the Vocabulary page and climbs the same ladder. A
 * word the student already owns keeps its row and its progress. Saving is not
 * a review: last_reviewed_at stays empty, so it never counts toward the study
 * day's ten reviewed words.
 */
export const saveReadingWords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        words: z
          .array(
            z.object({
              word: z.string().trim().min(1).max(120),
              translation: z.string().trim().min(1).max(200),
              meaning: z.string().trim().max(400).default(""),
              example: z.string().trim().max(400).default(""),
            }),
          )
          .min(1)
          .max(20),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("level")
      .eq("id", userId)
      .maybeSingle();
    const level = profile?.level ?? null;

    // One entry per word, whatever its case.
    const byKey = new Map(data.words.map((item) => [item.word.toLowerCase(), item]));
    const variants = [
      ...new Set(data.words.flatMap((item) => [item.word, item.word.toLowerCase()])),
    ];
    const { data: owned } = await supabase
      .from("vocabulary")
      .select(SAVED_SELECT)
      .eq("created_by", userId)
      .in("word", variants);
    const ids = new Map<string, string>();
    for (const row of owned ?? []) ids.set(row.word.toLowerCase(), row.id);

    const today = studyToday();
    for (const [key, item] of byKey) {
      if (ids.has(key)) continue;
      const { data: inserted, error } = await supabase
        .from("vocabulary")
        .insert({
          word: item.word,
          translation: item.translation,
          meaning: item.meaning,
          example: item.example,
          pronunciation: "",
          category: "reading",
          difficulty: "medium",
          lesson_id: null,
          level,
          created_by: userId,
          offered_for: today,
          batch_key: "reading",
        })
        .select(SAVED_SELECT)
        .maybeSingle();
      // A clash (an old global row with this word) skips only this word.
      if (error && error.code !== "23505") throw new Error("Could not save these words");
      if (inserted) ids.set(key, inserted.id);
    }
    if (!ids.size) return { saved: 0 };

    // Reviews are written only by the server (migration 0061). Words already
    // under review keep their step.
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { error } = await admin.from("user_vocabulary").upsert(
      [...ids.values()].map((wordId) => ({
        user_id: userId,
        word_id: wordId,
        mastery_level: 0,
        next_review_at: now,
      })),
      { onConflict: "user_id,word_id", ignoreDuplicates: true },
    );
    if (error) throw new Error("Could not save these words");
    return { saved: ids.size };
  });
