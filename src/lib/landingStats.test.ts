import { describe, expect, it } from "vitest";

import { landingFunnel } from "./landingStats";

describe("landingFunnel", () => {
  it("adds the daily counters and computes both rates", () => {
    const funnel = landingFunnel(
      [
        { day: "2026-10-09", event: "visit", count: 120 },
        { day: "2026-10-10", event: "visit", count: 80 },
        { day: "2026-10-09", event: "signup_click", count: 30 },
        { day: "2026-10-10", event: "signup_click", count: 10 },
      ],
      12,
      30,
    );
    expect(funnel).toEqual({
      days: 30,
      visits: 200,
      signupClicks: 40,
      signups: 12,
      clickRate: 20,
      signupRate: 30,
    });
  });

  it("has no rate without visits or clicks", () => {
    const funnel = landingFunnel([], 3, 7);
    expect(funnel.clickRate).toBeNull();
    expect(funnel.signupRate).toBeNull();
  });
});
