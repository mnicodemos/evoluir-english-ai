import { Check, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The app's "all done" seal (user request, 2026-10-24): a soft green tint with
 * a thin ring and a bold check, the same as a studied day in the week strip.
 * Solid green stays for what is active today; small checks beside list items
 * keep their plain icon. A state that is not done yet ("Nothing yet today")
 * takes the same seal with its own icon (a clock), never a check.
 */
export function DoneSeal({
  size = "md",
  icon: Icon = Check,
  className,
}: {
  size?: "sm" | "md";
  icon?: LucideIcon;
  className?: string;
}) {
  // md: a whole card's done state; sm: a "nothing else" line beside its text,
  // the size of a studied day in the week strip (user request, 2026-10-24).
  const small = size === "sm";
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-brand-green/15 text-brand-green ring-1 ring-inset ring-brand-green/35",
        small ? "size-5" : "size-10",
        className,
      )}
      aria-hidden="true"
    >
      <Icon className={small ? "size-3" : "size-5"} strokeWidth={Icon === Check ? 3 : 2.5} />
    </span>
  );
}
