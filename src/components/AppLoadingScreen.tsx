import symbolLight from "@/assets/evoluir-symbol-light.webp";

/**
 * Full-screen loading state for signed-in pages (owner request, 2026-11-12):
 * a black screen with the Evoluir+ symbol in the centre instead of empty
 * placeholder blocks.
 */
export function AppLoadingScreen() {
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
