"use client";

/**
 * Small helper to ensure voice transcript persistence finishes before
 * persisting the assistant reply. It tracks the last in-flight promise and
 * lets callers await it without surfacing errors.
 */
export function createTranscriptGuard() {
  let pending: Promise<void> | null = null;
  let holdCount = 0;
  let holdResolver: (() => void) | null = null;
  let holdPromise: Promise<void> | null = null;

  function ensureHoldPromise() {
    if (!holdPromise) {
      holdPromise = new Promise<void>((resolve) => {
        holdResolver = resolve;
      });
    }
  }

  return {
    register(promise: Promise<void>) {
      pending = promise;
      promise
        .catch(() => {
          /* swallow */
        })
        .finally(() => {
          if (pending === promise) {
            pending = null;
          }
        });
    },
    hold() {
      holdCount += 1;
      ensureHoldPromise();
    },
    release() {
      holdCount = Math.max(0, holdCount - 1);
      if (holdCount === 0 && holdResolver) {
        holdResolver();
        holdResolver = null;
        holdPromise = null;
      }
    },
    async wait() {
      // Loop until there is no pending promise and no active hold.
      // This covers the case where a pending promise is registered
      // after wait() has already begun.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const waits: Promise<void>[] = [];
        const currentPending = pending;
        const hasHold = holdCount > 0;
        const currentHold = hasHold ? holdPromise : null;

        if (currentPending) {
          waits.push(
            currentPending.catch(() => {
              /* ignore */
            }) as Promise<void>
          );
        }
        if (currentHold) {
          waits.push(
            currentHold.catch(() => {
              /* ignore */
            }) as Promise<void>
          );
        }

        if (!waits.length) return;
        await Promise.all(waits);

        if (!pending && holdCount === 0) {
          return;
        }
      }
    },
  };
}
