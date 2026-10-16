/**
 * One accent per part of the app, for icon tiles in page and block headers
 * (user request: one modern, sophisticated look across pages).
 */
export const ACCENTS = {
  green: "bg-brand-green/12 text-brand-green ring-brand-green/25",
  sky: "bg-sky-400/12 text-sky-400 ring-sky-400/25",
  violet: "bg-violet-400/12 text-violet-400 ring-violet-400/25",
  amber: "bg-amber-400/12 text-amber-400 ring-amber-400/25",
  rose: "bg-rose-400/12 text-rose-400 ring-rose-400/25",
  pink: "bg-pink-400/12 text-pink-400 ring-pink-400/25",
} as const;

export type Accent = keyof typeof ACCENTS;
