/**
 * Server-side character kit fetch from CDN (cached).
 *
 * Traveler kits are per-element (`PlayerBoy-Anemo.json`). Roster links still
 * use bare `PlayerBoy` — resolve to the first available elemental kit.
 */
import type { CharacterKit } from "$lib/types/character-kit";
import { LRUCache } from "$lib/server/cache";
import { fetchWithTimeout } from "$lib/cdn-fetch";
import { TRAVELER_ELEMENTS } from "$lib/utils";

const CDN_PREFIX = "https://images.lightkeepers.moe/genshin/data/characters";

const kitCache = new LRUCache<CharacterKit | null>(200, 15 * 60 * 1000);

async function fetchKit(nameId: string): Promise<CharacterKit | null> {
  const res = await fetchWithTimeout(
    `${CDN_PREFIX}/${encodeURIComponent(nameId)}.json`,
  );
  if (!res.ok) return null;
  return (await res.json()) as CharacterKit;
}

export async function getCharacterKit(
  nameId: string,
): Promise<CharacterKit | null> {
  try {
    const cached = kitCache.get(nameId);
    if (cached !== undefined) return cached;

    let kit = await fetchKit(nameId);
    if (!kit && (nameId === "PlayerBoy" || nameId === "PlayerGirl")) {
      for (const el of TRAVELER_ELEMENTS) {
        const variantId = `${nameId}-${el}`;
        const variantCached = kitCache.get(variantId);
        if (variantCached !== undefined) {
          if (variantCached) {
            kit = variantCached;
            break;
          }
          continue;
        }
        const variant = await fetchKit(variantId);
        kitCache.set(variantId, variant);
        if (variant) {
          kit = variant;
          break;
        }
      }
    }

    kitCache.set(nameId, kit);
    return kit;
  } catch {
    kitCache.set(nameId, null);
    return null;
  }
}
