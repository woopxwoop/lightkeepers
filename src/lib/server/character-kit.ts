/**
 * Server-side character kit fetch from CDN (cached).
 * Live kits under `genshin/data/characters/`; CB kits under `genshin/data/beta/characters/`.
 */
import type { CharacterKit } from "#lib/types/character-kit.js";
import { characterKitUrl, type CharacterKitChannel } from "#lib/asset-urls.js";
import { LRUCache } from "#lib/server/cache.js";
import { fetchWithTimeout } from "#lib/cdn-fetch.js";
import { mergeTravelerKits, travelerElementKitId } from "#lib/traveler-kits.js";
import { TRAVELER_GUIDE_ELEMENTS } from "#lib/utils.js";

export type CharacterKitResult = {
  kit: CharacterKit;
  channel: CharacterKitChannel;
};

/**
 * Kits rarely change, so past the 15 min TTL a cached kit is served immediately
 * while a background refresh runs, for up to a day. A CDN hiccup then degrades
 * to a slightly old kit instead of a 503. Concurrent misses share one fetch
 * (getOrSet singleflight). CDN failures throw from loadKitFromCdn, and getOrSet
 * never stores a rejection, so they retry.
 *
 * A definitive "no such character" lives in kitMissCache instead, with a hard
 * 15 min expiry and no SWR, so a newly released kit shows up on the first
 * request after the miss expires rather than a stale 404.
 */
const kitCache = new LRUCache<CharacterKitResult>(200, 15 * 60 * 1000, {
  staleWhileRevalidate: true,
  maxStaleMs: 24 * 60 * 60 * 1000,
});
const kitMissCache = new LRUCache<true>(500, 15 * 60 * 1000);

class KitNotFound extends Error {}

export async function getCharacterKitResult(
  nameId: string,
): Promise<CharacterKitResult | null> {
  if (kitMissCache.get(nameId)) return null;
  try {
    return await kitCache.getOrSet(nameId, () => loadKitFromCdn(nameId));
  } catch (err) {
    if (!(err instanceof KitNotFound)) throw err;
    kitMissCache.set(nameId, true);
    return null;
  }
}

export async function getCharacterKit(
  nameId: string,
): Promise<CharacterKit | null> {
  const result = await getCharacterKitResult(nameId);
  return result?.kit ?? null;
}

async function loadKitFromCdn(nameId: string): Promise<CharacterKitResult> {
  // Try live first so release kits stay on the Dimbreath path; fall back to
  // beta for CB-only characters (Alyosha / Odette, …).
  for (const channel of ["live", "beta"] as const) {
    const res = await fetchWithTimeout(characterKitUrl(nameId, channel));

    // A definitive "this file does not exist" is the only cacheable negative.
    // 5xx / transport / parse failures throw so callers can tell an absent
    // character from a CDN outage, and stay uncached so the next request retries.
    if (res.status === 404 || res.status === 410) continue;
    if (!res.ok) {
      throw new Error(
        `character kit ${nameId} unavailable (${channel}): HTTP ${res.status}`,
      );
    }

    const kit = (await res.json()) as CharacterKit;
    return { kit, channel };
  }

  throw new KitNotFound(`character kit ${nameId} not found`);
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
