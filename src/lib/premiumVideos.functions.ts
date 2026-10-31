import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { premiumVideoList } from "@/lib/premiumVideos";

/**
 * The extra videos page (owner decision, 2026-10-31: by level only): every
 * video set by the owner, with its link only for Premium students (hasPremium
 * on the server), so a free account sees the list with locks and never the links.
 */
export const loadPremiumVideos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { selectPremiumVideos } = await import("@/lib/premiumVideos.server");
    const { hasPremium } = await import("@/lib/premium.server");
    const [{ data, error }, premium] = await Promise.all([
      selectPremiumVideos(),
      hasPremium(context.userId),
    ]);
    if (error) return { missingMigration: true, premium, watchedToday: false, videos: [] };
    return {
      missingMigration: false,
      premium,
      watchedToday: premium ? await watchedVideoToday(context.userId) : false,
      videos: premiumVideoList(data ?? [], premium),
    };
  });

/** Whether the student played an extra video today (migration 0104; false before it). */
async function watchedVideoToday(userId: string): Promise<boolean> {
  const { socialTables } = await import("@/lib/premiumVideoSocial.server");
  const { studyToday } = await import("@/lib/today");
  const { data, error } = await (
    await socialTables()
  )
    .views()
    .select("video_id")
    .eq("user_id", userId)
    .eq("day", studyToday())
    .limit(1);
  return !error && (data?.length ?? 0) > 0;
}
