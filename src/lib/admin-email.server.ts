import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const CLIENT_ID = "16fe0bc6-0064-48bb-9702-9d6566deec9e";
const TENANT = "consumers";
const SCOPES = ["openid", "profile", "offline_access", "User.Read", "Mail.Read"];
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

function encryptionKey(): Buffer {
  const key = Buffer.from(required("MICROSOFT_TOKEN_ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) {
    throw new Error("MICROSOFT_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return key;
}

export function encryptMicrosoftToken(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptMicrosoftToken(value: string): string {
  const [ivPart, tagPart, dataPart] = value.split(".");
  if (!ivPart || !tagPart || !dataPart) throw new Error("Invalid encrypted Microsoft token");
  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const data = Buffer.from(dataPart, "base64url");
  if (iv.length !== 12 || tag.length !== 16 || data.length === 0) {
    throw new Error("Invalid encrypted Microsoft token");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

function sign(value: string): string {
  return createHmac("sha256", required("MICROSOFT_OAUTH_STATE_SECRET"))
    .update(value)
    .digest("base64url");
}

export function createOAuthState(userId: string, nonce: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, nonce, issuedAt: Date.now() })).toString(
    "base64url",
  );
  return `${payload}.${sign(payload)}`;
}

export function verifyOAuthState(state: string): { userId: string; nonce: string } {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) throw new Error("Invalid Microsoft OAuth state");
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error("Invalid Microsoft OAuth state");
  }
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    userId?: string;
    nonce?: string;
    issuedAt?: number;
  };
  if (
    !parsed.userId ||
    !parsed.nonce ||
    !parsed.issuedAt ||
    Date.now() - parsed.issuedAt > 10 * 60 * 1000 ||
    parsed.issuedAt > Date.now() + 30_000
  ) {
    throw new Error("Expired Microsoft OAuth state");
  }
  return { userId: parsed.userId, nonce: parsed.nonce };
}

