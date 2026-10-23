/**
 * Helpers for keeping filter / sort UI state in the URL so leaving a page and
 * coming back restores the same view.
 *
 * Pages own their parsing (types differ), but share the write path: build a
 * patch of the keys the page owns and let {@link nextSearchPath} decide whether
 * a URL rewrite is warranted.
 */

export type QueryValue = string | string[] | null | undefined;

/** `page.url` is readonly in Kit 3; readers only need these lookups. */
type SearchParamsLike = {
  get(name: string): string | null;
  getAll(name: string): string[];
  entries(): Iterable<[string, string]>;
};

type QueryUrl = {
  pathname: string;
  hash: string;
  searchParams: SearchParamsLike;
};

/** Repeated values for `key`, optionally narrowed to a known set. */
export function readList(
  url: QueryUrl,
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
  url: QueryUrl,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = url.searchParams.get(key);
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

/** Compare ignoring order — a shared link shouldn't trigger a rewrite. */
function canonical(params: SearchParamsLike): string {
  return [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("&");
}

/** Same members, ignoring order — for `Set`-backed multi-select filters. */
export function sameSet(current: Set<string>, values: string[]): boolean {
  return current.size === values.length && values.every((v) => current.has(v));
}

/** Same values in the same order — for filters where order is meaningful. */
export function sameList(current: string[], values: string[]): boolean {
  return (
    current.length === values.length && current.every((v, i) => v === values[i])
  );
}

/**
 * Path + query with `patch` applied, or `null` when the URL already says the
 * same thing. Empty values drop their key (defaults stay out of the URL);
 * params the page doesn't own are preserved, as is any fragment.
 */
export function nextSearchPath(
  url: QueryUrl,
  patch: Record<string, QueryValue>,
): string | null {
  const params = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    params.append(key, value);
  }

  for (const [key, value] of Object.entries(patch)) {
    params.delete(key);
    const values = value == null ? [] : Array.isArray(value) ? value : [value];
    for (const entry of values) {
      if (entry !== "") params.append(key, entry);
    }
  }

  if (canonical(params) === canonical(url.searchParams)) return null;

  const qs = params.toString();
  const path = qs ? `${url.pathname}?${qs}` : url.pathname;
  return `${path}${url.hash}`;
}
