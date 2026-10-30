import { Link } from "@tanstack/react-router";
import { Tag } from "lucide-react";
import { useEffect, useState } from "react";

import {
  BLACK_FRIDAY,
  BLACK_FRIDAY_FIRST_DAY,
  BLACK_FRIDAY_LAST_DAY,
  blackFridayPhase,
  dayMonth,
} from "@/lib/billing/blackFriday";
import { bumpLandingStat } from "@/lib/landingStats";

/**
 * Public home hero badge for Black Friday (owner decision, 2026-10-31): during
 * the warm-up it announces the dates and the offer, so visitors sign up before
 * it starts; while it runs it names the offer. Read after mount, so the page
 * served and the page shown agree on the date. Opens the signup.
 */
export function BlackFridayBadge({ className = "" }: { className?: string }) {
  const [phase, setPhase] = useState<ReturnType<typeof blackFridayPhase>>(null);
  useEffect(() => setPhase(blackFridayPhase()), []);
  if (!phase) return null;
  const offer = `${BLACK_FRIDAY.monthlyPercentOff}% off no Premium mensal`;
  return (
    <Link
      to="/auth"
      search={{ mode: "signup" }}
      onClick={() => bumpLandingStat("signup_click")}
      className={`inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-white/10 ${className}`}
    >
      <Tag className="size-3.5 shrink-0" aria-hidden="true" />
      {phase === "live"
        ? `Black Friday: ${offer} · até ${dayMonth(BLACK_FRIDAY_LAST_DAY)}`
        : `Black Friday de ${dayMonth(BLACK_FRIDAY_FIRST_DAY)} a ${dayMonth(BLACK_FRIDAY_LAST_DAY)} · ${offer}`}
    </Link>
  );
}
