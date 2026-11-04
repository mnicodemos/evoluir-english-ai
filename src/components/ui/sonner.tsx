import type { CSSProperties } from "react";
import { AlertCircle, CheckCircle2, Info, RefreshCw } from "lucide-react";
import { Toaster as Sonner } from "sonner";

import { GRAPHITE } from "@/lib/surfaces";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Sonner reads its colours from these CSS variables; setting them here keeps every
// alert (weather, notifications, errors) on the same translucent graphite surface.
const graphiteVars = {
  "--normal-bg": GRAPHITE.background,
  "--normal-text": GRAPHITE.text,
  "--normal-border": GRAPHITE.border,
  // Sonner's fixed 356px made desktop alerts narrower than the full-width phone
  // ones; desktop gets a wider card (phones below 600px keep Sonner's full width).
  "--width": "min(480px, calc(100vw - 2rem))",
} as CSSProperties;

const Toaster = ({ className, style, ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      closeButton
      icons={{
        success: <CheckCircle2 strokeWidth={2.25} />,
        error: <AlertCircle strokeWidth={2.25} />,
        warning: <RefreshCw strokeWidth={2.25} />,
        info: <Info strokeWidth={2.25} />,
      }}
      className={`toaster group ${className ?? ""}`}
      style={{ ...graphiteVars, ...style }}
      toastOptions={{
        classNames: {
          // The "!" (important) suffix keeps the graphite surface even if Sonner's
          // own stylesheet is injected after ours.
          // Same HUD card as the pronunciation result: rounded-2xl, icon in a tinted
          // tile, display title (one standard for every notification in the app).
          toast: "group toast app-toast rounded-2xl! gap-3! p-3.5!",
          title: "font-display text-[15px]! font-semibold! leading-tight!",
          icon: "size-9! shrink-0 flex! items-center! justify-center! rounded-xl m-0! [&_svg]:block! [&_svg]:size-[18px]! [&_svg]:shrink-0! [&_svg]:m-0!",
          description: "text-xs! mt-0.5",
          closeButton: "app-toast-close",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "app-toast-cancel",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
