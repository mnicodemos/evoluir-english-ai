import type { PremiumVideoRow } from "@/lib/premiumVideos";

type Result<T> = Promise<{ data: T | null; error: { message: string; code?: string } | null }>;

export const PREMIUM_VIDEO_COLUMNS = "id, level, title, video_url, created_at";
const PREMIUM_VIDEO_COLUMNS_WITH_KIND = `${PREMIUM_VIDEO_COLUMNS}, kind`;

/** The premium_level_videos table (migration 0101), not in the generated types yet. */
export async function premiumVideoTable() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const from = supabaseAdmin.from.bind(supabaseAdmin) as unknown as (table: string) => {
    select: (columns: string) => Result<PremiumVideoRow[]>;
    insert: (row: Record<string, unknown>) => Result<null>;
    delete: () => { eq: (column: string, value: string) => Result<null> };
    update: (row: Record<string, unknown>) => {
      eq: (column: string, value: string) => Result<null>;
    };
  };
  return from("premium_level_videos");
}

/**
 * Every extra video row with its kind; before migration 0102 adds the column,
 * the rows are read without it (all regular videos), so the page keeps working.
 */
export async function selectPremiumVideos() {
  const table = await premiumVideoTable();
  const withKind = await table.select(PREMIUM_VIDEO_COLUMNS_WITH_KIND);
  if (!withKind.error) return { ...withKind, kindReady: true };
  const plain = await table.select(PREMIUM_VIDEO_COLUMNS);
  return { ...plain, kindReady: false };
}
