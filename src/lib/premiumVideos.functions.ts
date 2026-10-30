import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { premiumVideoList } from "@/lib/premiumVideos";

/**
 * The extra videos page (owner request, 2026-10-31): every video set by the
 * owner, with its link only for Premium students (hasPremium on the server),
 * so a free account sees the list with locks and never the links.
 */
export const loadPremiumVideos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { premiumVideoTable } = await import("@/lib/premiumVideos.server");
    const { hasPremium } = await import("@/lib/premium.server");
    const [table, premium] = await Promise.all([premiumVideoTable(), hasPremium(context.userId)]);
    const { data, error } = await table.select("curriculum_key, video_url, title");
    if (error) return { missingMigration: true, premium, videos: [] };
    return { missingMigration: false, premium, videos: premiumVideoList(data ?? [], premium) };
  });
