import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";

const E164 = /^\+[1-9][0-9]{7,14}$/;

export type WhatsAppConfig = {
  accessToken: string;
  appSecret: string;
  phoneNumberId: string;
  verifyToken: string;
  graphApiVersion: string;
  businessPhoneNumber: string;
};

export function getWhatsAppConfig(): WhatsAppConfig {
  const required = {
    accessToken: process.env["WHATSAPP_ACCESS_TOKEN"],
    appSecret: process.env["WHATSAPP_APP_SECRET"],
    phoneNumberId: process.env["WHATSAPP_PHONE_NUMBER_ID"],
    verifyToken: process.env["WHATSAPP_VERIFY_TOKEN"],
    graphApiVersion: process.env["WHATSAPP_GRAPH_API_VERSION"],
    businessPhoneNumber: process.env["WHATSAPP_BUSINESS_PHONE_NUMBER"],
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value?.trim())
    .map(([key]) => key);
  if (missing.length) {
    throw new Error(`WhatsApp Cloud API is not configured: missing ${missing.join(", ")}`);
  }
  return required as WhatsAppConfig;
}

/** Validate Meta's X-Hub-Signature-256 against the exact raw request body. */
export function verifyWhatsAppSignature(
  rawBody: string,
  signature: string | null,
  appSecret: string,
): boolean {
  if (!signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export function normalizeWhatsAppPhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  const normalized = `+${digits}`;
  return E164.test(normalized) ? normalized : null;
}

export function createWhatsAppLinkCode(): { code: string; codeHash: string } {
  // Six digits are user-friendly; expiry, one-time use and rate controls protect the pairing flow.
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  return { code, codeHash: createHash("sha256").update(code).digest("hex") };
}

export function hashWhatsAppLinkCode(code: string): string {
  return createHash("sha256").update(code.trim()).digest("hex");
}

export type WhatsAppInboundMessage = {
  id: string;
  from: string;
  type: string;
  text?: { body?: string };
};

export function parseWhatsAppInboundMessages(payload: unknown): WhatsAppInboundMessage[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          messages?: Array<{
            id?: unknown;
            from?: unknown;
            type?: unknown;
            text?: { body?: unknown };
          }>;
        };
      }>;
    }>;
  };
  const result: WhatsAppInboundMessage[] = [];
  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        if (
          typeof message.id !== "string" ||
          typeof message.from !== "string" ||
          typeof message.type !== "string"
        ) {
          continue;
        }
        result.push({
          id: message.id,
          from: message.from,
          type: message.type,
          ...(typeof message.text?.body === "string"
            ? {
                text: { body: message.text.body.slice(0, 2000) },
              }
            : {}),
        });
      }
    }
  }
  return result;
}

export async function sendWhatsAppText(
  config: WhatsAppConfig,
  to: string,
  body: string,
): Promise<void> {
  const response = await fetch(
    `https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: body.slice(0, 4000) },
      }),
    },
  );
  if (!response.ok) {
    // Do not log tokens, phone numbers or message bodies.
    throw new Error(`WhatsApp Cloud API send failed with status ${response.status}`);
  }
}
