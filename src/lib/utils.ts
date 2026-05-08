export const WEAPON_TYPE_MAP = {
  WEAPON_SWORD_ONE_HAND: "Sword",
  WEAPON_CLAYMORE: "Claymore",
  WEAPON_POLE: "Polearm",
  WEAPON_CATALYST: "Catalyst",
  WEAPON_BOW: "Bow",
} as const;

const CHARACTERS_CDN_BASE = "https://images.lightkeepers.moe/characters";

const ENEMIES_CDN_BASE = "https://images.lightkeepers.moe/enemies";

export function getCharacterPortrait(nameId: string) {
  return `${CHARACTERS_CDN_BASE}/${nameId}/portrait.webp`;
}

export function getCharacterCoop(nameId: string) {
  return `${CHARACTERS_CDN_BASE}/${nameId}/coop.webp`;
}

export function getEnemyAsset(assetId: string) {
  return `${ENEMIES_CDN_BASE}/${assetId}.webp`;
}
