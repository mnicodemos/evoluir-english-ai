import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useLifeSessionUserId } from "@/hooks/useLifeSessionUserId";
import { loadPlus } from "@/lib/plus.functions";
import { useUiLang } from "@/lib/uiLang";

/** Shared goal read: the Home starts it while the profile skeleton is visible. */
export function usePlus() {
  const sessionUserId = useLifeSessionUserId();
  const { lang } = useUiLang();
  const load = useServerFn(loadPlus);

  return useQuery({
    queryKey: ["plus", sessionUserId ?? null, lang],
    enabled: !!sessionUserId,
    queryFn: () => load({ data: { lang } }),
    staleTime: 30 * 1000,
  });
}