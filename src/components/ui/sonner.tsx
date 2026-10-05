import type { CSSProperties } from "react";
import { Toaster as Sonner } from "sonner";

import { GRAPHITE } from "@/lib/surfaces";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Sonner reads its colours from these CSS variables; setting them here keeps every
// alert (weather, notifications, errors) on the same translucent graphite surface.
const graphiteVars = {
  "--normal-bg": GRAPHITE.background,
  "--normal-text": GRAPHITE.text,
  "--normal-border": GRAPHITE.border,
} as CSSProperties;

const Toaster = ({ className, style, ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className={`toaster group ${className ?? ""}`}
      style={{ ...graphiteVars, ...style }}
      toastOptions={{
        classNames: {
          // The "!" (important) suffix keeps the graphite surface even if Sonner's
          // own stylesheet is injected after ours.
          toast:
            "group toast border-white/10! bg-[rgb(26_28_32/0.6)]! text-slate-100! backdrop-blur-xl backdrop-saturate-150 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.6)]",
          title: "text-slate-100!",
          // Icon colour by meaning: amber = try again, red = something failed.
          warning: "[&_[data-icon]]:text-amber-400!",
          error: "[&_[data-icon]]:text-red-400!",
          success: "[&_[data-icon]]:text-emerald-400!",
          info: "[&_[data-icon]]:text-sky-400!",
          description: "text-slate-300!",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-white/10 group-[.toast]:text-slate-200",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
