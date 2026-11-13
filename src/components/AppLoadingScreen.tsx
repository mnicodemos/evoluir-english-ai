import { useEffect } from "react";

import symbolLight from "@/assets/evoluir-symbol-light.webp";

// The black logo screen is the app's splash only (product review, 2026-11-13):
// once it has left once in this tab, page changes keep the menu and bars on
// screen and show a quiet loader inside the page instead.
let appBooted = false;

export function isAppBooted() {
  return appBooted;
}

/**
 * Full-screen splash for the first load of signed-in pages (owner request,
 * 2026-11-12): a black screen with the Evoluir+ symbol in the centre. After
 * the first load it renders `InlinePageLoader` instead.
 */
export function AppLoadingScreen() {
  const booted = appBooted;
  useEffect(() => {
    return () => {
      appBooted = true;
    };
  }, []);
  if (booted) return <InlinePageLoader />;
  return (
    <div
      className="dashboard-shell dark fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background text-foreground"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <img
        src={symbolLight}
        alt="Evoluir+ English AI"
        width={255}
        height={512}
        fetchPriority="high"
        className="h-24 w-auto animate-pulse"
      />
      <span className="font-display text-base font-semibold" translate="no">
        Evoluir<span className="text-brand-green">+</span> English AI
      </span>
    </div>
  );
}

/** A thin loader inside the page area: menus and bars stay where they are. */
export function InlinePageLoader() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className="flex min-h-[40vh] flex-1 items-center justify-center"
    >
      <span className="size-6 animate-spin rounded-full border-2 border-white/10 border-t-brand-green" />
    </div>
  );
}
