import { newShortPush, type NewShortPushResult } from "@/lib/newShortPush";

/**
 * Sends the "new short" push to every student of the level with a device
 * registered (owner request, 2026-10-31: each short published notifies the
 * students). Students are read by their current level; tokens that FCM calls
 * stale are removed, as the daily push does. Never throws: the short is
 * already saved, so a failed push is only logged.
 */
export async function notifyNewShort(
  level: string,
  videoTitle: string,
): Promise<NewShortPushResult> {
  const empty = { students: 0, devices: 0, sent: 0 };
  try {
    const { fcmCredentials, sendFcm } = await import("@/lib/fcm.server");
    const credentials = fcmCredentials();
    if (!credentials) {
      console.error("New short push skipped: FCM credentials are missing");
      return { ...empty, problem: "as credenciais do Firebase (FCM) não estão configuradas" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { profileIsPremium } = await import("@/lib/billing/subscriptionView");

    const premium = new Map<string, boolean>();
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("id, plan, plan_expires_at")
        .in("level", [level, level.toUpperCase()])
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) premium.set(row.id, profileIsPremium(row));
      if (!data || data.length < PAGE) break;
    }
    const ids = [...premium.keys()];
    const tokens: { user_id: string; token: string }[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabaseAdmin
        .from("push_tokens")
        .select("user_id, token")
        .in("user_id", ids.slice(i, i + 200));
      if (error) throw new Error(error.message);
      tokens.push(...(data ?? []));
    }

    let sent = 0;
    const stale: string[] = [];
    let next = 0;
    const worker = async () => {
      while (next < tokens.length) {
        const item = tokens[next++]!;
        const message = newShortPush(videoTitle, premium.get(item.user_id) ?? false);
        const result = await sendFcm(credentials, item.token, message, "new short FCM");
        if (result.ok) sent += 1;
        else if (result.stale) stale.push(item.token);
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, tokens.length) }, worker));
    if (stale.length) await supabaseAdmin.from("push_tokens").delete().in("token", stale);
    if (tokens.length > 0 && sent === 0)
      console.error(`New short push reached no device (${tokens.length} tried)`);
    return { students: ids.length, devices: tokens.length, sent, problem: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error(`New short push failed: ${message}`);
    return { ...empty, problem: `erro ao enviar (${message.slice(0, 120)})` };
  }
}
