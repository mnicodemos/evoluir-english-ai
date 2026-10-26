import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { findCurriculumLesson } from "./curriculum";
import { findBusinessLesson, isBusinessKey } from "./businessCourse";
import {
  hasLessonPodcast,
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
 * Shared dialogue for one curriculum lesson, written by the AI the first
 * time a student opens it. Review I and Review II keep their existing review
 * outlines; core lessons use their own title and objective. Null for the review
 * Test; an error lets the student retry if generation fails.
 */
export const loadLessonPodcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ lessonId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ReviewPodcast | null> => {
    const { data: lesson } = await context.supabase
      .from("lessons")
      .select("curriculum_key, level")
      .eq("id", data.lessonId)
      .maybeSingle();
    const key = (lesson as { curriculum_key?: string | null } | null)?.curriculum_key;
    const plan = key
      ? isBusinessKey(key)
        ? findBusinessLesson(key, (lesson as { level?: string | null } | null)?.level ?? "b1")
        : findCurriculumLesson(key)
      : null;
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


/** Admin-only export of podcast scripts already persisted in shared lesson templates. */
export const listAdminPodcastScripts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || isAdmin !== true) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("lesson_content_templates")
      .select("curriculum_key, prompt_hash, content, created_at")
      .like("prompt_hash", "podcast-v1:%")
      .order("curriculum_key", { ascending: true });
    if (error) throw error;

    return (data ?? []).flatMap((row) => {
      const parsed = podcastSchema.safeParse(row.content);
      if (!parsed.success) return [];
      return [{
        curriculumKey: row.curriculum_key,
        createdAt: row.created_at,
        podcast: parsed.data,
      }];
    });
  });
