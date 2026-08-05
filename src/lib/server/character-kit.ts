/**
 * Server-side character kit fetch from CDN (cached).
 */
import type { CharacterKit } from "$lib/types/character-kit";
import { LRUCache } from "$lib/server/cache";
import { fetchWithTimeout } from "$lib/cdn-fetch";
import { mergeTravelerKits, travelerElementKitId } from "$lib/traveler-kits";
import { TRAVELER_GUIDE_ELEMENTS } from "$lib/utils";

const CDN_PREFIX = "https://images.lightkeepers.moe/genshin/data/characters";

const kitCache = new LRUCache<CharacterKit | null>(200, 15 * 60 * 1000);

export async function getCharacterKit(
  nameId: string,
): Promise<CharacterKit | null> {
  try {
    const cached = kitCache.get(nameId);
    if (cached !== undefined) return cached;

    const res = await fetchWithTimeout(
      `${CDN_PREFIX}/${encodeURIComponent(nameId)}.json`,
    );
    if (!res.ok) {
      kitCache.set(nameId, null);
      return null;
    }

    const kit = (await res.json()) as CharacterKit;
    kitCache.set(nameId, kit);
    return kit;
  } catch {
    kitCache.set(nameId, null);
    return null;
  }
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
      const kit = await getCharacterKit(
        travelerElementKitId(base.name_id, element),
      );
      return [element, kit] as const;
    }),
  );

  const byElement: Partial<Record<string, CharacterKit | null>> = {};
  for (const [element, kit] of entries) {
    byElement[element] = kit;
  }

  return mergeTravelerKits(base, byElement);
}