export function microsoftAuthorizationUrl(
  redirectUri: string,
  state: string,
  challenge: string,
): string {
  const url = new URL(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`);
  url.search = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: SCOPES.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

type MicrosoftTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

type MicrosoftTokenError = {
  error?: string;
  error_description?: string;
  error_codes?: number[];
  trace_id?: string;
  correlation_id?: string;
};

type MicrosoftTokenPayload = MicrosoftTokenResponse & MicrosoftTokenError;

async function tokenRequest(params: URLSearchParams): Promise<MicrosoftTokenResponse> {
  const response = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const payload = (await response.json().catch(() => null)) as MicrosoftTokenPayload | null;
  if (!response.ok || !payload?.access_token) {
    const errorCode = payload?.error || `http_${response.status}`;
    const description = payload?.error_description?.split("\\r")[0]?.slice(0, 700);
    console.error("[admin-email] Microsoft token exchange rejected", {
      status: response.status,
      error: errorCode,
      error_codes: payload?.error_codes,
      error_description: description,
      trace_id: payload?.trace_id,
      correlation_id: payload?.correlation_id,
    });
    throw new Error(
      description
        ? `Microsoft OAuth: ${errorCode} — ${description}`
        : `Microsoft OAuth: ${errorCode} (HTTP ${response.status})`,
    );
  }
  return payload;
}

export async function exchangeMicrosoftCode(
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<MicrosoftTokenResponse & { access_token: string; refresh_token: string }> {
  const result = await tokenRequest(
    new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: required("MICROSOFT_CLIENT_SECRET"),
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      scope: SCOPES.join(" "),
    }),
  );
  if (!result.refresh_token) throw new Error("Microsoft did not return a refresh token");
  return result as MicrosoftTokenResponse & { access_token: string; refresh_token: string };
}

export async function refreshMicrosoftToken(refreshToken: string) {
  const result = await tokenRequest(
    new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: required("MICROSOFT_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: SCOPES.join(" "),
    }),
  );
  if (!result.refresh_token) throw new Error("Microsoft did not rotate the refresh token");
  return result as MicrosoftTokenResponse & { access_token: string; refresh_token: string };
}

export async function graphGetProfile(accessToken: string) {
  const response = await fetch(`${GRAPH_BASE}/me?$select=mail,userPrincipalName,displayName`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not verify the connected Microsoft mailbox");
  return (await response.json()) as {
    mail?: string | null;
    userPrincipalName?: string;
    displayName?: string;
  };
}

export function getMicrosoftRedirectUri(requestUrl: string): string {
  const configured = process.env["MICROSOFT_REDIRECT_URI"]?.trim();
  return configured || new URL("/api/admin/email/microsoft/callback", requestUrl).toString();
}

export function createPkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function classifyAdminMailbox(recipients: string[]): "contact" | "support" | "unknown" {
  const normalized = recipients.map((item) => item.trim().toLowerCase());
  if (normalized.includes("contato@evoluirmaisenglishai.com")) return "contact";
  if (normalized.includes("suporte@evoluirmaisenglishai.com")) return "support";
  return "unknown";
}

function htmlToText(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/[ \t\r\n]+/g, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \\t\\r\\n]+/g, " ")
    .trim();
}

export type GraphInboxMessage = {
  id: string;
  conversationId?: string;
  internetMessageId?: string;
  from?: { emailAddress?: { address?: string } };
  toRecipients?: Array<{ emailAddress?: { address?: string } }>;
  ccRecipients?: Array<{ emailAddress?: { address?: string } }>;
  subject?: string;
  receivedDateTime?: string;
  body?: { contentType?: string; content?: string };
  bodyPreview?: string;
};

export function normalizeGraphMessage(message: GraphInboxMessage) {
  const recipients = [...(message.toRecipients ?? []), ...(message.ccRecipients ?? [])]
    .map((item) => item.emailAddress?.address?.trim().toLowerCase())
    .filter((item): item is string => Boolean(item));
  const rawBody = message.body?.content ?? message.bodyPreview ?? "";
  return {
    provider_message_id: message.id,
    provider_conversation_id: message.conversationId ?? null,
    internet_message_id: message.internetMessageId ?? null,
    mailbox: classifyAdminMailbox(recipients),
    from_address: message.from?.emailAddress?.address?.trim().toLowerCase() || "unknown",
    to_addresses: recipients,
    subject: message.subject ?? "",
    body_text: message.body?.contentType?.toLowerCase() === "html" ? htmlToText(rawBody) : rawBody,
    received_at: message.receivedDateTime ?? new Date().toISOString(),
  };
}

export async function syncGraphInbox(accessToken: string, initialDeltaLink?: string | null) {
  const select =
    "id,conversationId,internetMessageId,from,toRecipients,ccRecipients,subject,receivedDateTime,body,bodyPreview";
  let nextUrl =
    initialDeltaLink ||
    `${GRAPH_BASE}/me/mailFolders/inbox/messages/delta?$select=${encodeURIComponent(select)}&$top=50`;
  let deltaLink: string | null = null;
  const messages: ReturnType<typeof normalizeGraphMessage>[] = [];
  let pages = 0;
  while (nextUrl && pages < 100) {
    const response = await fetch(nextUrl, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.body-content-type="text"',
      },
    });
    if (!response.ok) {
      throw new Error(`Microsoft Graph inbox sync failed (HTTP ${response.status})`);
    }
    const page = (await response.json()) as {
      value?: GraphInboxMessage[];
      "@odata.nextLink"?: string;
      "@odata.deltaLink"?: string;
    };
    for (const item of page.value ?? []) {
      if (item.id) messages.push(normalizeGraphMessage(item));
    }
    nextUrl = page["@odata.nextLink"] ?? "";
    deltaLink = page["@odata.deltaLink"] ?? deltaLink;
    pages += 1;
  }
  if (nextUrl) throw new Error("Microsoft Graph returned too many pages; sync stopped safely");
  return { messages, deltaLink };
}

export async function sendAdminEmailReply(input: {
  requestId: string;
  to: string;
  from: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
}): Promise<{ id: string }> {
  const apiKey = required("RESEND_API_KEY");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `admin-email-reply:${input.requestId}`,
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: input.subject,
      text: input.body,
      ...(input.inReplyTo
        ? { headers: { "In-Reply-To": input.inReplyTo, References: input.inReplyTo } }
        : {}),
    }),
  });
  const payload = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (!response.ok || !payload?.id) {
    throw new Error(
      payload?.message
        ? `Resend rejected the reply: ${payload.message.slice(0, 400)}`
        : `Resend reply failed (HTTP ${response.status})`,
    );
  }
  return { id: payload.id };
}
