import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** The signed-in student's launch-campaign journey day, or null outside it. */
export const loadCampaignJourney = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadJourneyStates } = await import("@/lib/premiumJourney.server");
    const states = await loadJourneyStates(supabaseAdmin, [context.userId]);
    return states.get(context.userId) ?? null;
  });
