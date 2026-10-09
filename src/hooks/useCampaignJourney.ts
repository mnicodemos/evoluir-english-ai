import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { journeyMessage } from "@/lib/campaignJourney";
import { loadCampaignJourney } from "@/lib/campaignJourney.functions";

/** The signed-in student's journey day (launch campaign), shared by every caller. */
export function useCampaignJourney() {
  const load = useServerFn(loadCampaignJourney);
  const { data } = useQuery({
    queryKey: ["campaign-journey"],
    queryFn: () => load(),
    staleTime: 10 * 60 * 1000,
  });
  if (!data) return null;
  const message = journeyMessage(data.day, data.conversations);
  return message ? { ...data, message } : null;
}
