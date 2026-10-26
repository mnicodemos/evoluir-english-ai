import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { findCurriculumLesson } from "./curriculum";
import {
  hasLessonPodcast,
  lessonPodcastMessages,
  parseReviewPodcast,
  podcastSchema,
  type ReviewPodcast,
} from "./reviewPodcast";

/** Kept beside the review lesson's own content, under its own prompt hash. */
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
 * The review podcast of one of the student's lessons (owner request,
 * 2026-10-26): the shared episode of that review lesson and level, written by
 * the AI the first time any student opens it. Null for a lesson that has no
 * podcast; an error when the AI could not write it, so the page offers to try
 * again.
 */
export const loadLessonPodcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ lessonId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ReviewPodcast | null> => {
    const { data: lesson } = await context.supabase
      .from("lessons")
      .select("curriculum_key")
      .eq("id", data.lessonId)
      .maybeSingle();
    const key = (lesson as { curriculum_key?: string | null } | null)?.curriculum_key;
    const plan = key ? findCurriculumLesson(key) : null;
    if (!plan || !hasLessonPodcast(plan)) return null;

    const { hashAiRequest } = await import("./ai-usage.server");
    const messages = lessonPodcastMessages(plan);
    const promptHash = `${PODCAST_HASH_PREFIX}${await hashAiRequest({ messages, jsonMode: true })}`;
    const shared = await readSharedPodcast(plan.key, promptHash);
    if (shared) return shared;

    const { callGateway } = await import("./ai-gateway.server");
    const raw = await callGateway(messages, true, {
      userId: context.userId,
      operation: "lesson_generation",
      fast: true,
    });
    const podcast = parseReviewPodcast(raw);
    if (!podcast) {
      console.error("Lesson podcast failed validation", plan.key);
      throw new Error("EVO could not prepare this lesson audio. Please try again.");
    }
    await saveSharedPodcast(plan.key, promptHash, podcast);
    return podcast;
  });
