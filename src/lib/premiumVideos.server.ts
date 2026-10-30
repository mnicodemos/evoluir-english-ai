import type { PremiumVideoRow } from "@/lib/premiumVideos";

type Result<T> = Promise<{ data: T | null; error: { message: string; code?: string } | null }>;

export const PREMIUM_VIDEO_COLUMNS = "id, level, title, video_url, created_at";

/** The premium_level_videos table (migration 0101), not in the generated types yet. */
export async function premiumVideoTable() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const from = supabaseAdmin.from.bind(supabaseAdmin) as unknown as (table: string) => {
    select: (columns: string) => Result<PremiumVideoRow[]>;
    insert: (row: Record<string, unknown>) => Result<null>;
    delete: () => { eq: (column: string, value: string) => Result<null> };
  };
  return from("premium_level_videos");
}
