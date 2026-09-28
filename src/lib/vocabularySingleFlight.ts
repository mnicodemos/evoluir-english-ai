/**
 * One vocabulary generation per user at a time in this browser. The lesson
 * page, the Dashboard recovery and the Vocabulary page all share the request
 * already running instead of starting a second one (which the server would
 * refuse with "Another AI request is already running").
 */
const inFlight = new Map<string, Promise<unknown>>();

export function vocabularySingleFlight<T>(userId: string, run: () => Promise<T>): Promise<T> {
  const running = inFlight.get(userId) as Promise<T> | undefined;
  if (running) return running;
  const next = run().finally(() => inFlight.delete(userId));
  inFlight.set(userId, next);
  return next;
}
