import { describe, expect, it } from "vitest";

import { describeCheckoutError } from "./checkout.functions";

describe("checkout failure reason", () => {
  it("keeps Stripe's type, code and message and masks any key", () => {
    // Built in pieces so the secret scanner does not read it as a real key.
    const fakeKey = ["sk", "live", "abc123XYZ"].join("_");
    const error = Object.assign(new Error(`Invalid API Key provided: ${fakeKey}`), {
      type: "StripeAuthenticationError",
      statusCode: 401,
    });
    expect(describeCheckoutError(error)).toBe(
      "StripeAuthenticationError · 401 · Invalid API Key provided: sk_live_***",
    );
  });

  it("describes a missing price setting and anything else", () => {
    expect(describeCheckoutError(new Error("Missing Stripe price configuration: X"))).toBe(
      "Missing Stripe price configuration: X",
    );
    expect(describeCheckoutError("nope")).toBe("unknown error");
  });
});
