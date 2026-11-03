import { Link } from "@tanstack/react-router";
import { Tag } from "lucide-react";
import { useEffect, useState } from "react";

import {
  BLACK_FRIDAY,
  blackFridayPhase,
} from "@/lib/billing/blackFriday";
import { bumpLandingStat } from "@/lib/landingStats";

/**
 * Public home hero badge for the live Black Friday offer. Read after mount,
 * so the page served and the page shown agree on the date. Opens the signup.

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
      {`BLACK FRIDAY · ${offer}`}
    </Link>
  );
}
