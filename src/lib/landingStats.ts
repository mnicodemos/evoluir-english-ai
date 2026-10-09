// Public home funnel (migration 0054): anonymous daily counters only. No
// cookie, no user id; a visit is counted once per browser session.

import { supabase } from "@/integrations/supabase/client";

export type LandingEvent = "visit" | "signup_click";

const VISIT_KEY = "evoluir-landing-visit";

export function bumpLandingStat(event: LandingEvent) {
  if (event === "visit") {
    try {
      if (window.sessionStorage.getItem(VISIT_KEY) === "1") return;
      window.sessionStorage.setItem(VISIT_KEY, "1");
    } catch {
      // Storage blocked: still count the visit.
    }
  }
  // Never blocks the page: a failed count is simply lost.
  void supabase.rpc("bump_landing_stat" as never, { p_event: event } as never).then(
    () => undefined,
    () => undefined,
  );
}

export type LandingStatRow = { day: string; event: string; count: number };

export type LandingFunnel = {
  days: number;
  visits: number;
  signupClicks: number;
  signups: number;
  /** Share of visits that clicked "Começar" (null with no visits). */
  clickRate: number | null;
  /** Signups per click (null with no clicks). */
  signupRate: number | null;
};

const rate = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;

/** Totals for the window, from the daily counters and the signup count. */
export function landingFunnel(
  rows: readonly LandingStatRow[],
  signups: number,
  days: number,
): LandingFunnel {
  const sum = (event: string) =>
    rows.filter((row) => row.event === event).reduce((total, row) => total + row.count, 0);
  const visits = sum("visit");
  const signupClicks = sum("signup_click");
  return {
    days,
    visits,
    signupClicks,
    signups,
    clickRate: rate(signupClicks, visits),
    signupRate: rate(signups, signupClicks),
  };
}
