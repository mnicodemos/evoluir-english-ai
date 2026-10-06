// Browser-only error monitoring. Initialized once, in production only.
// Public DSN lives in VITE_SENTRY_DSN (safe to expose to the browser).

// The SDK (~85 KB) is loaded after the page is idle instead of being part of
// the code every page needs before its first paint. Errors and the user id
// seen before it loads are kept and sent once it is ready.
type SentryModule = typeof import("@sentry/react");

let initialized = false;
let started = false;
let sentry: SentryModule | null = null;
const pendingErrors: unknown[] = [];
let pendingUser: string | null | undefined;

export function initSentry() {
  if (started || typeof window === "undefined") return;
  if (!import.meta.env.PROD) return;
  const dsn = import.meta.env["VITE_SENTRY_DSN"];
  if (!dsn) return;
  started = true;
  const load = () =>
    void import("@sentry/react").then((module) => {
      sentry = module;
      start(module, dsn);
    });
  if ("requestIdleCallback" in window) window.requestIdleCallback(load, { timeout: 4000 });
  else setTimeout(load, 2000);
}

function start(Sentry: SentryModule, dsn: string) {
  Sentry.init({
    dsn,
    environment: "production",
    tracesSampleRate: 0,
    // Sentry v11 replaced sendDefaultPii:false with dataCollection; this
    // disables user info, cookies, headers, query params, bodies and locals.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      urlQueryParams: false,
      httpBodies: [],
      stackFrameVariables: false,
    },
  });
  initialized = true;
  if (pendingUser !== undefined) Sentry.setUser(pendingUser ? { id: pendingUser } : null);
  for (const error of pendingErrors.splice(0)) Sentry.captureException(error);
}

export function captureSentryException(error: unknown) {
  if (initialized && sentry) sentry.captureException(error);
  else if (started && pendingErrors.length < 10) pendingErrors.push(error);
}

// Identifies the user by internal id only — never name, email, or content.
export function setSentryUser(id: string | null) {
  if (initialized && sentry) sentry.setUser(id ? { id } : null);
  else pendingUser = id;
}
