import { AsyncLocalStorage } from "node:async_hooks";

type ExecutionContext = { waitUntil?: (promise: Promise<unknown>) => void };

/** The hosting request context, so work can outlive a dropped browser connection. */
export const requestContext = new AsyncLocalStorage<ExecutionContext | undefined>();

/**
 * Lets `promise` keep running after the browser disconnects (page closed,
 * phone locked). Without this, the host cancels the work mid-way and the
 * result (e.g. a lesson's vocabulary batch) is never saved.
 */
export function keepAlive<T>(promise: Promise<T>): Promise<T> {
  const ctx = requestContext.getStore();
  try {
    ctx?.waitUntil?.(promise.catch(() => undefined));
  } catch {
    /* not available in this runtime */
  }
  return promise;
}
