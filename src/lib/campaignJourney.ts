// Launch campaign journey (user request): one message a day for the 10 free
// Premium days, so the student gets a quick win early (days 1-3), feels what
// Premium adds (days 4-7), and sees clearly what changes before access ends
// (days 8-10), with a soft cut on day 11. Texts are written in English and
// translated through uiPt, like every student screen; the push uses the
// Portuguese text. Only real features are promised (no offer yet: it comes
// when the owner defines the discount).

export type JourneyMessage = {
  /** 1-10 while Premium lasts, 11 for the two days after it ends. */
  day: number;
  title: string;
  body: string;
  cta: string;
  to: "/coach" | "/writing" | "/mistakes" | "/call" | "/progress" | "/premium";
};

const DAY_MS = 86_400_000;

/**
 * Journey day from the grant: day 1 is the first 24 h after signing up.
 * After access ends, day 11 lasts 48 h (the soft cut); then null.
 */
export function journeyDay(
  grantedAt: string | Date,
  expiresAt: string | Date,
  now: Date = new Date(),
): number | null {
  const start = new Date(grantedAt).getTime();
  const end = new Date(expiresAt).getTime();
  const at = now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || at < start) return null;
  if (at >= end) return at < end + 2 * DAY_MS ? 11 : null;
  return Math.min(10, Math.floor((at - start) / DAY_MS) + 1);
}

/**
 * The day's message. `conversations` (AI Speaking answers since signing up)
 * personalises day 4 and swaps days 2-4 for a one-minute start when the
 * student has not talked to EVO yet.
 */
export function journeyMessage(day: number, conversations: number): JourneyMessage | null {
  if (day >= 2 && day <= 4 && conversations === 0) {
    return {
      day,
      title: "Just 1 minute with EVO",
      body: "Say one sentence in English to EVO. That is how your Premium starts paying off.",
      cta: "Talk to EVO",
      to: "/coach",
    };
  }
  switch (day) {
    case 1:
      return {
        day,
        title: "Your Premium is on: day 1 of 10",
        body: "Start with the most powerful part: 5 minutes talking with EVO.",
        cta: "Talk to EVO",
        to: "/coach",
      };
    case 2:
      return {
        day,
        title: "Day 2: a real situation",
        body: "Practise a job interview, a trip or a meeting with EVO today.",
        cta: "Choose a situation",
        to: "/coach",
      };
    case 3:
      return {
        day,
        title: "Day 3: see your writing corrected",
        body: "Write 5 lines about your day and watch EVO correct them on the spot.",
        cta: "Correct my text",
        to: "/writing",
      };
    case 4:
      return {
        day,
        title: "Day 4: no daily limit",
        body: "You have had {n} conversations with EVO. On the free plan it would be 3 per day.",
        cta: "Keep practising",
        to: "/coach",
      };
    case 5:
      return {
        day,
        title: "Day 5: your mistakes became reviews",
        body: "Review your recent mistakes so they do not become habits.",
        cta: "My mistakes",
        to: "/mistakes",
      };
    case 6:
      return {
        day,
        title: "Day 6: a video call with EVO",
        body: "An informal chat with EVO, like with a friend, to lose the fear of speaking.",
        cta: "Call EVO",
        to: "/call",
      };
    case 7:
      return {
        day,
        title: "Day 7: see how far you came",
        body: "Look at your skills after a week of Premium.",
        cta: "See my progress",
        to: "/progress",
      };
    case 8:
      return {
        day,
        title: "48 hours left of your Premium",
        body: "From day 11: 3 conversations and 3 corrections per day. Your progress stays saved.",
        cta: "See plans",
        to: "/premium",
      };
    case 9:
      return {
        day,
        title: "Tomorrow is your last Premium day",
        body: "Subscribe to keep unlimited conversations and corrections with EVO.",
        cta: "See plans",
        to: "/premium",
      };
    case 10:
      return {
        day,
        title: "Last day of your Premium",
        body: "Subscribe today to keep unlimited conversations and corrections.",
        cta: "Keep Premium",
        to: "/premium",
      };
    case 11:
      return {
        day,
        title: "Your account is now Free",
        body: "Your progress stays saved. You now have 3 conversations and 3 corrections per day.",
        cta: "Reactivate Premium",
        to: "/premium",
      };
    default:
      return null;
  }
}

/** Fills the {n} placeholder after translation. */
export function fillJourney(text: string, conversations: number) {
  return text.replace("{n}", String(conversations));
}
