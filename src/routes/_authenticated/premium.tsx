import { createFileRoute } from "@tanstack/react-router";
import { Check, Crown, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/useProfile";

export const Route = createFileRoute("/_authenticated/premium")({
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · Premium" },
      {
        name: "description",
        content: "Unlock unlimited AI Talking, pronunciation and audio lessons with Evoluir+ English AI Premium.",
      },
      { property: "og:title", content: "Evoluir+ English AI · Premium" },
      { property: "og:description", content: "Unlimited AI Talking, pronunciation and audio lessons." },
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

const freePerks = ["3 AI Talking sessions per day", "3 writing corrections per day", "Vocabulary builder", "Basic progress"];

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

function Premium() {
  const { data: profile, isLoading } = useProfile();
  const [selected, setSelected] = useState<"monthly" | "yearly">("yearly");
  const isPremium = profile?.plan === "premium";

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
              <Crown className="size-7 text-[oklch(0.72_0.15_85)]" /> Premium
            </h1>
          </header>

          {isPremium ? (
            <section className="card-soft bg-primary p-6 text-primary-foreground">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-medium">
                <Sparkles className="size-3.5" /> Premium active
              </span>
              <h2 className="mt-4 text-xl font-semibold">
                You have full access, {profile.name || "student"}.
              </h2>
              <p className="mt-2 text-sm text-primary-foreground/75">
                {profile.plan_interval === "monthly" ? "Monthly plan — R$ 79,90/month" : "Yearly plan — R$ 799,90/year"}
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
                      <span className="text-base font-medium text-muted-foreground">{p.period}</span>
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
                  onClick={() =>
                    toast.info("Checkout is opening soon", {
                      description:
                        selected === "yearly"
                          ? "Yearly plan R$ 799,90 — secure payment will be available shortly."
                          : "Monthly plan R$ 79,90 — secure payment will be available shortly.",
                    })
                  }
                >
                  Go Premium — {selected === "yearly" ? "R$ 799,90/year" : "R$ 79,90/month"}
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">
                  Secure payment is being finalised. You will be able to pay by card or Pix.
                </p>
              </section>
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}
