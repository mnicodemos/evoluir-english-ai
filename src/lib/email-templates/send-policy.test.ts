import { describe, expect, it } from "vitest";
import { assertAppEmailAllowed } from "./send-policy";

describe("managed app-email policy", () => {
  it("rejects the existing Premium upsell", () => {
    expect(() => assertAppEmailAllowed("premium-benefits")).toThrow(
      "Premium promotions require a dedicated marketing email service.",
    );
  });
  it("permits the action-triggered student welcome", () => {
    expect(() => assertAppEmailAllowed("welcome")).not.toThrow();
  });
});