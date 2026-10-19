import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createWhatsAppStudyLinkCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({}).strict().parse(input ?? {}))
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createWhatsAppLinkCode } = await import("@/lib/whatsapp.server");
    // These tables are service-role-only; generated Supabase types are unchanged.
    const db = supabaseAdmin as any;
    const userId = context.userId;
    const now = new Date();
    const windowStart = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    const { count, error: countError } = await db
      .from("whatsapp_link_codes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", windowStart);
    if (countError) throw new Error("Could not prepare WhatsApp connection.");
    if ((count ?? 0) >= 5) {
      throw new Error("Too many WhatsApp connection codes. Please try again in an hour.");
    }

    const { code, codeHash } = createWhatsAppLinkCode();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    const { error } = await db.from("whatsapp_link_codes").insert({
      user_id: userId,
      code_hash: codeHash,
      expires_at: expiresAt.toISOString(),
    });
    if (error) throw new Error("Could not prepare WhatsApp connection.");

    return { code, expiresAt: expiresAt.toISOString() };
  });
