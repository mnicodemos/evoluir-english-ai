import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { storedOfflineUser } from "@/lib/offlineVocabulary";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  pendingMs: 0,
  pendingMinMs: 250,
  pendingComponent: () => (
    <div
      className="dashboard-shell dark flex min-h-[100dvh] bg-background text-foreground"
      aria-busy="true"
      aria-label="Loading page"
      role="status"
    >
      <aside className="hidden w-48 shrink-0 border-r border-white/10 p-3 lg:flex lg:flex-col lg:gap-5">
        <Skeleton className="mb-2 h-9 w-full rounded-xl" />
        <div className="space-y-3">
          {Array.from({ length: 12 }, (_, index) => (
            <Skeleton key={index} className="h-8 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="mt-auto h-20 w-full rounded-xl" />
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-3 p-3 sm:p-5 lg:p-6">
        <header className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-6 w-40 sm:w-56" />
            <Skeleton className="hidden h-4 w-72 sm:block" />
          </div>
          <Skeleton className="h-10 w-28 rounded-full sm:w-44" />
        </header>
        <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
          <Skeleton className="hidden h-28 rounded-xl xl:col-span-4 xl:block" />
          <Skeleton className="hidden h-28 rounded-xl xl:col-span-8 xl:block" />
          <Skeleton className="min-h-48 rounded-xl sm:col-span-2 xl:col-span-9 xl:min-h-[20rem]" />
          <Skeleton className="min-h-40 rounded-xl xl:col-span-3 xl:min-h-[20rem]" />
          <Skeleton className="min-h-40 rounded-xl xl:col-span-5" />
          <Skeleton className="hidden min-h-40 rounded-xl xl:col-span-4 xl:block" />
          <Skeleton className="hidden min-h-40 rounded-xl xl:col-span-3 xl:block" />
        </section>
        <footer className="mt-auto hidden items-center justify-between border-t border-white/10 pt-4 lg:flex">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-64" />
        </footer>
      </main>
      <nav className="fixed inset-x-0 bottom-0 flex h-14 items-center justify-around border-t border-white/10 bg-background px-4 lg:hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="size-7 rounded-lg" />
        ))}
      </nav>
    </div>
  ),
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
