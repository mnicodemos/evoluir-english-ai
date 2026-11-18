import { createFileRoute } from "@tanstack/react-router";
import { keepAlive } from "@/lib/keepAlive.server";
import { profileIsPremium } from "@/lib/billing/subscriptionView";
import { nextReactivationMilestone, reactivationIdempotencyKey, type ReactivationCandidate } from "@/lib/reactivationCampaign";
import { createReactivationUnsubscribeToken } from "@/lib/reactivationUnsubscribe.server";
import { studyToday } from "@/lib/today";

async function matchesSecret(provided: string, expected: string) {
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

function daysBetween(today: string, lastActivity: string) {
  const todayUtc = Date.parse(`${today}T00:00:00Z`);
  const lastUtc = Date.parse(`${lastActivity}T00:00:00Z`);
  return Math.floor((todayUtc - lastUtc) / 86_400_000);
}

export const Route = createFileRoute("/api/public/cron/reactivation-emails")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const provided = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
        const { data: keyRow } = await supabaseAdmin.from("push_cron_key").select("key").eq("id", 1).maybeSingle();
        if (!provided || !keyRow?.key || !(await matchesSecret(provided, keyRow.key))) return new Response("Unauthorized", { status: 401 });
        return keepAlive(runReactivationCampaign(supabaseAdmin));
      },
    },
  },
});

async function runReactivationCampaign(supabaseAdmin: typeof import("@/integrations/supabase/client.server").supabaseAdmin) {
  const today = studyToday();
  const oldest = new Date(Date.parse(`${today}T00:00:00-03:00`) - 30 * 86_400_000).toISOString();
  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id,name,email,plan,plan_expires_at,last_activity_date")
    .not("last_activity_date", "is", null)
    .lte("last_activity_date", new Date(Date.parse(`${today}T00:00:00Z`) - 2 * 86_400_000).toISOString().slice(0, 10))
    .gte("last_activity_date", new Date(Date.parse(`${today}T00:00:00Z`) - 365 * 86_400_000).toISOString().slice(0, 10))
    .limit(2000);
  if (error) throw new Error(`Could not load reactivation candidates: ${error.message}`);
  const rows = profiles ?? [];
  if (!rows.length) return Response.json({ processed: 0, sent: 0, failed: 0, skipped: 0 });

  const ids = rows.map((row) => row.id);
  const [{ data: preferences, error: preferencesError }, { data: entitlements, error: entitlementsError }, authUsers] = await Promise.all([
    supabaseAdmin.from("learning_profile").select("user_id,learning_preferences").in("user_id", ids),
    supabaseAdmin.from("entitlements").select("user_id,expires_at,revoked_at").in("user_id", ids).eq("plan", "premium"),
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  if (preferencesError) throw new Error(`Could not load email preferences: ${preferencesError.message}`);
  if (entitlementsError) throw new Error(`Could not load Premium entitlements: ${entitlementsError.message}`);
  const optedIn = new Set((preferences ?? []).filter((row) => {
    const prefs = row.learning_preferences && typeof row.learning_preferences === "object" && !Array.isArray(row.learning_preferences)
      ? row.learning_preferences as Record<string, unknown> : {};
    return prefs["reactivation_email_opt_in"] === true;
  }).map((row) => row.user_id));
  const activePremium = new Set((entitlements ?? []).filter((row) => !row.revoked_at && (!row.expires_at || new Date(row.expires_at) > new Date())).map((row) => row.user_id));
  const authById = new Map((authUsers.data?.users ?? []).map((user) => [user.id, user]));
  const { sendMarketingEmail } = await import("@/lib/email-templates/send-marketing-email");
  const { data: delivered, error: deliveredError } = await supabaseAdmin.from("reactivation_email_deliveries").select("user_id,milestone_days,inactivity_cycle_key,status").in("user_id", ids);
  if (deliveredError) throw new Error(`Could not load reactivation delivery history: ${deliveredError.message}`);
  const history = new Map<string, number[]>();
  for (const row of delivered ?? []) {
    if (["sent", "delivered", "opened", "clicked", "pending"].includes(row.status)) {
      history.set(row.user_id, [...(history.get(row.user_id) ?? []), row.milestone_days]);
    }
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const profile of rows) {
    const authUser = authById.get(profile.id);
    const email = profile.email || authUser?.email || "";
    const lastActivityAt = profile.last_activity_date;
    if (!email || !lastActivityAt || !optedIn.has(profile.id) || activePremium.has(profile.id) || profileIsPremium(profile)) { skipped++; continue; }
    const inactivityDays = daysBetween(today, lastActivityAt);
    const candidate: ReactivationCandidate = { userId: profile.id, lastActivityAt, inactivityDays, isPremium: false };
    if (inactivityDays < 2 || !Number.isFinite(inactivityDays)) { skipped++; continue; }
    const milestone = nextReactivationMilestone(inactivityDays, history.get(profile.id) ?? []);
    if (!milestone) { skipped++; continue; }
    const idempotencyKey = reactivationIdempotencyKey(profile.id, lastActivityAt, milestone);
    const unsubscribeToken = createReactivationUnsubscribeToken(profile.id);
    const unsubscribeUrl = `https://evoluirmaisenglishai.com/api/public/reactivation-unsubscribe?user=${encodeURIComponent(profile.id)}&token=${unsubscribeToken}`;
    const { error: reserveError } = await supabaseAdmin.from("reactivation_email_deliveries").insert({
      user_id: profile.id,
      milestone_days: milestone,
      inactivity_cycle_key: idempotencyKey,
      status: "pending",
      recipient_email: email,
      scheduled_at: new Date().toISOString(),
    });
    if (reserveError) {
      if (reserveError.code === "23505") { skipped++; continue; }
      failed++;
      console.error("reactivation-email: could not reserve delivery", reserveError.message);
      continue;
    }
    try {
      const result = await sendMarketingEmail("reactivation", email, {
        idempotencyKey,
        templateData: { studentName: profile.name ?? "", milestoneDays: milestone, unsubscribeUrl },
      });
      const { error: updateError } = await supabaseAdmin.from("reactivation_email_deliveries").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        provider_message_id: result.messageId,
        updated_at: new Date().toISOString(),
      }).eq("inactivity_cycle_key", idempotencyKey);
      if (updateError) throw updateError;
      history.set(profile.id, [...(history.get(profile.id) ?? []), milestone]);
      sent++;
    } catch (sendError) {
      failed++;
      await supabaseAdmin.from("reactivation_email_deliveries").update({
        status: "failed",
        last_error: (sendError instanceof Error ? sendError.message : String(sendError)).slice(0, 500),
        updated_at: new Date().toISOString(),
      }).eq("inactivity_cycle_key", idempotencyKey);
    }
  }
  return Response.json({ processed: rows.length, sent, failed, skipped, evaluated_at: new Date().toISOString() });
}
