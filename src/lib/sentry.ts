// Browser-only error monitoring. Initialized once, in production only.
// Public DSN lives in VITE_SENTRY_DSN (safe to expose to the browser).

import * as Sentry from "@sentry/react";

let initialized = false;

export function initSentry() {
  if (initialized || typeof window === "undefined") return;
  if (!import.meta.env.PROD) return;
  const dsn = import.meta.env["VITE_SENTRY_DSN"];
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: "production",
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
  initialized = true;
}

export function captureSentryException(error: unknown) {
  if (!initialized) return;
  Sentry.captureException(error);
}

// Identifies the user by internal id only — never name, email, or content.
export function setSentryUser(id: string | null) {
  if (!initialized) return;
  Sentry.setUser(id ? { id } : null);
}
