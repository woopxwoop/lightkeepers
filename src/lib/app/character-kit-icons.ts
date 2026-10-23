/**
 * Talent / constellation icons from a character kit, via the same-origin
 * proxy (CDN kits have no browser CORS). Cached per name_id for the session.
 */

import { resolve } from "$app/paths";
import {
  kitIconsFromCharacterKit,
  type InvestmentBuildKitIcons,
} from "$lib/investment-build-card";
import type { CharacterKit } from "$lib/types/character-kit";

const cache = new Map<string, InvestmentBuildKitIcons>();
const pending = new Map<string, Promise<InvestmentBuildKitIcons>>();

export function getCharacterKitIconsCached(
  nameId: string,
): InvestmentBuildKitIcons | null {
  return cache.get(nameId) ?? null;
}

export function loadCharacterKitIcons(
  nameId: string,
): Promise<InvestmentBuildKitIcons> {
  const hit = cache.get(nameId);
  if (hit) return Promise.resolve(hit);
  const existing = pending.get(nameId);
  if (existing) return existing;

  const req = (async () => {
    try {
      const res = await fetch(
        resolve(`/api/character-kit/${encodeURIComponent(nameId)}`),
      );
      if (!res.ok) throw new Error(`kit ${res.status}`);
      const icons = kitIconsFromCharacterKit(
        (await res.json()) as CharacterKit,
      );
      cache.set(nameId, icons);
      return icons;
    } finally {
      pending.delete(nameId);
    }
  })();
  pending.set(nameId, req);
  return req;
}
