import { getApp, getApps, initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";

import { firebaseConfig, serviceWorkerUrl } from "@/lib/firebaseConfig";

export type PushResult =
  | { status: "registered"; token: string }
  | { status: "not-configured" | "unsupported" | "open-in-new-tab" | "denied" };

/** Same service worker and Firebase app for every call (a second initializeApp throws). */
async function messagingForDevice(config: NonNullable<ReturnType<typeof firebaseConfig>>) {
  const { vapidKey: _vapidKey, ...appConfig } = config;
  const serviceWorkerRegistration = await navigator.serviceWorker.register(
    serviceWorkerUrl(config),
  );
  const app = getApps().length ? getApp() : initializeApp(appConfig);
  return { messaging: getMessaging(app), serviceWorkerRegistration };
}

/**
 * Registers this device for push notifications. Must be called from a click
 * handler: browsers ignore permission requests without a user gesture.
 */
export async function enablePush(): Promise<PushResult> {
  const config = firebaseConfig();
  if (!config) return { status: "not-configured" };
  if (!("Notification" in window) || !(await isSupported())) {
    return { status: "unsupported" };
  }
  if (window.top !== window.self) {
    return { status: "open-in-new-tab" };
  }

  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") {
    return { status: "denied" };
  }

  const { messaging, serviceWorkerRegistration } = await messagingForDevice(config);
  const token = await getToken(messaging, { vapidKey: config.vapidKey, serviceWorkerRegistration });
  return token ? { status: "registered", token } : { status: "denied" };
}

/**
 * Re-attaches an already enabled device on app start, without any prompt:
 * returns the current FCM token (it can rotate) and shows messages that
 * arrive while the app is open, which Firebase otherwise hands to the page
 * silently instead of displaying them.
 */
let resumed: Promise<string | null> | null = null;

export function resumePush(): Promise<string | null> {
  // Several components use the push hook; the listener is attached only once.
  resumed ??= attachDevice().catch(() => {
    resumed = null;
    return null;
  });
  return resumed;
}

async function attachDevice(): Promise<string | null> {
  const config = firebaseConfig();
  if (!config || !("Notification" in window) || Notification.permission !== "granted") {
    return null;
  }
  if (window.top !== window.self || !(await isSupported())) return null;

  const { messaging, serviceWorkerRegistration } = await messagingForDevice(config);
  onMessage(messaging, (payload) => {
    const title = payload.notification?.title;
    if (!title) return;
    void serviceWorkerRegistration.showNotification(title, {
      body: payload.notification?.body ?? "",
      icon: "/icon-192.png",
      data: { path: payload.data?.["path"] ?? "/dashboard" },
    });
  });
  return (
    (await getToken(messaging, { vapidKey: config.vapidKey, serviceWorkerRegistration })) || null
  );
}
