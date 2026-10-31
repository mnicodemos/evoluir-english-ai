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
    if (error) return { missingMigration: true, premium, videos: [] };
    return { missingMigration: false, premium, videos: premiumVideoList(data ?? [], premium) };
  });
