import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";

import { enablePush } from "@/lib/pushNotifications";
import { registerPushToken, unregisterPushToken } from "@/lib/push.functions";

const TOKEN_KEY = "push-token";

export type PushState =
  | "unknown"
  | "enabled"
  | "disabled"
  | "unsupported"
  | "not-configured";

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

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved && Notification.permission === "granted") {
      setToken(saved);
      setState("enabled");
    } else {
      setState("disabled");
    }
  }, []);

  const enable = useCallback(async (): Promise<PushState> => {
    const result = await enablePush();
    if (result.status === "registered") {
      await register({ data: { token: result.token } });
      localStorage.setItem(TOKEN_KEY, result.token);
      setToken(result.token);
      setState("enabled");
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
  }, [register]);

  const disable = useCallback(async () => {
    if (token) {
      await unregister({ data: { token } });
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setState("disabled");
  }, [token, unregister]);

  return { state, token, enable, disable };
}
