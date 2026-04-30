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
