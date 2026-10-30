import type { PremiumVideoRow } from "@/lib/premiumVideos";

type Result<T> = Promise<{ data: T | null; error: { message: string; code?: string } | null }>;

/** The premium_lesson_videos table (migration 0100), not in the generated types yet. */
export async function premiumVideoTable() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const from = supabaseAdmin.from.bind(supabaseAdmin) as unknown as (table: string) => {
    select: (columns: string) => Result<PremiumVideoRow[]>;
    upsert: (row: Record<string, unknown>) => Result<null>;
    delete: () => { eq: (column: string, value: string) => Result<null> };
  };
  return from("premium_lesson_videos");
}
