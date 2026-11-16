import { describe, expect, it } from "vitest";
import { assertCampaignDeliveryCanStart } from "./campaign-delivery";

describe("admin campaign delivery guard", () => {
  it("blocks a campaign that was already sent", () => {
    expect(() => assertCampaignDeliveryCanStart("sent")).toThrow(
      "This campaign has already been sent to this student.",
    );
  });

  it("blocks a campaign that is still pending", () => {
    expect(() => assertCampaignDeliveryCanStart("pending")).toThrow(
      "This campaign is already being processed for this student.",
    );
  });

  it("allows retry after a failed delivery", () => {
    expect(() => assertCampaignDeliveryCanStart("failed")).not.toThrow();
  });

  it("allows retry after a suppressed delivery", () => {
    expect(() => assertCampaignDeliveryCanStart("suppressed")).not.toThrow();
  });

  it("allows the first delivery", () => {
    expect(() => assertCampaignDeliveryCanStart(null)).not.toThrow();
  });
});
