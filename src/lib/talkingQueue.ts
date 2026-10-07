/**
 * AI Speaking requests (openers and replies) run one at a time in this tab.
 * The server allows one "talking" request per student; a second one is refused
 * with "Another AI request is already running" and the student saw an error.
 * That happened when the screen was reopened (AI Speaking ↔ Video call) while
 * the previous opener was still being answered, or on a quick double tap.
 *
 * The queue lives at module level, so it survives the screen remounting: a new
 * request waits for the previous one (up to a deadline), and if the server
 * still reports it busy, it is retried a few times before giving up.
 */
let previous: Promise<unknown> = Promise.resolve();

const WAIT_PREVIOUS_MS = 25_000;
export const BUSY_RETRY_DELAYS_MS = [1_500, 3_000, 4_500];

export function isTalkingBusy(error: unknown) {
  return error instanceof Error && /already running/i.test(error.message);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs `request`, retrying while the server says another request is running. */
export async function retryWhileBusy<T>(
  request: () => Promise<T>,
  options: { signal?: AbortSignal; wait?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const wait = options.wait ?? sleep;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      const delay = BUSY_RETRY_DELAYS_MS[attempt];
      if (!isTalkingBusy(error) || delay === undefined || options.signal?.aborted) throw error;
      await wait(delay);
      if (options.signal?.aborted) throw error;
    }
  }
}

/** Queues one AI Speaking request behind the previous one in this tab. */
export function talkingTurn<T>(
  request: () => Promise<T>,
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const waitPrevious = Promise.race([
    previous.catch(() => undefined),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, WAIT_PREVIOUS_MS);
    }),
  ]).finally(() => clearTimeout(timer));
  const run = waitPrevious.then(() => retryWhileBusy(request, options));
  previous = run.catch(() => undefined);
  return run;
}
