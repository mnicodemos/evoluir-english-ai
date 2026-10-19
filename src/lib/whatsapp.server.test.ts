import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  normalizeWhatsAppPhone,
  parseWhatsAppInboundMessages,
  verifyWhatsAppSignature,
} from "./whatsapp.server";

describe("WhatsApp Cloud API helpers", () => {
  it("normalizes inbound phone numbers to E.164", () => {
    expect(normalizeWhatsAppPhone("5511999998888")).toBe("+5511999998888");
    expect(normalizeWhatsAppPhone("123")).toBeNull();
  });

  it("validates Meta signatures against the raw body", () => {
    const body = '{"object":"whatsapp_business_account"}';
    const secret = "test-app-secret";
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    expect(verifyWhatsAppSignature(body, signature, secret)).toBe(true);
    expect(verifyWhatsAppSignature(body + " ", signature, secret)).toBe(false);
    expect(verifyWhatsAppSignature(body, null, secret)).toBe(false);
  });

  it("extracts only valid inbound message envelopes and bounds message text", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: "wamid.1",
                    from: "5511999998888",
                    type: "text",
                    text: { body: "Hello EVO" },
                  },
                  { id: "wamid.2", from: "5511999998888", type: "image" },
                  {
                    id: 3,
                    from: "5511999998888",
                    type: "text",
                    text: { body: "invalid id" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(parseWhatsAppInboundMessages(payload)).toEqual([
      {
        id: "wamid.1",
        from: "5511999998888",
        type: "text",
        text: { body: "Hello EVO" },
      },
      { id: "wamid.2", from: "5511999998888", type: "image" },
    ]);
  });
});
