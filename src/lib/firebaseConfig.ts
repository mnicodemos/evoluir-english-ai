const env = import.meta.env;
const appId = env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID"] as string | undefined;
const vapidKey = env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY"] as string | undefined;
const apiKey = env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY"] as string | undefined;
const projectId = env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID"] as string | undefined;

export function firebaseConfig() {
  const messagingSenderId = appId?.split(":")[1] ?? "";
  if (!apiKey || !projectId || !appId || !vapidKey || !messagingSenderId) return null;
  return { apiKey, projectId, appId, messagingSenderId, vapidKey };
}

/**
 * The app's single service worker (push + offline). Push and the offline
 * registration must use this exact URL: a different one at the same scope
 * would replace the other's worker.
 */
export function serviceWorkerUrl(config: NonNullable<ReturnType<typeof firebaseConfig>>) {
  const { vapidKey: _vapidKey, ...appConfig } = config;
  return `/firebase-messaging-sw.js?${new URLSearchParams(appConfig).toString()}`;
}

let registered = false;

/**
 * Installs the service worker for every signed-in student (not only those
 * with push on), so saved pages and words open offline. No permission prompt:
 * notifications still need the student's tap.
 */
export function registerAppServiceWorker(): void {
  if (registered || typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  // Previews inside the editor run in a frame; they must not install a worker.
  if (window.top !== window.self) return;
  const config = firebaseConfig();
  if (!config) return;
  registered = true;
  navigator.serviceWorker.register(serviceWorkerUrl(config)).catch(() => {
    registered = false;
  });
}
