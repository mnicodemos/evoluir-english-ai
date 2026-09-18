import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, Crown } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/billing-success")({
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · Payment received" },
      {
        name: "description",
        content: "Your payment was received and your Premium access is being confirmed.",
      },
      { property: "og:title", content: "Evoluir+ English AI · Payment received" },
      { property: "og:description", content: "Your Premium access is being confirmed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BillingSuccess,
});

function BillingSuccess() {
  return (
    <AppShell>
      <div className="mx-auto max-w-xl space-y-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Crown className="size-7" />
        </div>
        <h1 className="text-2xl font-bold">Payment received</h1>
        <p className="text-muted-foreground">
          We received your payment and your Premium access is being processed. This usually takes a
          few seconds — your plan updates automatically as soon as the confirmation arrives.
        </p>
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Clock className="size-4" /> Processing in progress
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/premium">View my plan</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
