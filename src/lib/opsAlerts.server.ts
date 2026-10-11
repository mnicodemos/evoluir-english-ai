// Loads the data behind the failure alerts and notifies the admins. Admins are
// decided by user_roles (role "admin"), never by email.

import type { supabaseAdmin as SupabaseAdminClient } from "@/integrations/supabase/client.server";
import { adminAlertPush, opsAlerts } from "@/lib/opsAlerts";
import { serverErrorAlerts } from "@/lib/serverErrors";

type SupabaseAdmin = typeof SupabaseAdminClient;

export async function loadOpsAlerts(
  supabaseAdmin: SupabaseAdmin,
  now = new Date(),
  /** The Admin view also checks the product goals; the morning push does not. */
  options: { includeProduct?: boolean } = {},
) {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const [runs, calls, serverErrors] = await Promise.all([
    supabaseAdmin
      .from("push_runs")
      .select("kind, created_at, devices, sent, failed, removed, error, duration_ms")
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("ai_usage_events")
      .select("operation, created_at, success, status, error_code, error_message")
      .gte("created_at", since)
      .limit(5000),
    supabaseAdmin
      .from("server_errors")
      .select("area, message, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);
  // A missing table (migration not applied yet) must not break the Admin.
  const pushRuns = runs.error ? [] : (runs.data ?? []);
  const alerts = [
    ...opsAlerts({ pushRuns, aiCalls: calls.data ?? [], now }),
    // Until migration 0062 is applied the read fails and this stays empty.
    ...serverErrorAlerts(serverErrors.error ? [] : (serverErrors.data ?? []), now),
  ].sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1));
  if (runs.error) {
    alerts.unshift({
      level: "warning",
      area: "push",
      title: "Registro de pushes indisponível",
      detail: "Aplique a migração 0049_push_runs pelo chat do Lovable.",
    });
  }
  if (options.includeProduct) {
    const { loadRetention, loadSpeakingWait } = await import("@/lib/productMetrics.server");
    const { productAlerts } = await import("@/lib/productAlerts");
    // A failed read must not hide the push and AI alerts above.
    const [retention, speakingWait] = await Promise.all([
      loadRetention(supabaseAdmin).catch(() => null),
      loadSpeakingWait(supabaseAdmin).catch(() => null),
    ]);
    alerts.push(
      ...productAlerts({
        speakingWait,
        ...(retention
          ? { d1: retention.d1, firstDayTalk: retention.firstConversation?.firstDay ?? null }
          : {}),
      }),
    );
  }
  return { alerts, recentRuns: pushRuns.slice(0, 6) };
}

/** Sends the admins one push when an alert needs attention. */
export async function alertAdmins(supabaseAdmin: SupabaseAdmin) {
  const { alerts } = await loadOpsAlerts(supabaseAdmin);
  const message = adminAlertPush(alerts);
  if (!message) return { sent: 0 };

  const { data: admins } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  const adminIds = (admins ?? []).map((row) => row.user_id);
  if (adminIds.length === 0) return { sent: 0 };

  const { fcmCredentials, sendFcm } = await import("@/lib/fcm.server");
  const credentials = fcmCredentials();
  if (!credentials) return { sent: 0 };
  const { data: tokens } = await supabaseAdmin
    .from("push_tokens")
    .select("token")
    .in("user_id", adminIds);
  let sent = 0;
  for (const { token } of tokens ?? []) {
    const result = await sendFcm(credentials, token, message, "admin alert FCM");
    if (result.ok) sent += 1;
  }
  return { sent };
}
