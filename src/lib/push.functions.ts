import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { isStaleTokenResponse } from "./pushStaleToken";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

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
    return { ok: true };
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

    const lovableKey = process.env["LOVABLE_API_KEY"];
    const connectionKey = process.env["FIREBASE_MESSAGING_API_KEY"];
    if (!lovableKey || !connectionKey) {
      throw new Error("Push credentials are not configured");
    }

    const headers = {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      "Content-Type": "application/json",
    };

    let sent = 0;
    const staleTokens: string[] = [];
    for (const row of rows) {
      const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: {
            token: row.token,
            notification: { title: data.title, body: data.body },
            data: data.path ? { path: data.path } : undefined,
          },
        }),
      });
      if (res.ok) {
        sent += 1;
        continue;
      }
      const body = await res.text();
      console.error(`FCM send failed [${res.status}]: ${body}`);
      // Stale device token: remove it instead of retrying forever.
      if (isStaleTokenResponse(res.status, body)) staleTokens.push(row.token);
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
