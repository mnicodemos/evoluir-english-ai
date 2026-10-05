import { describe, expect, it } from "vitest";

import { isStaleTokenResponse } from "./pushStaleToken";

describe("isStaleTokenResponse", () => {
  it("treats an unregistered device as stale", () => {
    expect(isStaleTokenResponse(404, '{"error":{"status":"NOT_FOUND"}}')).toBe(true);
    expect(isStaleTokenResponse(400, '{"errorCode":"UNREGISTERED"}')).toBe(true);
  });

  it("treats an invalid registration token as stale", () => {
    expect(
      isStaleTokenResponse(
        400,
        '{"error":{"message":"The registration token is not a valid FCM registration token"}}',
      ),
    ).toBe(true);
  });

  it("keeps the device when the payload or the service is at fault", () => {
    expect(isStaleTokenResponse(400, '{"error":{"message":"Invalid JSON payload"}}')).toBe(false);
    expect(isStaleTokenResponse(500, "")).toBe(false);
    expect(isStaleTokenResponse(429, "QUOTA_EXCEEDED")).toBe(false);
  });
});
