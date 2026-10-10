import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { vocabularyReviewUpdate } from "@/lib/vocabularyReview";

/** A passed pronunciation counts for "pronounced" when it was recorded this recently. */
const PRONUNCIATION_WINDOW_MS = 10 * 60 * 1000;

/**
 * Vocabulary reviews are written only by the server (security audit item 3):
 * the ladder (src/lib/vocabularyReview.ts) is applied here and reviewed words
 * complete a study day in credit_study_day, so the browser cannot skip steps
 * or invent reviews (migration 0061 revokes its writes).
 */
export const reviewVocabularyWord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        wordId: z.string().uuid(),
        action: z.enum(["known", "forgotten", "pronounced"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // The word must be one the student can see (RLS on their own session).
    const { data: word } = await context.supabase
      .from("vocabulary")
      .select("id")
      .eq("id", data.wordId)
      .maybeSingle();
    if (!word) throw new Error("Vocabulary word not found");

    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await admin
      .from("user_vocabulary")
      .select("mastery_level, next_review_at, last_reviewed_at, times_reviewed")
      .eq("user_id", context.userId)
      .eq("word_id", data.wordId)
      .maybeSingle();

    let pronouncedOk = false;
    if (data.action === "pronounced") {
      // Only a pronunciation the server scored (persistPronunciationLegacy) counts.
      const { data: attempt } = await admin
        .from("activities")
        .select("id")
        .eq("user_id", context.userId)
        .eq("source_type", "pronunciation")
        .eq("source_id", data.wordId)
        .gte("score", 70)
        .gte("created_at", new Date(Date.now() - PRONUNCIATION_WINDOW_MS).toISOString())
        .limit(1)
        .maybeSingle();
      pronouncedOk = !!attempt;
    }

    const update = vocabularyReviewUpdate(data.action, existing, { pronouncedOk });
    if (!update) return { saved: false as const };
    const { error } = await admin
      .from("user_vocabulary")
      .upsert(
        { user_id: context.userId, word_id: data.wordId, ...update },
        { onConflict: "user_id,word_id" },
      );
    if (error) throw new Error("Could not save this word");
    return { saved: true as const };
  });

/** "Practise again": today's words go back to the Today tab (mastery 0, no schedule). */
export const resetVocabularyWords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ wordIds: z.array(z.string().uuid()).min(1).max(50) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { error } = await admin
      .from("user_vocabulary")
      .update({ mastery_level: 0, next_review_at: null })
      .eq("user_id", context.userId)
      .in("word_id", data.wordIds);
    if (error) throw new Error("Could not reset today's words");
    return { reset: true as const };
  });
