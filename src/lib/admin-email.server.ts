import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const CLIENT_ID = "16fe0bc6-0064-48bb-9702-9d656deec9e";
const TENANT = "consumers";
const SCOPES = ["openid", "profile", "offline_access", "User.Read", "Mail.Read"];

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}
function encryptionKey(): Buffer {
  const key = Buffer.from(required("MICROSOFT_TOKEN_ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) throw new Error("MICROSOFT_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  return key;
}
export function encryptMicrosoftToken(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}
export function decryptMicrosoftToken(value: string): string {
  const [iv, tag, data] = value.split(".").map((part) => Buffer.from(part ?? "", "base64url"));
  if (!iv || !tag || !data) throw new Error("Invalid encrypted Microsoft token");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
function sign(value: string): string {
  return createHmac("sha256", required("MICROSOFT_OAUTH_STATE_SECRET")).update(value).digest("base64url");
}
/** Signed, short-lived OAuth state. The PKCE verifier must be stored in a separate HttpOnly cookie. */
export function createOAuthState(userId: string, nonce: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, nonce, issuedAt: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
export function verifyOAuthState(state: string): { userId: string; nonce: string } {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) throw new Error("Invalid Microsoft OAuth state");
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new Error("Invalid Microsoft OAuth state");
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId?: string; nonce?: string; issuedAt?: number };
  if (!parsed.userId || !parsed.nonce || !parsed.issuedAt || Date.now() - parsed.issuedAt > 10 * 60 * 1000) throw new Error("Expired Microsoft OAuth state");
  return { userId: parsed.userId, nonce: parsed.nonce };
}
export function microsoftAuthorizationUrl(redirectUri: string, state: string, challenge: string): string {
  const url = new URL(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`);
  url.search = new URLSearchParams({
    client_id: CLIENT_ID, response_type: "code", redirect_uri: redirectUri,
    response_mode: "query", scope: SCOPES.join(" "), state,
    code_challenge: challenge, code_challenge_method: "S256",
  }).toString();
  return url.toString();
}
export async function exchangeMicrosoftCode(code: string, verifier: string, redirectUri: string) {
  const response = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID, grant_type: "authorization_code", code,
      redirect_uri: redirectUri, code_verifier: verifier,
      scope: SCOPES.join(" "),
    }),
  });
  const result = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
  if (!response.ok || !result.access_token || !result.refresh_token) throw new Error("Microsoft authorization code exchange failed");
  return result;
}
export async function graphGetProfile(accessToken: string) {
  const response = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not verify the connected Microsoft mailbox");
  return await response.json() as { mail?: string | null; userPrincipalName?: string };
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
