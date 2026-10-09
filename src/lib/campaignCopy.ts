// Launch campaign wording for the public site (migration 0055): a campaign
// limited by places (slots) or, now, by a signup period (ends_at).

export type CampaignStatus = {
  active: boolean;
  slots?: number | null;
  slots_left?: number | null;
  ends_at?: string | null;
  days?: number;
};

/** Open for signups: active and, when it has places, some still left. */
export function campaignOpen(status: CampaignStatus | null | undefined): boolean {
  if (!status?.active) return false;
  if (status.slots != null) return (status.slots_left ?? 0) > 0;
  return true;
}

/** "20/10": the last São Paulo day of the period (ends_at is exclusive). */
export function campaignLastDay(endsAt: string | null | undefined): string | null {
  if (!endsAt) return null;
  const last = new Date(new Date(endsAt).getTime() - 1);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(last);
}

/** Days left to sign up, today included (São Paulo dates); null without an end. */
export function campaignDaysLeft(endsAt: string | null | undefined, now = new Date()) {
  if (!endsAt) return null;
  const day = (at: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(at);
  const last = day(new Date(new Date(endsAt).getTime() - 1));
  const today = day(now);
  const diff = Math.round((Date.parse(last) - Date.parse(today)) / 86_400_000) + 1;
  return Math.max(diff, 0);
}
