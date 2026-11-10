import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
    if (error) return { missingMigration: true, premium, watchedToday: null, videos: [] };
    return {
      missingMigration: false,
      premium,
      watchedToday: premium ? await watchedVideoToday(context.userId) : false,
      videos: premiumVideoList(data ?? [], premium),
    };
  });

/** Whether the student played an extra video today (migration 0104; false before it). */
async function watchedVideoToday(userId: string): Promise<boolean | null> {
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
  if (error) {
    console.error(`Premium video completion status could not be read: ${error.code ?? ""} ${error.message}`);
    return null;
  }
  return (data?.length ?? 0) > 0;
}

/** Premium-only WebVTT track for the active Short. */
export const loadPremiumShortCaption = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ videoId: z.string().uuid(), language: z.enum(["en", "pt"]) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { hasPremium } = await import("@/lib/premium.server");
    if (!(await hasPremium(context.userId))) throw new Error("Premium required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = (
      supabaseAdmin as unknown as {
        from: (name: string) => {
          select: (columns: string) => {
            eq: (
              column: string,
              value: string,
            ) => {
              eq: (
                column: string,
                value: string,
              ) => {
                maybeSingle: () => Promise<{
                  data: {
                    vtt_content: string;
                    font_size: number;
                    text_color: string;
                    background_color: string;
                    background_opacity: number;
                  } | null;
                  error: { message: string } | null;
                }>;
              };
            };
          };
        };
      }
    ).from("premium_video_captions");
    const { data: row, error } = await table
      .select("vtt_content, font_size, text_color, background_color, background_opacity")
      .eq("video_id", data.videoId)
      .eq("language", data.language)
      .maybeSingle();
    if (error) {
      if (/does not exist|relation .* not found/i.test(error.message)) {
        return {
          content: null,
          fontSize: 20,
          textColor: "#FFFFFF",
          backgroundColor: "#000000",
          backgroundOpacity: 100,
        };
      }
      throw new Error("Could not load Short captions");
    }
    return {
      content: row?.vtt_content ?? null,
      fontSize: row?.font_size ?? 20,
      textColor: row?.text_color ?? "#FFFFFF",
      backgroundColor: row?.background_color ?? "#000000",
      backgroundOpacity: row?.background_opacity ?? 100,
    };
  });
