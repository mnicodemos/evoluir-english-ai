import { isStaleTokenResponse } from "./pushStaleToken";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

/** Waits before each new try of a temporary failure (two more tries). */
export const FCM_RETRY_WAITS_MS = [2_000, 5_000];

/** 429 and 5xx are temporary; anything else (sent, stale token, bad request) is final. */
export function isTemporaryFcmStatus(status: number) {
  return status === 429 || status >= 500;
}

export type PushMessage = { title: string; body: string; path?: string | undefined };

/** Push credentials, or null when the server is not configured for push. */
export function fcmCredentials() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["FIREBASE_MESSAGING_API_KEY"];
  return lovableKey && connectionKey ? { lovableKey, connectionKey } : null;
}

/**
 * Sends one notification to one device through the Lovable FCM gateway. The
 * single place for the request shape and the stale-token rule, shared by the
 * in-app activity push and the daily cron.
 */
/**
 * Asks FCM whether a device token is still deliverable, without showing
 * anything (validate_only). Unknown or temporary failures count as valid, so a
 * healthy device is never dropped because of a network hiccup.
 */
export async function validateFcmToken(
  credentials: NonNullable<ReturnType<typeof fcmCredentials>>,
  token: string,
): Promise<{ valid: boolean }> {
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.lovableKey}`,
        "X-Connection-Api-Key": credentials.connectionKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        validate_only: true,
        message: { token, notification: { title: "check", body: "check" } },
      }),
    });
    if (res.ok) return { valid: true };
    return { valid: !isStaleTokenResponse(res.status, await res.text()) };
  } catch {
    return { valid: true };
  }
}

export async function sendFcm(
  credentials: NonNullable<ReturnType<typeof fcmCredentials>>,
  token: string,
  message: PushMessage,
  logPrefix = "FCM",
): Promise<{ ok: true } | { ok: false; stale: boolean; status: number; detail: string }> {
  const send = () =>
    fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.lovableKey}`,
        "X-Connection-Api-Key": credentials.connectionKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: message.title, body: message.body },
          data: message.path ? { path: message.path } : undefined,
        },
      }),
    }).catch(() => null);
  // A temporary gateway or FCM failure (429, 5xx, no answer) is tried again
  // after a short wait (user report, 2026-10-23: the 9:00 word push got 502
  // for every device and nobody received it).
  let res = await send();
  for (const waitMs of FCM_RETRY_WAITS_MS) {
    if (res && !isTemporaryFcmStatus(res.status)) break;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    res = await send();
  }
  if (!res) {
    console.error(`${logPrefix} send failed [network]: no answer`);
    return { ok: false, stale: false, status: 503, detail: "no answer" };
  }
  if (res.ok) return { ok: true };
  const errorBody = await res.text();
  console.error(`${logPrefix} send failed [${res.status}]: ${errorBody}`);
  return {
    ok: false,
    stale: isStaleTokenResponse(res.status, errorBody),
    status: res.status,
    detail: errorBody.slice(0, 200),
  };
}
