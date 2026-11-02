/**
 * One accent per part of the app, for icon tiles in page and block headers
 * (user request: one modern, sophisticated look across pages).
 */
export const ACCENTS = {
  green: "bg-brand-green/12 text-brand-green ring-brand-green/25",
  diamond:
    "bg-[oklch(0.72_0.10_220)]/12 text-[oklch(0.72_0.10_220)] ring-[oklch(0.85_0.10_210)]/25",
  sky: "bg-sky-400/12 text-sky-400 ring-sky-400/25",
  violet: "bg-violet-400/12 text-violet-400 ring-violet-400/25",
  amber: "bg-amber-400/12 text-amber-400 ring-amber-400/25",
  rose: "bg-rose-400/12 text-rose-400 ring-rose-400/25",
  pink: "bg-pink-400/12 text-pink-400 ring-pink-400/25",
  // Activity pages (owner request, 2026-11-02: each page's icon in its
  // activity's colour, the same as the progress charts and Keep improving;
  // keep these in step with ACTIVITY_CHART_COLORS in src/lib/activityChartColors.ts).
  listening: "bg-dashboard-coral/12 text-dashboard-coral ring-dashboard-coral/25",
  reading: "bg-chart-2/12 text-chart-2 ring-chart-2/25",
  speaking: "bg-chart-3/12 text-chart-3 ring-chart-3/25",
  writing: "bg-chart-4/12 text-chart-4 ring-chart-4/25",
  grammar: "bg-[#EC4899]/12 text-[#EC4899] ring-[#EC4899]/25",
  lessons: "bg-[#EC4899]/12 text-[#EC4899] ring-[#EC4899]/25",
  vocabulary:
    "bg-[oklch(0.62_0.18_300)]/12 text-[oklch(0.62_0.18_300)] ring-[oklch(0.62_0.18_300)]/25",
  mistakes: "bg-warning/12 text-warning ring-warning/25",
} as const;

export type Accent = keyof typeof ACCENTS;
