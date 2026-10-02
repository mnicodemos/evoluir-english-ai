import { expect, test } from "@playwright/test";

const protectedApis = ["/api/speech", "/api/transcribe", "/api/coach-stream"];

test.describe("HTTP security boundaries", () => {
  for (const endpoint of protectedApis) {
    test(`${endpoint} rejects missing and false tokens`, async ({ request }) => {
      const missing = await request.post(endpoint, { data: {} });
      expect(missing.status()).toBe(401);
      expect(JSON.stringify(await missing.json())).not.toMatch(
        /stack|SUPABASE|secret|api[_ -]?key/i,
      );

      const forged = await request.post(endpoint, {
        headers: { Authorization: "Bearer forged.invalid.token" },
        data: {},
      });
      expect(forged.status()).toBe(401);
      expect(JSON.stringify(await forged.json())).not.toMatch(
        /stack|SUPABASE|secret|api[_ -]?key/i,
      );
    });
  }

  test("Stripe webhook rejects unsigned and invalid signatures", async ({ request }) => {
    const missing = await request.post("/api/public/stripe/webhook", { data: {} });
    expect(missing.status()).toBe(400);
    const invalid = await request.post("/api/public/stripe/webhook", {
      headers: { "stripe-signature": "t=0,v1=invalid" },
      data: {},
    });
    expect(invalid.status()).toBe(400);
  });
});
