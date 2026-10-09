import { Link } from "@tanstack/react-router";
import { ArrowRight, Crown } from "lucide-react";
import { useEffect, useState } from "react";

import launchArt from "@/assets/home/launch-10-10.webp";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { bumpLandingStat } from "@/lib/landingStats";
import { readStorage, writeStorage } from "@/lib/safeStorage";

type CampaignStatus = {
  active: boolean;
  slots?: number;
  slots_left?: number;
  days?: number;
};

const SEEN_KEY = "evoluir-launch-popup-seen";

/**
 * Hero badge for the same campaign: stays on the page after the popup is
 * closed, and disappears once the database reports no places left.
 */
export function LaunchCampaignBadge({ className = "" }: { className?: string }) {
  const [status, setStatus] = useState<CampaignStatus | null>(null);
  useEffect(() => {
    let cancelled = false;
    void supabase.rpc("premium_campaign_status" as never).then(({ data, error }) => {
      if (cancelled || error || !data) return;
      setStatus(data as unknown as CampaignStatus);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!status?.active || !status.slots_left) return null;
  const left = status.slots_left;
  return (
    <Link
      to="/auth"
      search={{ mode: "signup" }}
      onClick={() => bumpLandingStat("signup_click")}
      className={`inline-flex items-center gap-2 rounded-full border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning transition-colors hover:bg-warning/20 ${className}`}
    >
      <Crown className="size-3.5 shrink-0" aria-hidden="true" />
      Lançamento: {status.days ?? 10} dias de Premium grátis ·{" "}
      {left === 1 ? "resta 1 vaga" : `restam ${left} vagas`}
    </Link>
  );
}

/**
 * Public site: announces the launch campaign (migration 0052) while it still
 * has places: the first signups get Premium for a few days. Shown once per
 * browser, as soon as the page opens (user request), with the owner's 10/10 art; it disappears for good once every
 * place is taken, because the database then reports the campaign inactive.
 */
export function LaunchCampaignPopup() {
  const [status, setStatus] = useState<CampaignStatus | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (readStorage(SEEN_KEY) === "1") return;
    let cancelled = false;
    // Opens as soon as the campaign status arrives (user request: right away).
    void supabase.rpc("premium_campaign_status" as never).then(({ data, error }) => {
      if (cancelled || error || !data) return;
      const result = data as unknown as CampaignStatus;
      if (!result.active || !result.slots_left) return;
      setStatus(result);
      setOpen(true);
      writeStorage(SEEN_KEY, "1");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) return null;
  const slots = status.slots ?? 10;
  const left = status.slots_left ?? 0;
  const days = status.days ?? 10;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="dashboard-shell brand-dashboard-theme dark w-[calc(100%-2rem)] max-w-sm gap-0 overflow-hidden rounded-2xl border-[oklch(0.65_0.25_350)]/50 bg-card p-0 text-foreground [&>button]:rounded-full [&>button]:bg-black/55 [&>button]:p-1 [&>button]:text-white [&>button]:opacity-100">
        {/* The owner's campaign artwork (Outubro Rosa palette, EVO), shown whole:
            it already states the rule; the live count and the button sit below. */}
        <img
          src={launchArt}
          alt=""
          width={640}
          height={837}
          className="block max-h-[58svh] w-full bg-black object-contain"
        />
        <div className="space-y-3 p-4">
          <DialogTitle className="sr-only">
            {slots} pessoas, {days} dias de Premium
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-foreground">
            Os {slots} primeiros cadastros a partir de 10/10 ganham {days} dias de Premium. Sem
            cartão: no fim, você escolhe se continua no grátis ou assina.
          </DialogDescription>

          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold">
                {left === 1 ? "Resta 1 vaga" : `Restam ${left} vagas`}
              </span>
              <span className="text-xs text-muted-foreground">
                {slots - left} de {slots} preenchidas
              </span>
            </div>
            <div className="mt-2 flex gap-1" aria-hidden="true">
              {Array.from({ length: slots }, (_, index) => (
                <span
                  key={index}
                  className={`h-2 flex-1 rounded-full ${index < slots - left ? "bg-[oklch(0.65_0.25_350)]" : "bg-secondary"}`}
                />
              ))}
            </div>
          </div>

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
              Quero minha vaga <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
