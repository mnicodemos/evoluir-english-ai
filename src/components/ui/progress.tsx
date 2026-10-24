"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { FILL_IN_TRANSITION, useFillIn } from "@/hooks/useFillIn";
import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    /** Opt-in: grow from empty with the Dashboard's fill-in (useFillIn). */
    fillIn?: boolean;
  }
>(({ className, value, fillIn = false, ...props }, ref) => {
  const grown = useFillIn(value || 0);
  const shown = fillIn ? grown : value || 0;
  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/20", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full w-full flex-1 bg-primary transition-all",
          fillIn && FILL_IN_TRANSITION,
        )}
        style={{ transform: `translateX(-${100 - shown}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
