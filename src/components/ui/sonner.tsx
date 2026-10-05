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
          toast:
            "group toast backdrop-blur-md backdrop-saturate-150 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.6)]",
          description: "group-[.toast]:text-slate-300",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-white/10 group-[.toast]:text-slate-200",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
