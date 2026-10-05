/**
 * Shared "translucent graphite" surface for alerts (toasts) and floating panels
 * (notifications, weather). Change it here to restyle all of them at once.
 */
export const GRAPHITE = {
  background: "rgb(26 28 32 / 0.72)",
  text: "rgb(241 245 249)",
  border: "rgb(255 255 255 / 0.10)",
} as const;

/** Tailwind classes for panels built on Radix/shadcn (Popover, Dropdown, etc.). */
export const graphitePanelClass =
  "border border-white/10 bg-[rgb(26_28_32/0.72)] text-slate-100 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.6)] backdrop-blur-xl backdrop-saturate-150";

/** Round icon buttons on the same graphite surface (mobile header: weather and bell). */
export const graphiteIconButtonClass =
  "border border-white/10 bg-[rgb(26_28_32/0.72)] text-slate-100 backdrop-blur-xl hover:bg-[rgb(40_42_48/0.85)] hover:text-white";
