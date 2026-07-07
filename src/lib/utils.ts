export const WEAPON_TYPE_MAP = {
  WEAPON_SWORD_ONE_HAND: "Sword",
  WEAPON_CLAYMORE: "Claymore",
  WEAPON_POLE: "Polearm",
  WEAPON_CATALYST: "Catalyst",
  WEAPON_BOW: "Bow",
} as const;

/** Characters released within this many days are considered "new". */
export const NEW_CHARACTER_DAYS = 20;

/**
 * Whether a character was released recently enough to be flagged as "new".
 * Characters with no `released_at` are not considered new.
 */
export function isNewCharacter(releasedAt: string | null | undefined): boolean {
  if (!releasedAt) return false;
  // Normalize space-separated timestamps (e.g. "2026-06-29 16:00:00+00")
  // to ISO 8601 format so `new Date()` parses reliably across runtimes.
  const released = new Date(releasedAt.replace(" ", "T"));
  if (isNaN(released.getTime())) return false;
  const cutoff = Date.now() - NEW_CHARACTER_DAYS * 86_400_000;
  return released.getTime() > cutoff;
}

const CHARACTERS_CDN_BASE = "https://images.lightkeepers.moe/characters";

const ENEMIES_CDN_BASE = "https://images.lightkeepers.moe/enemies";

export function getCharacterPortrait(nameId: string) {
  return `${CHARACTERS_CDN_BASE}/${nameId}/portrait.webp`;
}

export function getCharacterCoop(nameId: string) {
  return `${CHARACTERS_CDN_BASE}/${nameId}/coop.webp`;
}

export function getCharacterCard(nameId: string) {
  return `${CHARACTERS_CDN_BASE}/${nameId}/card.webp`;
}

export function getEnemyAsset(assetId: string) {
  return `${ENEMIES_CDN_BASE}/${assetId}.webp`;
}
