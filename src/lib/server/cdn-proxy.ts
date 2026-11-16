/**
 * Public CDN-backed JSON routes (investment, character index / kit / summary,
 * TCG cards, upgrade costs) — the CDN counterpart of `cachedRosterRpc`.
 *
 * Owns the "log the real error, return a generic 502" boundary and the shared
 * edge-cache header. Loaders (`#lib/server/*`) own fetching + L1/Valkey; route
 * handlers keep their own short-circuits (404 on a missing entry) visible.
 */
import { error, isHttpError } from "@sveltejs/kit";

/** Cloudflare edge cache for public CDN payloads (5 min + 1 min SWR). */
export const PUBLIC_CDN_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
} as const;

export type LoadFromCdn<T> = {
  /** Log prefix, e.g. `/api/investment` or `/api/character-kit/"HuTao"`. */
  route: string;
  /** Client-facing noun: "Failed to fetch {what} from CDN". */
  what: string;
  load: () => Promise<T>;
};

/**
 * Run a CDN-backed loader. HttpErrors pass through (deliberate statuses);
 * anything else is logged and becomes a generic 502.
 */
export async function loadFromCdn<T>({
  route,
  what,
  load,
}: LoadFromCdn<T>): Promise<T> {
  try {
    return await load();
  } catch (err) {
    if (isHttpError(err)) throw err;
    console.error(`${route}:`, err);
    throw error(502, `Failed to fetch ${what} from CDN`);
  }
}
