import { Link } from "@tanstack/react-router";
import { Tag } from "lucide-react";

import { useIsPremium } from "@/components/PremiumBadge";
import { blackFridayPhase } from "@/lib/billing/blackFriday";

/**
 * Dashboard header chip for the Black Friday campaign (owner decision,
 * 2026-10-31: the live offer appears on the Dashboard): free students see
 * the live campaign announcement in yellow, opening /premium. Premium students
 * and every other day see nothing.
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
  if (premium !== false || !phase || placement === "mobile") return null;
  const label = translate("BLACK FRIDAY IS NOW LIVE");
  return placement === "desktop" ? (
    <Link
      to="/premium"
      className="inline-flex h-7 items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 text-[11px] font-semibold text-amber-300 transition-colors hover:bg-amber-400/20"
    >
      <Tag className="size-3.5 shrink-0" aria-hidden="true" />
      {label}
    </Link>
  ) : (
    <Link
      to="/premium"
      aria-label={label}
      title={label}
      className="grid size-8 shrink-0 place-items-center rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-300 transition-colors hover:bg-amber-400/20"
    >
      <Tag className="size-[1.15rem]" aria-hidden="true" />
    </Link>
  );
}
