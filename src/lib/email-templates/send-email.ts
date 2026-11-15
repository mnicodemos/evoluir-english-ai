import * as React from "react";
import { render } from "@react-email/render";
import { TEMPLATES } from "./registry";
import { assertAppEmailAllowed } from "./send-policy";

// Server-only: reads RESEND_API_KEY. Never import from client components.
const SITE_NAME = "Evoluir+ English AI";
const DEFAULT_FROM_EMAIL = "noreply@notify.evoluirmaisenglishai.com";

export type SendTemplateEmailResult = { sent: true } | { sent: false; reason: "recipient_suppressed" };

export interface SendTemplateEmailOptions {
  templateData?: Record<string, unknown>;
  /** Stable key prevents duplicate sends when the provider receives a retry. */
  idempotencyKey?: string;
  replyTo?: string;
}

/**
 * Renders a registered React Email template and sends it through Resend.
 * The sending domain must be verified in Resend before production delivery.
 */
export async function sendTemplateEmail(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {},
): Promise<SendTemplateEmailResult> {
  assertAppEmailAllowed(templateName);

  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const template = TEMPLATES[templateName];
  if (!template) {
    throw new Error(
      `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(", ")}`,
    );
  }

  // Template-level `to` takes precedence — notification templates always
  // send to their fixed address.
  const recipient = template.to || to;
  if (!recipient) {
    throw new Error("Recipient is required (the template defines no fixed recipient)");
  }

  const templateData = options.templateData ?? {};
  const element = React.createElement(template.component, templateData);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(templateData) : template.subject;

  const configuredFrom = process.env["RESEND_FROM_EMAIL"] || DEFAULT_FROM_EMAIL;
  // Accept either a bare email address or a complete "Name <email>" header.
  const from = configuredFrom.includes("<")
    ? configuredFrom
    : `${SITE_NAME} <${configuredFrom}>`;
  const replyTo = options.replyTo || process.env["RESEND_REPLY_TO"];
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
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const details =
      payload && typeof payload === "object" && "message" in payload
        ? String(payload.message)
        : `Resend API returned HTTP ${response.status}`;
    throw new Error(`Resend email failed (${response.status}): ${details}`);
  }

  if (!payload || typeof payload !== "object" || !("id" in payload) || !payload.id) {
    throw new Error("Resend accepted the request but returned no email ID");
  }

  return { sent: true };
}
