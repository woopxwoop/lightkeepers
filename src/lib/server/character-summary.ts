/**
 * Server-side gcsim character build summary from CDN (cached).
 * Source: `sim/characters/{GoodKey}.json.gz` (synced by gcsim-r2).
 */
import type { CharacterIndex } from "$lib/types/investment";
import { getSimCharacterSummaryUrl } from "$lib/utils";
import { LRUCache } from "$lib/server/cache";
import { fetchWithTimeout } from "$lib/cdn-fetch";

const summaryCache = new LRUCache<CharacterIndex | null>(200, 15 * 60 * 1000);

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

  try {
    const cached = summaryCache.get(goodKey);
    if (cached !== undefined) return cached;

    const res = await fetchWithTimeout(getSimCharacterSummaryUrl(goodKey));
    if (!res.ok) {
      summaryCache.set(goodKey, null);
      return null;
    }

    const summary = liveCharacterSummary(
      (await res.json()) as CharacterIndex,
    );
    summaryCache.set(goodKey, summary);
    return summary;
  } catch {
    summaryCache.set(goodKey, null);
    return null;
  }
}
