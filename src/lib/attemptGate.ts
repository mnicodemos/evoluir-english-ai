/**
 * Small, dependency-free guard for one-shot activities (pronunciation check).
 *
 * It exists to make three rules explicit and testable:
 * 1. only one attempt runs at a time (no duplicated request from a double tap);
 * 2. every attempt ends — success, error, cancel — and releases the lock;
 * 3. a late answer from an old attempt can never be applied to a newer one.
 *
 * There is no timer, no polling and no retry here on purpose.
 */
export type AttemptGate = {
  /** Reserves the gate and returns the attempt id, or null when one is running. */
  begin(): number | null;
  /** True while an attempt is running. */
  isBusy(): boolean;
  /** True when `id` is still the current attempt (use before applying a result). */
  isCurrent(id: number): boolean;
  /** Releases the gate. Ignored when a newer attempt already owns it. */
  end(id: number): void;
  /** Ends the running attempt, if any, so nothing stays locked. */
  reset(): void;
};

export function createAttemptGate(): AttemptGate {
  let running = 0;
  let lastId = 0;

  return {
    begin() {
      if (running !== 0) return null;
      lastId += 1;
      running = lastId;
      return running;
    },
    isBusy() {
      return running !== 0;
    },
    isCurrent(id: number) {
      return running === id;
    },
    end(id: number) {
      if (running === id) running = 0;
    },
    reset() {
      running = 0;
    },
  };
}
