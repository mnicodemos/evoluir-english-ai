import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";

/** Keep shell registration mounted while a story's checkpoint resolves. */
export function AdventureLoading() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl space-y-5" aria-busy="true">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </AppShell>
  );
}
