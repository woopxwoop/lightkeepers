/**
 * Helpers for keeping filter / sort UI state in the URL so leaving a page and
 * coming back restores the same view.
 *
 * Pages own their parsing (types differ), but share the write path: build a
 * patch of the keys the page owns and let {@link nextSearchPath} decide whether
 * a `replaceState` is warranted.
 */

export type QueryValue = string | string[] | null | undefined;

/** Repeated values for `key`, optionally narrowed to a known set. */
export function readList(
  url: URL,
  key: string,
  allowed?: Iterable<string>,
): string[] {
  const values = url.searchParams.getAll(key).filter(Boolean);
  if (!allowed) return values;
  const valid = allowed instanceof Set ? allowed : new Set(allowed);
  return values.filter((value) => valid.has(value));
}

/** `key` when it is one of `allowed`, else `fallback`. */
export function readEnum<T extends string>(
  url: URL,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = url.searchParams.get(key);
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

/** Compare ignoring order — a shared link shouldn't trigger a rewrite. */
function canonical(params: URLSearchParams): string {
  return [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("&");
}

/**
 * Path + query with `patch` applied, or `null` when the URL already says the
 * same thing. Empty values drop their key (defaults stay out of the URL);
 * params the page doesn't own are preserved.
 */
export function nextSearchPath(
  url: URL,
  patch: Record<string, QueryValue>,
): string | null {
  const params = new URLSearchParams(url.searchParams);

  for (const [key, value] of Object.entries(patch)) {
    params.delete(key);
    const values = value == null ? [] : Array.isArray(value) ? value : [value];
    for (const entry of values) {
      if (entry !== "") params.append(key, entry);
    }
  }

  if (canonical(params) === canonical(url.searchParams)) return null;

  const qs = params.toString();
  return qs ? `${url.pathname}?${qs}` : url.pathname;
}
