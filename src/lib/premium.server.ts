/** Premium as the database decides it (Stripe or launch campaign entitlements). */
export async function hasPremium(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const features = ["ai_talking", "ai_teacher", "writing_correction", "advanced_reports"];
  const checks = await Promise.all(
    features.map((feature) =>
      supabaseAdmin.rpc("has_active_entitlement", { _user_id: userId, _feature: feature }),
    ),
  );
  return checks.some((check) => check.data === true);
}
