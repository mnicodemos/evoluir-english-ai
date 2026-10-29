import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(context: {
  supabase: {
    rpc: (
      fn: "has_role",
      args: { _user_id: string; _role: "admin" },
    ) => PromiseLike<{ data: boolean | null; error: unknown }>;
  };
  userId: string;
}) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || data !== true) throw new Error("Forbidden");
}

/** Public read for the Lesson Audio image, independent of dashboard media. */
export const getLessonAudioImage = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // The settings table is shared with the Home media controls and is not in generated DB types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from("home_media_settings")
    .select("image_url")
    .eq("setting_key", "lesson-audio")
    .maybeSingle();
  if (error) throw new Error("The Lesson Audio image could not be loaded.");
  return {
    imageUrl: (data as { image_url?: string | null } | null)?.image_url ?? null,
  };
});

export const saveLessonAudioImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        dataUrl: z.string().min(100).max(4_300_000),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const match = data.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    const encodedImage = match?.[2];
    if (!match || match[1] !== data.mimeType || !encodedImage) {
      throw new Error("Choose a valid JPG, PNG or WebP image.");
    }

    const bytes = Uint8Array.from(atob(encodedImage), (character) => character.charCodeAt(0));
    if (bytes.byteLength > 3 * 1024 * 1024) {
      throw new Error("The image must be 3 MB or smaller.");
    }

    const extension =
      data.mimeType === "image/jpeg" ? "jpg" : data.mimeType === "image/png" ? "png" : "webp";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `lesson-audio/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("dashboard-home-images")
      .upload(path, bytes, {
        contentType: data.mimeType,
        // A new file name per upload, so a long cache never shows an old image.
        cacheControl: "31536000",
        upsert: false,
      });
    if (uploadError) {
      throw new Error("The Lesson Audio image could not be uploaded. Please try again.");
    }

    const { data: publicData } = supabaseAdmin.storage
      .from("dashboard-home-images")
      .getPublicUrl(path);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: saveError } = await (supabaseAdmin as any).from("home_media_settings").upsert({
      setting_key: "lesson-audio",
      image_url: publicData.publicUrl,
      updated_at: new Date().toISOString(),
    });
    if (saveError) throw new Error("The image was uploaded but could not be published.");
    return { ok: true, url: publicData.publicUrl };
  });
