import { describe, expect, it } from "vitest";

import { productAlerts } from "./productAlerts";

const wait = (medianMs: number, p90Ms: number, answers = 40) => ({
  answers,
  firstAudio: { medianMs, p90Ms },
});
const rate = (returned: number, eligible: number) => ({
  eligible,
  returned,
  percent: Math.round((returned / eligible) * 100),
});

describe("productAlerts", () => {
  it("is quiet when every goal is met", () => {
    expect(
      productAlerts({
        speakingWait: wait(2_400, 4_500),
        d1: rate(5, 12),
        firstDayTalk: rate(8, 12),
      }),
    ).toEqual([]);
  });

  it("warns when EVO takes more than 3 s to start speaking", () => {
    const [alert] = productAlerts({ speakingWait: wait(3_800, 7_000) });
    expect(alert).toMatchObject({ level: "warning", area: "product" });
    expect(alert?.title).toContain("3,8 s");
  });

  it("points at the slow tail when only the slowest answers miss the goal", () => {
    const [alert] = productAlerts({ speakingWait: wait(2_200, 7_500) });
    expect(alert?.title).toContain("10%");
  });

  it("flags low next-day return and few first conversations", () => {
    const alerts = productAlerts({
      speakingWait: null,
      d1: rate(2, 12),
      firstDayTalk: rate(3, 12),
    });
    expect(alerts.map((a) => a.title)).toEqual([
      expect.stringContaining("17%"),
      expect.stringContaining("25%"),
    ]);
  });

  it("waits for enough students and answers before judging", () => {
    expect(
      productAlerts({
        speakingWait: wait(5_000, 9_000, 8),
        d1: rate(0, 4),
        firstDayTalk: rate(0, 4),
      }),
    ).toEqual([]);
  });
});
