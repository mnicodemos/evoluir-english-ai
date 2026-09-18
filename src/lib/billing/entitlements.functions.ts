import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { activeFeatures, type Entitlement, type Subscription } from "./contracts";

/**
 * Read-only access snapshot for the signed-in user. The database (RLS +
 * has_active_entitlement) stays the single authority: the client can never
 * declare its own plan or status.
 */
export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: subscriptions }, { data: entitlements }] = await Promise.all([
      context.supabase
        .from("subscriptions")
        .select(
          "id, user_id, plan, status, provider, provider_customer_id, provider_subscription_id, started_at, current_period_start, current_period_end, canceled_at",
        )
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("entitlements")
        .select("feature, plan, granted_at, expires_at, revoked_at")
        .eq("user_id", context.userId),
    ]);

    const rows = (entitlements ?? []) as Entitlement[];
    return {
      subscriptions: (subscriptions ?? []) as Subscription[],
      entitlements: rows,
      features: activeFeatures(rows),
    };
  });
