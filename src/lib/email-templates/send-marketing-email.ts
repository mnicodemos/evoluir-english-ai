import * as React from "react";
import { render } from "@react-email/render";
import { TEMPLATES } from "./registry";

const SITE_NAME = "Evoluir+ English AI";
const DEFAULT_FROM_EMAIL = "noreply@notify.evoluirmaisenglishai.com";

export interface MarketingEmailOptions {
  templateData?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface MarketingEmailResult {
  sent: true;
}

/**
 * Sends promotional campaigns through Resend, separately from transactional
 * app mail. Promotional templates must only be called by authorized campaign
 * workflows that enforce recipient eligibility.
 */
export async function sendMarketingEmail(
  templateName: "premium-benefits",
  to: string,
  options: MarketingEmailOptions = {},
): Promise<MarketingEmailResult> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");

  const template = TEMPLATES[templateName];
  if (!template) throw new Error(`Marketing template '${templateName}' not found`);

  const recipient = to.trim();
  if (!recipient) throw new Error("Recipient is required");

  const templateData = options.templateData ?? {};
  const element = React.createElement(template.component, templateData);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(templateData) : template.subject;

  const configuredFrom = process.env["RESEND_FROM_EMAIL"] || DEFAULT_FROM_EMAIL;
  const from = configuredFrom.includes("<") ? configuredFrom : `${SITE_NAME} <${configuredFrom}>`;
  const idempotencyKey = options.idempotencyKey || crypto.randomUUID();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject,
      html,
      text,
    }),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const details =
      payload && typeof payload === "object" && "message" in payload
        ? String(payload.message)
        : `Resend API returned HTTP ${response.status}`;
    throw new Error(`Resend marketing email failed (${response.status}): ${details}`);
  }
  if (!payload || typeof payload !== "object" || !("id" in payload) || !payload.id) {
    throw new Error("Resend accepted the marketing request but returned no email ID");
  }

  return { sent: true };
}
