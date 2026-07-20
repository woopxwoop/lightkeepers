/**
 * Character kit JSON served from R2 / CDN.
 *
 *   genshin/data/characters/index.json         — CharacterKitIndex
 *   genshin/data/characters/{name_id}.json     — CharacterKit
 *
 * Produced by `scripts/data/extract-characters-json.ts` (via genshin-data
 * `listRichCharacters`) and uploaded by `scripts/sync/character-data-r2.ts`.
 * Fetched at runtime via `$lib/asset-urls` (`fetchCharacterKit*`).
 *
 * Asset fields are Excel / UI_* names only — resolve with `assetUrl` / helpers.
 */

export type CharacterKitSkillSlot = "normal" | "skill" | "burst";

export interface CharacterKitSkill {
  id: number;
  type: CharacterKitSkillSlot;
  name: string;
  description: string;
  icon: string;
}

export interface CharacterKitPassive {
  id: number;
  name: string;
  description: string;
  icon: string;
  /** Ascension unlock; 0 = always / utility (e.g. cooking). */
  unlock: number;
}

export interface CharacterKitConstellation {
  id: number;
  index: number;
  name: string;
  description: string;
  icon: string;
}

export interface CharacterKitAssets {
  portrait: string;
  coop: string;
  card: string;
  gacha: string;
  namecard: string;
  side: string;
}

/** Subset of assets included on `index.json` summary rows. */
export interface CharacterKitIndexAssets {
  portrait: string;
  coop: string;
  gacha: string;
  namecard: string;
}

/**
 * Full kit for one character (`{name_id}.json`).
 * Includes roster fields plus skills / passives / constellations / assets.
 */
export interface CharacterKit {
  game_id: number;
  name_id: string;
  name: string;
  element: string;
  weapon_type: string;
  rarity: number;
  released_at: string | null;
  is_traveler: boolean;
  title: string;
  association: string;
  birthday: { month: number; day: number } | null;
  assets: CharacterKitAssets;
  skills: CharacterKitSkill[];
  passives: CharacterKitPassive[];
  constellations: CharacterKitConstellation[];
}

/** One row in `characters/index.json`. */
export interface CharacterKitIndexEntry {
  game_id: number;
  name_id: string;
  name: string;
  element: string;
  weapon_type: string;
  rarity: number;
  released_at: string | null;
  is_traveler: boolean;
  title: string;
  assets: CharacterKitIndexAssets;
}

/** Full `index.json` payload. */
export type CharacterKitIndex = CharacterKitIndexEntry[];

/** Roster fields shared with DB upsert rows. */
export type CharacterKitRosterFields = Pick<
  CharacterKit,
  | "game_id"
  | "name_id"
  | "name"
  | "element"
  | "weapon_type"
  | "rarity"
  | "released_at"
  | "is_traveler"
>;
