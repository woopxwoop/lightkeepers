/**
 * Bound an operation that has no timeout of its own (e.g. a node-redis
 * command): if `op` hasn't settled within `ms`, resolve to `fallback` instead
 * and call `onTimeout`. The operation keeps running; its late result or
 * rejection is ignored. A rejection *before* the deadline still propagates, so
 * callers keep their own error handling.
 *
 * Use it where waiting is worse than a degraded answer — a cache lookup that
 * stalls should become a cache miss, not a hung request.
 */
export async function withinOr<T, F>(
  op: Promise<T>,
  ms: number,
  fallback: F,
  onTimeout?: () => void,
): Promise<T | F> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<F>((resolve) => {
    timer = setTimeout(() => {
      onTimeout?.();
      resolve(fallback);
    }, ms);
    (timer as { unref?: () => void }).unref?.();
  });
  try {
    return await Promise.race([op, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
