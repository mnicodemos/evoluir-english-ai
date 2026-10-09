import { Link } from "@tanstack/react-router";
import { ArrowRight, Crown } from "lucide-react";
import { useEffect, useState } from "react";

import evoProfile from "@/assets/evo-profile.jpg.asset.json";
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
 * visit, a moment after the page opens; it disappears for good once every
 * place is taken, because the database then reports the campaign inactive.
 */
export function LaunchCampaignPopup() {
  const [status, setStatus] = useState<CampaignStatus | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (readStorage(SEEN_KEY) === "1") return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc("premium_campaign_status" as never);
      if (cancelled || error || !data) return;
      const result = data as unknown as CampaignStatus;
      if (!result.active || !result.slots_left) return;
      setStatus(result);
      setOpen(true);
      writeStorage(SEEN_KEY, "1");
    }, 1200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (!status) return null;
  const slots = status.slots ?? 10;
  const left = status.slots_left ?? 0;
  const days = status.days ?? 10;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="dashboard-shell brand-dashboard-theme dark w-[calc(100%-2rem)] max-w-md rounded-2xl border-brand-green/40 bg-card text-foreground">
        <div className="flex items-center gap-3">
          <img
            src={evoProfile.url}
            alt=""
            className="size-14 shrink-0 rounded-full object-cover ring-2 ring-brand-green/60"
          />
          <p className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-bold uppercase text-warning">
            <Crown className="size-3.5" aria-hidden="true" />
            Lançamento
          </p>
        </div>
        <DialogTitle className="text-2xl font-bold leading-tight">
          Os {slots} primeiros cadastros ganham {days} dias de Premium grátis
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          Converse por voz com a EVO, corrija seus textos e siga sua trilha com tudo liberado. No
          fim dos {days} dias, você escolhe: continua no plano grátis ou assina o Premium. Sem
          cartão.
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
                className={`h-2 flex-1 rounded-full ${index < slots - left ? "bg-brand-green" : "bg-secondary"}`}
              />
            ))}
          </div>
        </div>

        <Button asChild size="lg" className="w-full">
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
      </DialogContent>
    </Dialog>
  );
}
