// Launch campaign journey, read with the service role: the campaign grant
// (premium_campaign_grants is service-only) and the student's AI Speaking
// answers since signing up. Shared by the Dashboard and the evening push.

import { journeyDay } from "@/lib/campaignJourney";

type SupabaseAdmin = typeof import("@/integrations/supabase/client.server").supabaseAdmin;

export type JourneyState = { day: number; conversations: number; expiresAt: string };

/** Journey day and conversation count per student, for those in the journey. */
export async function loadJourneyStates(
  supabaseAdmin: SupabaseAdmin,
  userIds: string[],
  now = new Date(),
): Promise<Map<string, JourneyState>> {
  const states = new Map<string, JourneyState>();
  if (userIds.length === 0) return states;
  const { data: grants, error } = await supabaseAdmin
    .from("premium_campaign_grants" as never)
    .select("user_id, granted_at, expires_at")
    .in("user_id" as never, userIds as never);
  if (error) return states; // Campaign tables not there: no journey.
  const rows = (grants ?? []) as unknown as {
    user_id: string;
    granted_at: string;
    expires_at: string;
  }[];
  await Promise.all(
    rows.map(async (grant) => {
      const day = journeyDay(grant.granted_at, grant.expires_at, now);
      if (day === null) return;
      const { count } = await supabaseAdmin
        .from("ai_usage_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", grant.user_id)
        .eq("operation", "talking")
        .eq("status", "completed")
        .not("first_chunk_ms", "is", null)
        .gte("created_at", grant.granted_at);
      states.set(grant.user_id, {
        day,
        conversations: count ?? 0,
        expiresAt: grant.expires_at,
      });
    }),
  );
  return states;
}
