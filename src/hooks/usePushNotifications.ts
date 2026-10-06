import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";

// Firebase Messaging is loaded only when push is actually used, so it stays
// out of the code every page downloads on app open.
const loadPush = () => import("@/lib/pushNotifications");
import { registerPushToken, unregisterPushToken } from "@/lib/push.functions";
import { readStorage, removeStorage, writeStorage } from "@/lib/safeStorage";

const TOKEN_KEY = "push-token";

// The hook is mounted in more than one place; the server sync runs once per app start.
let tokenSynced = false;

export type PushState = "unknown" | "enabled" | "disabled" | "unsupported" | "not-configured";

/**
 * Manages this device's push registration: enabling stores the FCM token on
 * the server, disabling removes it. The token is mirrored in localStorage so
 * the toggle reflects the device state without a server round-trip.
 */
export function usePushNotifications() {
  const [state, setState] = useState<PushState>("unknown");
  const [token, setToken] = useState<string | null>(null);
  const register = useServerFn(registerPushToken);
  const unregister = useServerFn(unregisterPushToken);

  /**
   * Saves the token; when FCM no longer knows it, renews it once and saves the
   * new one. Returns the token that is now registered (null if none could be).
   */
  const registerValid = useCallback(
    async (candidate: string): Promise<string | null> => {
      const result = await register({ data: { token: candidate } });
      if (result.valid !== false) return candidate;
      const renewed = await (await loadPush()).renewPushToken();
      if (!renewed) return null;
      const again = await register({ data: { token: renewed } });
      return again.valid === false ? null : renewed;
    },
    [register],
  );

  useEffect(() => {
    const saved = readStorage(TOKEN_KEY);
    if (saved && "Notification" in window && Notification.permission === "granted") {
      setToken(saved);
      setState("enabled");
      // The FCM token can rotate: re-read it on start and keep the server in
      // step (this also refreshes last_seen_at), so the device keeps receiving.
      if (tokenSynced) return;
      tokenSynced = true;
      void loadPush()
        .then(({ resumePush }) => resumePush())
        .then(async (current) => {
          if (!current || readStorage(TOKEN_KEY) !== saved) return;
          try {
            const token = await registerValid(current);
            if (token && token !== saved) {
              await unregister({ data: { token: saved } }).catch(() => undefined);
              writeStorage(TOKEN_KEY, token);
              setToken(token);
            }
          } catch {
            // Next app start tries again.
          }
        });
    } else {
      setState("disabled");
    }
  }, [registerValid, unregister]);

  const enable = useCallback(async (): Promise<PushState> => {
    const result = await (await loadPush()).enablePush();
    if (result.status === "registered") {
      const token = await registerValid(result.token);
      if (!token) {
        setState("disabled");
        return "unsupported";
      }
      writeStorage(TOKEN_KEY, token);
      setToken(token);
      setState("enabled");
      // Show messages that arrive while the app is open, from now on.
      void loadPush().then(({ resumePush }) => resumePush());
      return "enabled";
    }
    if (result.status === "not-configured") {
      setState("not-configured");
      return "not-configured";
    }
    if (result.status === "unsupported") {
      setState("unsupported");
      return "unsupported";
    }
    setState("disabled");
    return "disabled";
  }, [registerValid]);

  const disable = useCallback(async () => {
    // The stored token is the current one even if another mount refreshed it.
    const current = readStorage(TOKEN_KEY) ?? token;
    if (current) {
      await unregister({ data: { token: current } });
    }
    removeStorage(TOKEN_KEY);
    setToken(null);
    setState("disabled");
  }, [token, unregister]);

  return { state, token, enable, disable };
}
