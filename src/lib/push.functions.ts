import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Saves (or refreshes) this device's push token for the signed-in user. */
export const registerPushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ token: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_tokens").upsert(
      {
        user_id: context.userId,
        token: data.token,
        platform: "web",
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,token" },
    );
    if (error) throw new Error(error.message);
    // A token FCM no longer knows (e.g. the browser dropped its push
    // subscription) would look registered but never deliver: check it now, drop
    // it, and tell the device to create a fresh one.
    const { fcmCredentials, validateFcmToken } = await import("./fcm.server");
    const credentials = fcmCredentials();
    if (credentials && !(await validateFcmToken(credentials, data.token)).valid) {
      await context.supabase
        .from("push_tokens")
        .delete()
        .eq("user_id", context.userId)
        .eq("token", data.token);
      return { ok: true, valid: false };
    }
    return { ok: true, valid: true };
  });

/** Removes this device's push token (user turned notifications off). */
export const unregisterPushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ token: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("push_tokens")
      .delete()
      .eq("user_id", context.userId)
      .eq("token", data.token);
    return { ok: true };
  });

/**
 * Sends a push notification to every registered device of the signed-in user.
 * Used to warn about new activities (new lessons, vocabulary batch, etc.).
 */
export const sendActivityPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        title: z.string().min(1).max(120),
        body: z.string().min(1).max(300),
        path: z.string().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("push_tokens")
      .select("token")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return { sent: 0 };

    const { fcmCredentials, sendFcm } = await import("./fcm.server");
    const credentials = fcmCredentials();
    if (!credentials) throw new Error("Push credentials are not configured");

    let sent = 0;
    const staleTokens: string[] = [];
    for (const row of rows) {
      const result = await sendFcm(credentials, row.token, data);
      if (result.ok) sent += 1;
      // Stale device token: remove it instead of retrying forever.
      else if (result.stale) staleTokens.push(row.token);
    }

    if (staleTokens.length > 0) {
      await context.supabase
        .from("push_tokens")
        .delete()
        .eq("user_id", context.userId)
        .in("token", staleTokens);
    }

    return { sent };
  });
