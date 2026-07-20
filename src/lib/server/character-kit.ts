/**
 * Server-side character kit fetch from CDN (cached).
 */
import type { CharacterKit } from "$lib/types/character-kit";
import { LRUCache } from "$lib/server/cache";

const CDN_PREFIX = "https://images.lightkeepers.moe/genshin/data/characters";

const kitCache = new LRUCache<CharacterKit>(200, 15 * 60 * 1000);

export async function getCharacterKit(
  nameId: string,
): Promise<CharacterKit | null> {
  try {
    const cached = kitCache.get(nameId);
    if (cached !== undefined) return cached;

    const res = await fetch(
      `${CDN_PREFIX}/${encodeURIComponent(nameId)}.json`,
    );
    if (!res.ok) return null;

    const kit = (await res.json()) as CharacterKit;
    kitCache.set(nameId, kit);
    return kit;
  } catch {
    return null;
  }
}
