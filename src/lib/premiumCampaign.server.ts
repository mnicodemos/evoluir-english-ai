// Launch campaign (migrations 0052/0055): every signup from 10/10 to 20/10 gets 10 days
// of Premium. Access itself ends with the entitlements' expires_at; this puts
// the profile's plan (the "Premium" badge) back to free once the period is over,
// unless the student subscribed meanwhile. Runs with the service role, the only
// role allowed to change plans.

type SupabaseAdmin = typeof import("@/integrations/supabase/client.server").supabaseAdmin;

export async function expireCampaignPremium(supabaseAdmin: SupabaseAdmin, now = new Date()) {
  const { data: grants, error } = await supabaseAdmin
    .from("premium_campaign_grants" as never)
    .select("user_id, expires_at")
    .lte("expires_at" as never, now.toISOString() as never);
  if (error) return 0; // Migration not applied yet: nothing to expire.
  const ended = ((grants ?? []) as { user_id: string }[]).map((row) => row.user_id);
  if (!ended.length) return 0;

  const { data: paying } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id, status, current_period_end")
    .in("user_id", ended)
    .in("status", ["active", "trial"]);
  const subscribed = new Set(
    (paying ?? [])
      .filter((row) => !row.current_period_end || new Date(row.current_period_end) > now)
      .map((row) => row.user_id),
  );
  const toFree = ended.filter((id) => !subscribed.has(id));
  if (!toFree.length) return 0;

  const { data: updated } = await supabaseAdmin
    .from("profiles")
    .update({ plan: "free", plan_expires_at: null })
    .in("id", toFree)
    .eq("plan", "premium")
    .lte("plan_expires_at", now.toISOString())
    .select("id");
  return updated?.length ?? 0;
}
