import type { CurriculumLesson } from "./curriculum";
import {
  diagnoseReviewPodcast,
  lessonPodcastMessages,
  parseReviewPodcast,
  podcastSchema,
  type ReviewPodcast,
} from "./reviewPodcast";

/** Kept beside the lesson's shared content, under its own prompt hash. */
const PODCAST_HASH_PREFIX = "podcast-v1:";

async function readSharedPodcast(key: string, promptHash: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("lesson_content_templates")
      .select("content")
      .eq("curriculum_key", key)
      .eq("prompt_hash", promptHash)
      .maybeSingle();
    const parsed = podcastSchema.safeParse((data as { content?: unknown } | null)?.content);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function saveSharedPodcast(key: string, promptHash: string, podcast: ReviewPodcast) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("lesson_content_templates")
      .upsert(
        { curriculum_key: key, prompt_hash: promptHash, content: podcast },
        { onConflict: "curriculum_key,prompt_hash", ignoreDuplicates: true },
      );
  } catch {
    /* the student still hears this episode; the next one asks the AI again */
  }
}

/**
 * The shared dialogue of one curriculum lesson: the copy already written for
 * this lesson and level, or a new one written by the AI and shared from then
 * on. Used when a student opens the lesson and when the owner prepares a
 * level's audio in the Admin (prepareLevelPodcasts), with the same prompt, so
 * a prepared script is the one students get.
 */
export async function ensureLessonPodcast(
  plan: CurriculumLesson,
  userId: string,
): Promise<{ podcast: ReviewPodcast; generated: boolean }> {
  const { hashAiRequest } = await import("./ai-usage.server");
  const messages = lessonPodcastMessages(plan);
  const promptHash = `${PODCAST_HASH_PREFIX}${await hashAiRequest({ messages, jsonMode: true })}`;
  const shared = await readSharedPodcast(plan.key, promptHash);
  if (shared) return { podcast: shared, generated: false };

  const { callGateway } = await import("./ai-gateway.server");
  const requestOptions = {
    userId,
    operation: "lesson_generation" as const,
    fast: true,
  };
  let raw = await callGateway(messages, true, requestOptions);
  let podcast = parseReviewPodcast(raw);

  // Retry once only when the response is valid JSON but below the spoken-word minimum.
  // Keep the schema strict and preserve the lesson's level and topic constraints.
  if (!podcast && diagnoseReviewPodcast(raw).reason === "insufficient_spoken_words") {
    const retryMessages = messages.map((message) => ({ ...message }));
    const lastMessage = retryMessages[retryMessages.length - 1];
    if (lastMessage) {
      lastMessage.content +=
        "\n\nRETRY: The previous dialogue was below the required spoken-word minimum. " +
        "Write a complete replacement dialogue with at least 500 spoken English words across 30-36 lines. " +
        "Aim for 15-17 spoken words per line, count the spoken words before returning JSON, " +
        "and keep every line simple, natural, and appropriate to the learner's exact CEFR level and lesson topic.";
    }
    raw = await callGateway(retryMessages, true, requestOptions);
    podcast = parseReviewPodcast(raw);
  }

  if (!podcast) {
    console.error("Lesson podcast failed validation", {
      lessonKey: plan.key,
      ...diagnoseReviewPodcast(raw),
    });
    throw new Error("EVO could not prepare this lesson audio. Please try again.");
  }
  await saveSharedPodcast(plan.key, promptHash, podcast);
  return { podcast, generated: true };
}

/** Whether the lesson's shared dialogue is already written (no AI call). */
export async function lessonPodcastReady(plan: CurriculumLesson): Promise<boolean> {
  const { hashAiRequest } = await import("./ai-usage.server");
  const messages = lessonPodcastMessages(plan);
  const promptHash = `${PODCAST_HASH_PREFIX}${await hashAiRequest({ messages, jsonMode: true })}`;
  return !!(await readSharedPodcast(plan.key, promptHash));
}
