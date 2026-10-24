import { useState, type ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * The whole ring as one target that tells its numbers on hover or tap (user
 * request, 2026-10-24: a goal-met ring shows only its check, and the amount
 * text inside it read out of context). Tooltips alone never open on touch,
 * so a tap toggles it too; a tap outside closes it.
 */
export function RingHint({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            onClick={() => setOpen((value) => !value)}
            className="absolute inset-0 grid place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60"
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
