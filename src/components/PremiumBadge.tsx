import { Crown } from "lucide-react";

import { useProfile } from "@/hooks/useProfile";
import { profileIsPremium } from "@/lib/billing/subscriptionView";
import { cn } from "@/lib/utils";

/**
 * True or false once the profile is known; undefined while it loads, so a
 * Premium student never sees a badge flash in.
 */
export function useIsPremium(): boolean | undefined {
  const { data: profile, isLoading } = useProfile();
  if (isLoading || profile === undefined) return undefined;
  return profileIsPremium(profile);
}

/**
 * The one "Premium" badge on Premium parts of the app (user request): shown
 * only to free students, beside a crown; a Premium student sees none (their
 * plan shows once, beside their name in the menu).
 */
export function PremiumBadge({ className }: { className?: string }) {
  const premium = useIsPremium();
  if (premium !== false) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning",
        className,
      )}
    >
      <Crown className="size-3" aria-hidden="true" />
      Premium
    </span>
  );
}
