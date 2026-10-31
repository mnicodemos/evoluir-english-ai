/**
 * Server access to the likes and comments of the Premium extra videos
 * (migration 0103_premium_video_social). The tables are not in the generated
 * types yet and only the service role may touch them, so every read and write
 * goes through these loosely typed helpers.
 */

export type SocialResult<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number | null;
};

export type SocialQuery<T> = PromiseLike<SocialResult<T>> & {
  eq: (column: string, value: unknown) => SocialQuery<T>;
  in: (column: string, values: readonly unknown[]) => SocialQuery<T>;
  gte: (column: string, value: unknown) => SocialQuery<T>;
  order: (column: string, options: { ascending: boolean }) => SocialQuery<T>;
  limit: (count: number) => SocialQuery<T>;
};

export type SocialTable<Row> = {
  select: (columns: string, options?: { count?: "exact"; head?: boolean }) => SocialQuery<Row[]>;
  insert: (row: Record<string, unknown>) => SocialQuery<null>;
  delete: () => SocialQuery<null>;
};

export type LikeRow = { video_id: string; user_id: string };
export type CommentRow = {
  id: string;
  video_id: string;
  user_id: string;
  author_name: string;
  body: string;
  created_at: string;
};
export type ReportRow = { comment_id: string; user_id: string };

export async function socialTables() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const from = supabaseAdmin.from.bind(supabaseAdmin) as unknown as <Row>(
    table: string,
  ) => SocialTable<Row>;
  return {
    likes: () => from<LikeRow>("premium_video_likes"),
    comments: () => from<CommentRow>("premium_video_comments"),
    reports: () => from<ReportRow>("premium_video_comment_reports"),
    videos: () => from<{ id: string }>("premium_level_videos"),
    views: () =>
      from<{ video_id: string; user_id: string; day: string; created_at: string }>(
        "premium_video_views",
      ),
    profiles: () => from<{ id: string; name: string | null }>("profiles"),
  };
}

/** True when the error says the 0103 tables do not exist yet. */
export function missingSocialTables(error: { message: string; code?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|schema cache|Could not find the table/i.test(error.message)
  );
}
