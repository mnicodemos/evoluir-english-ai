import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Crown, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/useProfile";
import { createStripeCheckoutSession } from "@/lib/billing/checkout.functions";
import { getMyAccess } from "@/lib/billing/entitlements.functions";
import { createStripePortalSession } from "@/lib/billing/portal.functions";
import { buildSubscriptionView } from "@/lib/billing/subscriptionView";

export const Route = createFileRoute("/_authenticated/premium")({
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · Premium" },
      {
        name: "description",
        content:
          "Unlock unlimited AI Talking, pronunciation and audio lessons with Evoluir+ English AI Premium.",
      },
      { property: "og:title", content: "Evoluir+ English AI · Premium" },
      {
        property: "og:description",
        content: "Unlimited AI Talking, pronunciation and audio lessons.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Premium,
});

const premiumPerks = [
  "Unlimited AI Talking sessions, every day",
  "Unlimited writing corrections",
  "Advanced weekly progress reports",
  "Personalised study plan for your goal",
  "Priority access to pronunciation & audio lessons",
  "Priority support",
];

const freePerks = [
  "3 AI Talking sessions per day",
  "3 writing corrections per day",
  "Vocabulary builder",
  "Basic progress",
];

const plans = [
  {
    id: "monthly" as const,
    name: "Monthly",
    price: "R$ 79,90",
    period: "/month",
    note: "Cancel any time",
  },
  {
    id: "yearly" as const,
    name: "Yearly",
    price: "R$ 799,90",
    period: "/year",
    note: "2 months free — R$ 66,66/month",
    highlight: true,
  },
];

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  trial: "Trial",
  canceled: "Canceled",
  expired: "Inactive",
  payment_failed: "Payment pending",
  refunded: "Refunded",
};

