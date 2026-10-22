import { describe, expect, it } from "vitest";

import { TRIAL_DAYS, trialEligible } from "./trial";

describe("Premium free trial", () => {
  it("is 7 days, once per account", () => {
    expect(TRIAL_DAYS).toBe(7);
    expect(trialEligible([])).toBe(true);
    expect(trialEligible([{ status: "canceled" }])).toBe(false);
  });
});
