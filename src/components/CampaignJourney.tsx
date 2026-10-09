import { Link } from "@tanstack/react-router";
import { ArrowRight, Crown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCampaignJourney } from "@/hooks/useCampaignJourney";
import { fillJourney } from "@/lib/campaignJourney";

/**
 * Dashboard header chip for the launch campaign journey: "Premium · day X of
 * 10" (a crown on phones), opening today's mission with its one action. Shown
 * only during the 10 Premium days and the soft-cut day 11.
 */
export function CampaignJourneyChip({
  translate,
  placement,
}: {
  translate: (label: string) => string;
  placement: "mobile" | "desktop";
}) {
  const journey = useCampaignJourney();
  if (!journey) return null;
  const { message, conversations, day } = journey;
  const label =
    day <= 10
      ? translate("Premium · day {day} of 10").replace("{day}", String(day))
      : translate(message.title);
  return (
    <Popover>
      <PopoverTrigger asChild>
        {placement === "desktop" ? (
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 text-[11px] font-semibold text-warning transition-colors hover:bg-warning/20"
          >
            <Crown className="size-3.5 shrink-0" aria-hidden="true" />
            {label}
          </button>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            className="relative size-8 shrink-0 rounded-full text-warning"
          >
            <Crown className="size-[1.15rem]" aria-hidden="true" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align={placement === "mobile" ? "end" : "start"}
        sideOffset={8}
        className="dashboard-shell dark w-[min(20rem,calc(100vw-1.5rem))] p-4"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-warning">
          {day <= 10 ? label : translate("Today's Premium mission")}
        </p>
        <p className="mt-1 font-display text-base font-semibold">{translate(message.title)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {fillJourney(translate(message.body), conversations)}
        </p>
        <Button asChild size="sm" className="mt-3 w-full">
          <Link to={message.to}>
            {translate(message.cta)} <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </PopoverContent>
    </Popover>
  );
}