function Premium() {
  const { data: profile, isLoading } = useProfile();
  const fetchAccess = useServerFn(getMyAccess);
  const { data: access } = useQuery({
    queryKey: ["my-access"],
    queryFn: () => fetchAccess(),
  });
  const [selected, setSelected] = useState<"monthly" | "yearly">("yearly");
  const [starting, setStarting] = useState(false);
  const [opening, setOpening] = useState(false);
  const startCheckout = useServerFn(createStripeCheckoutSession);
  const openPortal = useServerFn(createStripePortalSession);

  // Server/database authority: Premium comes from valid entitlements only.
  const view = access ? buildSubscriptionView(access) : null;
  const isPremium = view ? view.plan === "premium" : profile?.plan === "premium";

  async function goToCheckout() {
    if (starting) return;
    setStarting(true);
    try {
      const { url } = await startCheckout({ data: { interval: selected } });
      window.location.href = url;
    } catch {
      setStarting(false);
      toast.error("We could not open the secure checkout", {
        description: "Please try again in a moment.",
      });
    }
  }

  async function goToPortal() {
    if (opening) return;
    setOpening(true);
    try {
      const { url } = await openPortal({ data: undefined });
      if (!url) {
        setOpening(false);
        toast.error("No billing account found yet", {
          description: "Start a subscription to manage it here.",
        });
        return;
      }
      window.location.href = url;
    } catch {
      setOpening(false);
      toast.error("We could not open your subscription management", {
        description: "Please try again in a moment.",
      });
    }
  }

  return (
    <AppShell>
      {isLoading || !profile ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="space-y-8">
          <header className="animate-rise">
            <p className="text-sm text-muted-foreground">Your plan</p>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <Crown className="size-7 text-[oklch(0.78_0.18_82)]" /> Premium
            </h1>
          </header>

          <section className="card-soft p-6">
            <h2 className="text-lg font-semibold">My subscription</h2>
            {!view ? (
              <Skeleton className="mt-4 h-24 w-full" />
            ) : (
              <>
                <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Plan</dt>
                    <dd className="font-medium">{view.plan === "premium" ? "Premium" : "Free"}</dd>
                  </div>
                  {view.interval && (
                    <div>
                      <dt className="text-muted-foreground">Billing period</dt>
                      <dd className="font-medium">
                        {view.interval === "monthly" ? "Monthly" : "Yearly"}
                      </dd>
                    </div>
                  )}
                  {view.status && (
                    <div>
                      <dt className="text-muted-foreground">Status</dt>
                      <dd className="font-medium">{STATUS_LABEL[view.status] ?? "Inactive"}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-muted-foreground">Premium access</dt>
                    <dd className="font-medium">
                      {view.plan === "premium"
                        ? view.accessUntil
                          ? `Active until ${new Date(view.accessUntil).toLocaleDateString()}`
                          : "Active"
                        : "Not active"}
                    </dd>
                  </div>
                </dl>

                {view.canceledButActive && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Your subscription was canceled and your Premium access stays available until the
                    end of the period you already paid for.
                  </p>
                )}
                {view.status === "payment_failed" && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Your last payment did not go through. Update your payment details to keep
                    Premium.
                  </p>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  {view.canManage ? (
                    <Button variant="outline" disabled={opening} onClick={goToPortal}>
                      {opening ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <ExternalLink className="mr-2 size-4" />
                      )}
                      Manage subscription
                    </Button>
                  ) : (
                    view.plan === "free" && (
                      <Button variant="outline" onClick={goToCheckout} disabled={starting}>
                        {starting && <Loader2 className="mr-2 size-4 animate-spin" />}
                        Discover Premium
                      </Button>
                    )
                  )}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Changes and cancellations are handled by Stripe and applied here automatically.
                </p>
              </>
            )}
          </section>

          {isPremium ? (
            <section className="card-soft bg-primary p-6 text-primary-foreground">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-medium">
                <Sparkles className="size-3.5" /> Premium active
              </span>
              <h2 className="mt-4 text-xl font-semibold">
                You have full access, {profile.name || "student"}.
              </h2>
              <p className="mt-2 text-sm text-primary-foreground/75">
                {profile.plan_interval === "monthly"
                  ? "Monthly plan — R$ 79,90/month"
                  : "Yearly plan — R$ 799,90/year"}
                {profile.plan_expires_at
                  ? ` · renews on ${new Date(profile.plan_expires_at).toLocaleDateString()}`
                  : ""}
              </p>
              <ul className="mt-5 grid gap-2 text-sm text-primary-foreground/85 sm:grid-cols-2">
                {premiumPerks.map((p) => (
                  <li key={p} className="flex items-center gap-2">
                    <Check className="size-4 text-success" /> {p}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <>
              <section className="grid gap-5 sm:grid-cols-2">
                {plans.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected(p.id)}
                    className={`card-soft p-6 text-left transition-shadow hover:shadow-[var(--shadow-lift)] ${
                      selected === p.id ? "ring-2 ring-[oklch(0.6_0.14_158)]" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold">{p.name}</h2>
                      {p.highlight && (
                        <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-foreground">
                          Best value
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-3xl font-bold">
                      {p.price}
                      <span className="text-base font-medium text-muted-foreground">
                        {p.period}
                      </span>
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">{p.note}</p>
                  </button>
                ))}
              </section>

              <section className="card-soft p-6">
                <h2 className="text-lg font-semibold">What you get with Premium</h2>
                <div className="mt-5 grid gap-6 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Free</p>
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {freePerks.map((f) => (
                        <li key={f} className="flex items-center gap-2">
                          <Check className="size-4" /> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Premium</p>
                    <ul className="mt-3 space-y-2 text-sm">
                      {premiumPerks.map((f) => (
                        <li key={f} className="flex items-center gap-2">
                          <Check className="size-4 text-[oklch(0.6_0.14_158)]" /> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <Button
                  className="mt-7 w-full sm:w-auto"
                  size="lg"
                  disabled={starting}
                  onClick={goToCheckout}
                >
                  {starting && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {starting
                    ? "Opening secure checkout…"
                    : `Go Premium — ${selected === "yearly" ? "R$ 799,90/year" : "R$ 79,90/month"}`}
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">
                  Secure payment is processed by Stripe. Your card details never reach Evoluir+.
                </p>
              </section>
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}
