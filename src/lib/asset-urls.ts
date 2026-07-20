/**
 * Construct CDN asset URLs from datamine `UI_*` icon names / kit JSON.
 *
 * Assets are synced to R2 and served from https://images.lightkeepers.moe:
 *
 *   genshin/ui/{UI_*}.webp                 — textures (portraits, skills, enemies, …)
 *   characters/{name_id}/card.webp         — TCG cards (see getCharacterCard in utils.ts)
 *   genshin/data/characters/index.json     — kit roster summary
 *   genshin/data/characters/{name_id}.json — full kit per character
 *   genshin/data/enemies/index.json        — enemy id → icon stem map
 *
 * Images: scripts/sync/{equipment,namecards,character,character-kit}-images-r2.ts
 * TCG:    scripts/sync/tcg-cards-r2.ts
 * Kits:   scripts/sync/character-data-r2.ts
 *
 * Note: ESM imports from `$lib/data/*.json` (weapons, artifact-sets) are
 * bundled at build time — character kits + enemy index live on the CDN.
 */

import type {
  CharacterKit,
  CharacterKitIndex,
} from "$lib/types/character-kit";
import type { EnemyIndex } from "$lib/types/enemy";
import { fetchWithTimeout } from "$lib/cdn-fetch";

const CDN_BASE = "https://images.lightkeepers.moe";
const UI_PREFIX = `${CDN_BASE}/genshin/ui`;
const CHARACTERS_DATA_PREFIX = `${CDN_BASE}/genshin/data/characters`;
const ENEMIES_DATA_PREFIX = `${CDN_BASE}/genshin/data/enemies`;

function uiUrl(iconName: string): string {
  const base = iconName.replace(/\.(png|webp|jpe?g)$/i, "");
  return `${UI_PREFIX}/${encodeURIComponent(base)}.webp`;
}

// ── Classification ───────────────────────────────

function isRelic(name: string): boolean {
  return name.startsWith("UI_RelicIcon");
}

function isCharacterUi(name: string): boolean {
  return (
    name.startsWith("UI_AvatarIcon") ||
    name.startsWith("UI_CoopImg") ||
    name.startsWith("UI_NameCardPic") ||
    name.startsWith("UI_Gacha_AvatarImg") ||
    name.startsWith("UI_SkillIcon") ||
    name.startsWith("UI_Talent_")
  );
}

function isEnemyUi(name: string): boolean {
  return (
    name.startsWith("UI_MonsterIcon") ||
    name.startsWith("UI_Img_LeyLineChallenge") ||
    name.startsWith("UI_Monster_")
  );
}

// ── Public API ───────────────────────────────────

/** Artifact piece icon or artifact set icon. */
export function artifactIconUrl(iconName: string | null): string | null {
  if (!iconName) return null;
  return uiUrl(iconName);
}

/** Weapon icon (standard or awakened). */
export function weaponIconUrl(iconName: string | null): string | null {
  if (!iconName) return null;
  return uiUrl(iconName);
}

/** Weapon splash / gacha banner art. */
export function weaponSplashUrl(iconName: string | null): string | null {
  if (!iconName) return null;
  return uiUrl(iconName);
}

/** Skill / burst / NA icon (`UI_SkillIcon_*`). */
export function skillIconUrl(iconName: string | null): string | null {
  if (!iconName) return null;
  return uiUrl(iconName);
}

/** Constellation or passive talent icon (`UI_Talent_*`). */
export function talentIconUrl(iconName: string | null): string | null {
  if (!iconName) return null;
  return uiUrl(iconName);
}

/** Character gacha / wish splash (`UI_Gacha_AvatarImg_*`). */
export function characterSplashUrl(iconName: string | null): string | null {
  if (!iconName) return null;
  return uiUrl(iconName);
}

/**
 * Enemy / leyline challenge icon (`UI_MonsterIcon_*`, `UI_Img_LeyLineChallenge_*`).
 * Same genshin/ui path as other textures.
 */
export function enemyIconUrl(iconName: string | null): string | null {
  if (!iconName) return null;
  return uiUrl(iconName);
}

/**
 * Auto-detect the correct URL for any icon name by prefix.
 * Falls back to null for unknown prefixes.
 */
export function assetUrl(iconName: string | null): string | null {
  if (!iconName) return null;
  if (isRelic(iconName)) return artifactIconUrl(iconName);
  if (
    iconName.startsWith("UI_EquipIcon") ||
    iconName.startsWith("UI_Gacha_EquipIcon")
  )
    return weaponIconUrl(iconName);
  if (isCharacterUi(iconName)) return uiUrl(iconName);
  if (isEnemyUi(iconName)) return enemyIconUrl(iconName);
  // Unknown UI_* still lives under genshin/ui once synced.
  if (iconName.startsWith("UI_")) return uiUrl(iconName);
  return null;
}

// ── Character kit JSON (CDN-fetched, not ESM-bundled) ──

/** Roster summary listing (`index.json`). */
export function characterKitIndexUrl(): string {
  return `${CHARACTERS_DATA_PREFIX}/index.json`;
}

/** Full kit for one character (`{name_id}.json`). */
export function characterKitUrl(nameId: string): string {
  return `${CHARACTERS_DATA_PREFIX}/${encodeURIComponent(nameId)}.json`;
}

/** Fetch + parse the character kit index from the CDN. */
export async function fetchCharacterKitIndex(): Promise<CharacterKitIndex> {
  const resp = await fetchWithTimeout(characterKitIndexUrl());
  if (!resp.ok) {
    throw new Error(
      `Failed to fetch character kit index: ${resp.status} ${resp.statusText}`,
    );
  }
  return (await resp.json()) as CharacterKitIndex;
}

/** Fetch + parse one character's kit JSON from the CDN. */
export async function fetchCharacterKit(nameId: string): Promise<CharacterKit> {
  const resp = await fetchWithTimeout(characterKitUrl(nameId));
  if (!resp.ok) {
    throw new Error(
      `Failed to fetch character kit (${nameId}): ${resp.status} ${resp.statusText}`,
    );
  }
  return (await resp.json()) as CharacterKit;
}

// ── Enemy index JSON (CDN map; live slots still come from /api/static) ──

export function enemyIndexUrl(): string {
  return `${ENEMIES_DATA_PREFIX}/index.json`;
}

/** Fetch + parse the enemy icon index from the CDN. */
export async function fetchEnemyIndex(): Promise<EnemyIndex> {
  const resp = await fetchWithTimeout(enemyIndexUrl());
  if (!resp.ok) {
    throw new Error(
      `Failed to fetch enemy index: ${resp.status} ${resp.statusText}`,
    );
  }
  return (await resp.json()) as EnemyIndex;
}
