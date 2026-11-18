import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const value = process.env["RESEND_API_KEY"];
  if (!value) throw new Error("RESEND_API_KEY is not configured");
  return value;
}

export function createReactivationUnsubscribeToken(userId: string): string {
  return createHmac("sha256", secret()).update(userId).digest("hex");
}

export function verifyReactivationUnsubscribeToken(userId: string, token: string): boolean {
  if (!userId || !/^[a-f0-9]{64}$/i.test(token)) return false;
  const expected = Buffer.from(createReactivationUnsubscribeToken(userId), "hex");
  const provided = Buffer.from(token, "hex");
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
