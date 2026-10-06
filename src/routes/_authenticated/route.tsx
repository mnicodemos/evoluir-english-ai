import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { storedOfflineUser } from "@/lib/offlineVocabulary";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  // The session saved on the device is enough to show the app: no network
  // round trip before the first screen or on every page change. Every server
  // function still verifies the user itself (requireSupabaseAuth), and an
  // expired session is refreshed by the client or ends in a sign-out.
  beforeLoad: async (): Promise<{ user: { id: string } }> => {
    // Offline, an expired session cannot be refreshed (and trying waits on the
    // network); the account saved on the device opens the app so saved words
    // stay readable. Nothing here reaches the server, which keeps verifying
    // every request on its own.
    if (!navigator.onLine) {
      const offlineUser = storedOfflineUser(window.localStorage);
      if (offlineUser) return { user: offlineUser };
    }
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: () => <Outlet />,
});
