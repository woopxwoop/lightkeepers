/**
 * Server-side character kit fetch from CDN (cached).
 */
import type { CharacterKit } from "$lib/types/character-kit";
import { characterKitUrl } from "$lib/asset-urls";
import { LRUCache } from "$lib/server/cache";
import { fetchWithTimeout } from "$lib/cdn-fetch";
import { mergeTravelerKits, travelerElementKitId } from "$lib/traveler-kits";
import { TRAVELER_GUIDE_ELEMENTS } from "$lib/utils";

const kitCache = new LRUCache<CharacterKit | null>(200, 15 * 60 * 1000);

/**
 * Concurrent misses for one name_id share a single request. Entries are dropped
 * once settled, so a failed fetch (which is deliberately not cached) retries.
 * `LRUCache.getOrSet` is unusable here because it caches every resolved value,
 * including the transient failures this module must leave uncached.
 */
const kitInflight = new Map<string, Promise<CharacterKit | null>>();

export async function getCharacterKit(
  nameId: string,
): Promise<CharacterKit | null> {
  const cached = kitCache.get(nameId);
  if (cached !== undefined) return cached;

  const inflight = kitInflight.get(nameId);
  if (inflight) return inflight;

  const pending = loadKitFromCdn(nameId).finally(() => {
    kitInflight.delete(nameId);
  });
  kitInflight.set(nameId, pending);
  return pending;
}

async function loadKitFromCdn(nameId: string): Promise<CharacterKit | null> {
  const res = await fetchWithTimeout(characterKitUrl(nameId));

  // A definitive "this file does not exist" is the only cacheable negative, and
  // the only one reported as null. 5xx / transport / parse failures throw so
  // callers can tell an absent character from a CDN outage, and stay uncached
  // so the next request retries instead of serving a bogus 404 for the TTL.
  if (res.status === 404 || res.status === 410) {
    kitCache.set(nameId, null);
    return null;
  }
  if (!res.ok) {
    throw new Error(`character kit ${nameId} unavailable: HTTP ${res.status}`);
  }

  const kit = (await res.json()) as CharacterKit;
  kitCache.set(nameId, kit);
  return kit;
}

/**
 * Load every available Traveler resonance kit for a base character page.
 * Missing CDN files are skipped; see `mergeTravelerKits` for base fallback.
 */
export async function getTravelerElementKits(
  base: CharacterKit,
): Promise<Record<string, CharacterKit>> {
  if (!base.is_traveler) return {};

  const entries = await Promise.all(
    TRAVELER_GUIDE_ELEMENTS.map(async (element) => {
      const nameId = travelerElementKitId(base.name_id, element);
      try {
        return [element, await getCharacterKit(nameId)] as const;
      } catch (err) {
        // One flaky resonance must not take the whole character page down; the
        // element picker just omits it.
        console.warn(`[character-kit] skipping ${nameId}:`, err);
        return [element, null] as const;
      }
    }),
  );

  const byElement: Partial<Record<string, CharacterKit | null>> = {};
  for (const [element, kit] of entries) {
    byElement[element] = kit;
  }

  return mergeTravelerKits(base, byElement);
}
