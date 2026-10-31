import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  checkComment,
  commentAuthorName,
  COMMENTS_PAGE,
  COMMENTS_PER_HOUR,
} from "@/lib/premiumVideoSocial";

/**
 * Likes and comments on the Premium extra videos (owner request, 2026-10-31;
 * migration 0103_premium_video_social). Counts are read by any signed-in
 * student (free students see them beside the locks); reading comments, liking
 * and commenting need Premium (hasPremium on the server). Before 0103 is
 * applied everything answers "not ready" and the screen hides the buttons.
 */

export type VideoSocialCounts = { likes: number; liked: boolean; comments: number };

export type VideoComment = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  mine: boolean;
};

const videoIds = z.array(z.string().uuid()).max(200);

export const loadVideoSocial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ videoIds }).parse(data))
  .handler(async ({ context, data }) => {
    const { socialTables, missingSocialTables } = await import("@/lib/premiumVideoSocial.server");
    const counts: Record<string, VideoSocialCounts> = {};
    for (const id of data.videoIds) counts[id] = { likes: 0, liked: false, comments: 0 };
    if (data.videoIds.length === 0) return { ready: true, counts };
    const tables = await socialTables();
    const [likes, comments] = await Promise.all([
      tables.likes().select("video_id, user_id").in("video_id", data.videoIds).limit(20000),
      tables.comments().select("video_id").in("video_id", data.videoIds).limit(20000),
    ]);
    if (likes.error || comments.error) {
      const missing = missingSocialTables(likes.error) || missingSocialTables(comments.error);
      if (!missing)
        console.error(
          `Video social counts failed: ${(likes.error ?? comments.error)?.message ?? ""}`,
        );
      return { ready: false, counts };
    }
    for (const row of likes.data ?? []) {
      const entry = counts[row.video_id];
      if (!entry) continue;
      entry.likes += 1;
      if (row.user_id === context.userId) entry.liked = true;
    }
    for (const row of (comments.data ?? []) as { video_id: string }[]) {
      const entry = counts[row.video_id];
      if (entry) entry.comments += 1;
    }
    return { ready: true, counts };
  });

async function requirePremium(userId: string) {
  const { hasPremium } = await import("@/lib/premium.server");
  if (!(await hasPremium(userId))) throw new Error("Likes and comments are part of Premium.");
}

async function requireVideo(videoId: string) {
  const { socialTables } = await import("@/lib/premiumVideoSocial.server");
  const { data, error } = await (await socialTables()).videos().select("id").eq("id", videoId);
  if (error || !data?.length) throw new Error("This video is no longer available.");
}

export const toggleVideoLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ videoId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await requirePremium(context.userId);
    await requireVideo(data.videoId);
    const { socialTables } = await import("@/lib/premiumVideoSocial.server");
    const likes = (await socialTables()).likes;
    const existing = await likes()
      .select("video_id")
      .eq("video_id", data.videoId)
      .eq("user_id", context.userId);
    if (existing.error) {
      console.error(`Video like read failed: ${existing.error.message}`);
      throw new Error("Could not save your like. Please try again.");
    }
    if (existing.data?.length) {
      const { error } = await likes()
        .delete()
        .eq("video_id", data.videoId)
        .eq("user_id", context.userId);
      if (error) throw new Error("Could not save your like. Please try again.");
      return { liked: false };
    }
    const { error } = await likes().insert({ video_id: data.videoId, user_id: context.userId });
    // A double tap may insert twice; the second one meets the primary key.
    if (error && error.code !== "23505") {
      console.error(`Video like failed: ${error.code ?? ""} ${error.message}`);
      throw new Error("Could not save your like. Please try again.");
    }
    return { liked: true };
  });

export const loadVideoComments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ videoId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ comments: VideoComment[] }> => {
    await requirePremium(context.userId);
    const { socialTables } = await import("@/lib/premiumVideoSocial.server");
    const { data: rows, error } = await (
      await socialTables()
    )
      .comments()
      .select("id, video_id, user_id, author_name, body, created_at")
      .eq("video_id", data.videoId)
      .order("created_at", { ascending: false })
      .limit(COMMENTS_PAGE);
    if (error) throw new Error("Could not load the comments. Please try again.");
    return {
      comments: (rows ?? []).map((row) => ({
        id: row.id,
        author: row.author_name,
        body: row.body,
        createdAt: row.created_at,
        mine: row.user_id === context.userId,
      })),
    };
  });

export const addVideoComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ videoId: z.string().uuid(), body: z.string().max(2000) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const checked = checkComment(data.body);
    if (!checked.ok) throw new Error(checked.reason);
    await requirePremium(context.userId);
    await requireVideo(data.videoId);
    const { socialTables } = await import("@/lib/premiumVideoSocial.server");
    const tables = await socialTables();
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [recent, profile] = await Promise.all([
      tables
        .comments()
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .gte("created_at", hourAgo),
      tables.profiles().select("id, name").eq("id", context.userId),
    ]);
    if ((recent.count ?? 0) >= COMMENTS_PER_HOUR)
      throw new Error("You have commented a lot this hour. Please try again later.");
    const author = commentAuthorName(profile.data?.[0]?.name);
    const { error } = await tables.comments().insert({
      video_id: data.videoId,
      user_id: context.userId,
      author_name: author,
      body: checked.body,
    });
    if (error) {
      console.error(`Video comment failed: ${error.code ?? ""} ${error.message}`);
      throw new Error("Could not post your comment. Please try again.");
    }
    return { ok: true };
  });

/** A student deletes their own comment (the owner deletes any from the Admin). */
export const deleteOwnVideoComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { socialTables } = await import("@/lib/premiumVideoSocial.server");
    const { error } = await (
      await socialTables()
    )
      .comments()
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("Could not delete the comment. Please try again.");
    return { ok: true };
  });

export const reportVideoComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await requirePremium(context.userId);
    const { socialTables } = await import("@/lib/premiumVideoSocial.server");
    const { error } = await (
      await socialTables()
    )
      .reports()
      .insert({ comment_id: data.id, user_id: context.userId });
    if (error && error.code !== "23505") {
      console.error(`Video comment report failed: ${error.code ?? ""} ${error.message}`);
      throw new Error("Could not send the report. Please try again.");
    }
    return { ok: true };
  });
