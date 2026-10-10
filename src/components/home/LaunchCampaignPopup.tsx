import { Link } from "@tanstack/react-router";
import { ArrowRight, Crown } from "lucide-react";
import { useEffect, useState } from "react";

import launchArt from "@/assets/home/launch-10-10.webp";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  campaignDaysLeft,
  campaignLastDay,
  campaignOpen,
  type CampaignStatus,
} from "@/lib/campaignCopy";
import { bumpLandingStat } from "@/lib/landingStats";
import { readStorage, writeStorage } from "@/lib/safeStorage";

const SEEN_KEY = "evoluir-launch-popup-seen";

/**
 * Hero badge for the same campaign: stays on the page after the popup is
 * closed, and disappears once the signup period ends.
 */
export function LaunchCampaignBadge({ className = "" }: { className?: string }) {
  const [status, setStatus] = useState<CampaignStatus | null>(null);
  useEffect(() => {
    let cancelled = false;
    void supabase.rpc("premium_campaign_status").then(({ data, error }) => {
      if (cancelled || error || !data) return;
      setStatus(data as unknown as CampaignStatus);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!campaignOpen(status)) return null;
  const lastDay = campaignLastDay(status?.ends_at);
  return (
    <Link
      to="/auth"
      search={{ mode: "signup" }}
      onClick={() => bumpLandingStat("signup_click")}
      className={`inline-flex items-center gap-2 rounded-full border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning transition-colors hover:bg-warning/20 ${className}`}
    >
      <Crown className="size-3.5 shrink-0" aria-hidden="true" />
      Lançamento: {status?.days ?? 10} dias de Premium grátis
      {lastDay ? ` · cadastros até ${lastDay}` : ""}
    </Link>
  );
}

/**
 * Public site: announces the launch campaign (migrations 0052/0055): every
 * signup in the period (10/10 to 20/10) gets Premium for 10 days. Shown once
 * per browser, as soon as the page opens (user request), with the owner's
 * 10/10 art; it stops once the period ends and the database reports the
 * campaign inactive.
 */
export function LaunchCampaignPopup() {
  const [status, setStatus] = useState<CampaignStatus | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (readStorage(SEEN_KEY) === "1") return;
    let cancelled = false;
    // Opens as soon as the campaign status arrives (user request: right away).
    void supabase.rpc("premium_campaign_status").then(({ data, error }) => {
      if (cancelled || error || !data) return;
      const result = data as unknown as CampaignStatus;
      if (!campaignOpen(result)) return;
      setStatus(result);
      setOpen(true);
      writeStorage(SEEN_KEY, "1");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) return null;
  const days = status.days ?? 10;
  const lastDay = campaignLastDay(status.ends_at) ?? "20/10";
  const daysLeft = campaignDaysLeft(status.ends_at);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="dashboard-shell brand-dashboard-theme dark w-[calc(100%-2rem)] max-w-sm gap-0 overflow-hidden rounded-2xl border-[oklch(0.65_0.25_350)]/50 bg-card p-0 text-foreground [&>button]:rounded-full [&>button]:bg-black/55 [&>button]:p-1 [&>button]:text-white [&>button]:opacity-100">
        {/* The owner's campaign artwork (Outubro Rosa palette, EVO), shown whole:
            it already states the rule; the live count and the button sit below. */}
        <img
          src={launchArt}
          alt=""
          width={640}
          height={845}
          className="block max-h-[58svh] w-full bg-black object-contain"
        />
        <div className="space-y-3 p-4">
          <DialogTitle className="sr-only">
            {days} dias de Premium para quem se cadastrar até {lastDay}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-foreground">
            Cadastre-se de 10/10 a {lastDay} e ganhe {days} dias de Premium. Sem cartão: no fim,
            você escolhe se continua no grátis ou assina.
          </DialogDescription>

          {daysLeft !== null && daysLeft > 0 && (
            <p className="text-sm font-semibold text-[oklch(0.72_0.2_350)]">
              {daysLeft === 1
                ? "Último dia para garantir!"
                : `Faltam ${daysLeft} dias para garantir`}
            </p>
          )}

          <Button
            asChild
            size="lg"
            className="w-full bg-[oklch(0.65_0.25_350)] text-white hover:bg-[oklch(0.6_0.25_350)]"
          >
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              onClick={() => {
                bumpLandingStat("signup_click");
                setOpen(false);
              }}
            >
              Quero meu Premium <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
