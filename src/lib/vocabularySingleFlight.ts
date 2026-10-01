/**
 * One vocabulary generation per user at a time in this browser. The lesson
 * page, the Dashboard recovery and the Vocabulary page all share the request
 * already running instead of starting a second one (which the server would
 * refuse with "Another AI request is already running").
 *
 * A request that never answers (connection dropped mid-generation) is released
 * after a deadline, so it can never block every later attempt in this tab.
 */
const inFlight = new Map<string, Promise<unknown>>();
const DEADLINE_MS = 80_000;

export function vocabularySingleFlight<T>(userId: string, run: () => Promise<T>): Promise<T> {
  const running = inFlight.get(userId) as Promise<T> | undefined;
  if (running) return running;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("The word generation is busy. Please wait a moment.")),
      DEADLINE_MS,
    );
  });
  const next = Promise.race([run(), deadline]).finally(() => {
    clearTimeout(timer);
    if (inFlight.get(userId) === next) inFlight.delete(userId);
  });
  inFlight.set(userId, next);
  return next;
}
