/**
 * API credit balance (user request). Google returns no balance for the Gemini
 * key, so the owner records each top-up in the Admin and the balance is the
 * top-ups minus the cost measured on every AI call since the first top-up
 * (the same per-call cost as Cost & Performance). An estimate: calls without
 * token counts (a TTS stopped mid-stream) are not in it.
 */

/** Below this share of the money loaded the Admin shows the balance as low. */
export const LOW_CREDIT_SHARE = 0.2;

export type CreditTopup = { id: string; added_at: string; amount_usd: number; note: string | null };

export type CreditBalance = {
  loadedUsd: number;
  spentUsd: number;
  remainingUsd: number;
  /** Remaining over loaded, 0..1; null before the first top-up. */
  remainingShare: number | null;
  low: boolean;
  since: string | null;
};

export function creditBalance(topups: CreditTopup[], spentUsd: number): CreditBalance {
  const loadedUsd = topups.reduce((sum, topup) => sum + Number(topup.amount_usd || 0), 0);
  const since = topups.length
    ? [...topups].sort((a, b) => a.added_at.localeCompare(b.added_at))[0]!.added_at
    : null;
  const spent = Math.max(0, spentUsd);
  const remainingUsd = loadedUsd - spent;
  const remainingShare = loadedUsd > 0 ? Math.max(0, remainingUsd) / loadedUsd : null;
  return {
    loadedUsd,
    spentUsd: spent,
    remainingUsd,
    remainingShare,
    low: remainingShare !== null && remainingShare < LOW_CREDIT_SHARE,
    since,
  };
}
