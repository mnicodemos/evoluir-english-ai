import { Link } from "@tanstack/react-router";
import { Tag } from "lucide-react";

import { useIsPremium } from "@/components/PremiumBadge";
import { BLACK_FRIDAY, blackFridayPhase, daysUntilBlackFriday } from "@/lib/billing/blackFriday";

/**
 * Dashboard header chip for the Black Friday campaign (owner decision,
 * 2026-10-31: the warm-up shows on the Dashboard too): free students see
 * "Black Friday in N days" during the warm-up and the offer while it runs,
 * both opening /premium. Premium students and every other day see nothing.
 */
export function BlackFridayChip({
  translate,
  placement,
}: {
  translate: (label: string) => string;
  placement: "mobile" | "desktop";
}) {
  const premium = useIsPremium();
  const phase = blackFridayPhase();
  if (premium !== false || !phase) return null;
  const days = daysUntilBlackFriday();
  const label =
    phase === "live"
      ? `Black Friday · ${BLACK_FRIDAY.monthlyPercentOff}% ${translate("off Premium")}`
      : `${translate("Black Friday in")} ${days} ${translate(days === 1 ? "day" : "days")}`;
  return placement === "desktop" ? (
    <Link
      to="/premium"
      className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.06] px-2.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-white/10"
    >
      <Tag className="size-3.5 shrink-0" aria-hidden="true" />
      {label}
    </Link>
  ) : (
    <Link
      to="/premium"
      aria-label={label}
      title={label}
      className="grid size-8 shrink-0 place-items-center rounded-full text-foreground"
    >
      <Tag className="size-[1.15rem]" aria-hidden="true" />
    </Link>
  );
}
