/**
 * Shared "translucent graphite" surface for alerts (toasts) and floating panels
 * (notifications, weather). Change it here to restyle all of them at once.
 */
export const GRAPHITE = {
  background: "rgb(26 28 32 / 0.55)",
  text: "rgb(241 245 249)",
  border: "rgb(255 255 255 / 0.10)",
} as const;

/** Tailwind classes for panels built on Radix/shadcn (Popover, Dropdown, etc.). */
export const graphitePanelClass =
  "graphite-panel border border-white/10 bg-[rgb(26_28_32/0.7)] text-slate-100 shadow-[0_18px_48px_-12px_rgb(0_0_0/0.7)] backdrop-blur-[18px] backdrop-saturate-150";

/** Round icon buttons on the same graphite surface (mobile header: weather and bell). */
export const graphiteIconButtonClass =
  "border border-white/10 bg-[rgb(26_28_32/0.35)] text-slate-100 backdrop-blur-xl hover:bg-[rgb(40_42_48/0.85)] hover:text-white";
