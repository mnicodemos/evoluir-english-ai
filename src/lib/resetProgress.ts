import { supabase } from "@/integrations/supabase/client";

/**
 * Clears every study indicator for one student so a new CEFR level starts from zero:
 * activities, scores, quizzes, flashcard reviews, lessons, vocabulary, daily suggestions,
 * AI-generated content, streak and learning profile notes.
 */
export async function resetAllProgress(userId: string) {
  // Order matters: dependent rows first, then the AI-generated content they point at.
  await Promise.all([
    supabase.from("user_flashcards").delete().eq("user_id", userId),
    supabase.from("quiz_results").delete().eq("user_id", userId),
    supabase.from("user_lessons").delete().eq("user_id", userId),
    supabase.from("user_vocabulary").delete().eq("user_id", userId),
    supabase.from("activities").delete().eq("user_id", userId),
    supabase.from("ai_conversations").delete().eq("user_id", userId),
    supabase.from("progress").delete().eq("user_id", userId),
  ]);


  await Promise.all([
    supabase.from("quizzes").delete().eq("created_by", userId),
    supabase.from("flashcards").delete().eq("created_by", userId),
    supabase.from("vocabulary").delete().eq("created_by", userId),
  ]);

  await supabase.from("lessons").delete().eq("created_by", userId);

  await supabase
    .from("learning_profile")
    .update({ strengths: [], weaknesses: [], common_errors: [], learning_preferences: {} })
    .eq("user_id", userId);

  await supabase
    .from("profiles")
    .update({ streak_days: 0, last_activity_date: null })
    .eq("id", userId);
}
