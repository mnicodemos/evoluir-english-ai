import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The app's "all done" seal (user request, 2026-10-24): a soft green tint with
 * a thin ring and a bold check, the same as a studied day in the week strip.
 * Solid green stays for what is active today; small checks beside list items
 * keep their plain icon.
 */
export function DoneSeal({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full bg-brand-green/15 text-brand-green ring-1 ring-inset ring-brand-green/35",
        className,
      )}
      aria-hidden="true"
    >
      <Check className="size-5" strokeWidth={3} />
    </span>
  );
}
