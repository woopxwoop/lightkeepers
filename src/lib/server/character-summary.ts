/**
 * Server-side gcsim character build summary from CDN (cached).
 * Source: `sim/characters/{GoodKey}.json.gz` (synced by gcsim-r2).
 *
 * Concurrent misses share one request (kit-style inflight map). Definitive
 * absences (404/410/empty body) are cached as null; transport / 5xx failures
 * stay uncached so the next request retries.
 */
import type { CharacterIndex } from "$lib/types/investment";
import { getSimCharacterSummaryUrl } from "$lib/utils";
import { LRUCache } from "$lib/server/cache";
import { fetchWithTimeout } from "$lib/cdn-fetch";

const summaryCache = new LRUCache<CharacterIndex | null>(200, 15 * 60 * 1000);
const summaryInflight = new Map<string, Promise<CharacterIndex | null>>();

/** No sim/guide body — merge tombstone, not a stale-but-present summary. */
export function isSummaryTombstone(
  summary: CharacterIndex | null | undefined,
): boolean {
  if (!summary || summary.upToDate !== false) return false;
  return !Array.isArray(summary.weapons);
}

/**
 * Drop merge tombstones. Stale-but-present summaries (`upToDate: false` with
 * a body, e.g. Yae after a kit buff) are returned so the UI can hide numbers.
 */
export function liveCharacterSummary(
  summary: CharacterIndex | null | undefined,
): CharacterIndex | null {
  if (!summary || isSummaryTombstone(summary)) return null;
  return summary;
}

export async function getCharacterSummary(
  goodKey: string,
): Promise<CharacterIndex | null> {
  if (!goodKey) return null;

  const cached = summaryCache.get(goodKey);
  if (cached !== undefined) return cached;

  const inflight = summaryInflight.get(goodKey);
  if (inflight) return inflight;

  const pending = loadSummaryFromCdn(goodKey).finally(() => {
    summaryInflight.delete(goodKey);
  });
  summaryInflight.set(goodKey, pending);
  return pending;
}

async function loadSummaryFromCdn(
  goodKey: string,
): Promise<CharacterIndex | null> {
  const res = await fetchWithTimeout(getSimCharacterSummaryUrl(goodKey));

  if (res.status === 404 || res.status === 410) {
    summaryCache.set(goodKey, null);
    return null;
  }
  if (!res.ok) {
    throw new Error(
      `character summary ${goodKey} unavailable: HTTP ${res.status}`,
    );
  }

  const summary = liveCharacterSummary((await res.json()) as CharacterIndex);
  summaryCache.set(goodKey, summary);
  return summary;
}
