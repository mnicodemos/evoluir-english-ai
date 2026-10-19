import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createWhatsAppStudyLinkCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({}).strict().parse(input ?? {}))
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createWhatsAppLinkCode, getWhatsAppConfig } = await import("@/lib/whatsapp.server");
    const config = getWhatsAppConfig();
    // These tables are service-role-only; generated Supabase types are unchanged.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables are not yet in generated Supabase types
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

    return {
      code,
      expiresAt: expiresAt.toISOString(),
      businessPhoneNumber: config.businessPhoneNumber,
    };
  });

export const getWhatsAppStudyConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({}).strict().parse(input ?? {}))
  .handler(async ({ context }) => {
    const businessPhoneNumber = process.env["WHATSAPP_BUSINESS_PHONE_NUMBER"]?.trim() || null;
    const required = [
      process.env["WHATSAPP_ACCESS_TOKEN"],
      process.env["WHATSAPP_APP_SECRET"],
      process.env["WHATSAPP_PHONE_NUMBER_ID"],
      process.env["WHATSAPP_VERIFY_TOKEN"],
      process.env["WHATSAPP_GRAPH_API_VERSION"],
      businessPhoneNumber,
    ];
    const credentialsConfigured = required.every((value) => !!value?.trim());

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // These tables are service-role-only; generated Supabase types are unchanged.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables are not yet in generated Supabase types
      const db = supabaseAdmin as any;
      const { data, error } = await db
        .from("whatsapp_connections")
        .select("phone_number")
        .eq("user_id", context.userId)
        .is("revoked_at", null)
        .maybeSingle();
      if (error) {
        return { ready: false, businessPhoneNumber: null, connectedPhone: null };
      }
      return {
        ready: credentialsConfigured,
        businessPhoneNumber,
        connectedPhone: data?.phone_number ?? null,
      };
    } catch {
      return { ready: false, businessPhoneNumber: null, connectedPhone: null };
    }
  });
