// Stores server errors (see serverErrors.ts) in server_errors with the service
// role, so the Admin alerts show when something breaks for a student. Never
// throws and never logs: it runs inside console.error itself.

import { keepAlive } from "@/lib/keepAlive.server";
import { describeServerError } from "@/lib/serverErrors";

/** The same message is stored once a minute, and at most 30 rows a minute. */
const REPEAT_MS = 60_000;
const ROWS_PER_MINUTE = 30;

const lastStored = new Map<string, number>();
let minuteStart = 0;
let minuteRows = 0;
let recording = false;

export function recordServerError(args: unknown[]) {
  if (recording) return;
  recording = true;
  try {
    const error = describeServerError(args);
    if (!error) return;
    const now = Date.now();
    const key = `${error.area}|${error.message}`;
    if (now - (lastStored.get(key) ?? 0) < REPEAT_MS) return;
    if (now - minuteStart >= 60_000) {
      minuteStart = now;
      minuteRows = 0;
    }
    if (minuteRows >= ROWS_PER_MINUTE) return;
    minuteRows += 1;
    lastStored.set(key, now);
    if (lastStored.size > 500) lastStored.clear();
    keepAlive(
      import("@/integrations/supabase/client.server")
        .then(({ supabaseAdmin }) => supabaseAdmin.from("server_errors").insert(error))
        .catch(() => undefined),
    );
  } catch {
    /* recording must never break the request */
  } finally {
    recording = false;
  }
}
