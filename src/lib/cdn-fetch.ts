/** Bounded CDN / remote fetches — no project-wide convention existed; 10s is the shared default. */
export const CDN_FETCH_TIMEOUT_MS = 10_000;

/**
 * Wrap a `fetch` so every call — headers and body — aborts after `timeoutMs`,
 * while still honouring any signal the caller passes. Use it where a client
 * library takes a custom fetch (e.g. Supabase's `global.fetch`): a request that
 * never settles would otherwise hold every caller coalesced behind it —
 * `LRUCache.getOrSet` shares one in-flight promise per key.
 *
 * The deadline rejects with an `AbortError` (message names the deadline), not
 * a `TimeoutError`: retrying clients treat AbortError as final, while a
 * TimeoutError from a signal they didn't create looks like a network failure.
 * postgrest-js would re-send a stalled GET 3 more times (+1/2/4 s backoff),
 * turning a 20 s ceiling into ~87 s.
 */
export function withDeadline(
  fetchImpl: typeof fetch,
  timeoutMs: number,
): typeof fetch {
  return (input, init) => {
    const deadline = new AbortController();
    const timer = setTimeout(
      () =>
        deadline.abort(
          new DOMException(
            `Request exceeded its ${timeoutMs} ms deadline`,
            "AbortError",
          ),
        ),
      timeoutMs,
    );
    // Stays armed after the headers arrive so a stalled body is bounded too;
    // aborting a finished request is a no-op. Don't hold the process open.
    (timer as { unref?: () => void }).unref?.();
    const signal = init?.signal
      ? AbortSignal.any([init.signal, deadline.signal])
      : deadline.signal;
    return fetchImpl(input, { ...init, signal });
  };
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = CDN_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
