/**
 * Server-side gcsim character build summary from CDN (cached).
 * Source: `sim/characters/{GoodKey}.json.gz` (synced by gcsim-r2).
 */
import type { CharacterIndex } from "$lib/types/investment";
import { getSimCharacterSummaryUrl } from "$lib/utils";
import { LRUCache } from "$lib/server/cache";
import { fetchWithTimeout } from "$lib/cdn-fetch";

const summaryCache = new LRUCache<CharacterIndex | null>(200, 15 * 60 * 1000);

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

    const summary = (await res.json()) as CharacterIndex;
    summaryCache.set(goodKey, summary);
    return summary;
  } catch {
    return null;
  }
}
