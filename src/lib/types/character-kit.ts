/**
 * Character kit JSON served from R2 / CDN.
 *
 *   genshin/data/characters/index.json                  — CharacterKitIndex
 *   genshin/data/characters/{name_id}.json              — CharacterKit
 *   genshin/data/characters/{name_id}-{Element}.json    — Traveler resonance
 *                                                       (e.g. PlayerBoy-Anemo)
 *
 * Produced by `scripts/data/extract-characters-json.ts` (via genshin-data
 * `listRichCharacters`) and uploaded by `scripts/sync/character-data-r2.ts`.
 * Fetched at runtime via `$lib/asset-urls` (`fetchCharacterKit*`).
 *
 * Asset fields are Excel / UI_* names only — resolve with `assetUrl` / helpers.
 */

export type CharacterKitSkillSlot = "normal" | "skill" | "burst";

/** Normal ascension/utility vs Hexerei / Polestar Field extra talents. */
export type CharacterKitPassiveKind = "passive" | "hexerei" | "polestar";

/** Quest-unlocked enhance line (Hexerei / Polestar Field). */
export type CharacterKitEnhanceKind = "hexerei" | "polestar";

export interface CharacterKitSkill {
  id: number;
  type: CharacterKitSkillSlot;
  name: string;
  description: string;
  icon: string;
  /** Full description after Hexerei / Polestar Field unlock (when different). */
  enhanceDescription?: string;
}

export interface CharacterKitPassive {
  id: number;
  name: string;
  description: string;
  icon: string;
  /** Ascension unlock; 0 = always / utility (e.g. cooking) or quest-gated extras. */
  unlock: number;
  /** Defaults to `"passive"` when omitted (older CDN kits). */
  kind?: CharacterKitPassiveKind;
  /** Enhanced passive text after Hexerei / Polestar Field unlock. */
  enhanceDescription?: string;
}

export interface CharacterKitConstellation {
  id: number;
  index: number;
  name: string;
  description: string;
  icon: string;
  /** Enhanced constellation text after Hexerei / Polestar Field unlock. */
  enhanceDescription?: string;
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
  element: string | null;
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
  /** Present when the character has a Hexerei or Polestar Field enhance line. */
  enhanceKind?: CharacterKitEnhanceKind;
}

/** One row in `characters/index.json`. */
export interface CharacterKitIndexEntry {
  game_id: number;
  name_id: string;
  name: string;
  element: string | null;
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
