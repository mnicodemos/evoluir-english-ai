import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { WritingMistake } from "@/lib/ai-prompts";

type AdminClient = SupabaseClient<Database>;

/**
 * Stores the mistakes found in a correction as "My mistakes" review items.
 * A phrase the student already got wrong is reinforced (frequency + 1, back
 * to the first review step) instead of duplicated. Never throws: losing the
 * review list must not lose the correction itself.
 */
export async function recordMistakes(
  admin: AdminClient,
  userId: string,
  mistakes: WritingMistake[] | undefined,
  options: { skill: string; source: string },
) {
  if (!mistakes?.length) return;
  const now = new Date().toISOString();
  for (const mistake of mistakes) {
    const original = mistake.original.trim().slice(0, 300);
    const corrected = mistake.corrected.trim().slice(0, 300);
    if (!original || !corrected) continue;
    try {
      const { data: existing } = await admin
        .from("learning_errors")
        .select("id, frequency")
        .eq("user_id", userId)
        .ilike(
          "original_text",
          original.replace(/[\\%_]/g, (c) => `\\${c}`),
        )
        .limit(1)
        .maybeSingle();
      if (existing) {
        await admin
          .from("learning_errors")
          .update({
            frequency: existing.frequency + 1,
            last_detected: now,
            corrected_text: corrected,
            explanation: mistake.explanation.slice(0, 500),
            review_step: 0,
            next_review_at: now,
          })
          .eq("id", existing.id);
      } else {
        await admin.from("learning_errors").insert({
          user_id: userId,
          error_type: mistake.category.slice(0, 40) || "grammar",
          category: mistake.category.slice(0, 40) || "grammar",
          original_text: original,
          corrected_text: corrected,
          explanation: mistake.explanation.slice(0, 500),
          skill: options.skill,
          source: options.source,
        });
      }
    } catch {
      console.error("A mistake could not be stored for review");
    }
  }
}
