import weaponsRaw from "$lib/data/weapons.json";
import artifactSetsRaw from "$lib/data/artifact-sets.json";

export const WEAPON_TYPE_MAP = {
  WEAPON_SWORD_ONE_HAND: "Sword",
  WEAPON_CLAYMORE: "Claymore",
  WEAPON_POLE: "Polearm",
  WEAPON_CATALYST: "Catalyst",
  WEAPON_BOW: "Bow",
} as const;

/** Human label for a Dimbreath / Excel `weaponType` enum value. */
export function weaponTypeLabel(weaponType: string): string {
  return (
    WEAPON_TYPE_MAP[weaponType as keyof typeof WEAPON_TYPE_MAP] ?? weaponType
  );
}

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

const CDN_BASE = "https://images.lightkeepers.moe";
const GENSIN_UI_BASE = `${CDN_BASE}/genshin/ui`;

function genshinUiUrl(uiName: string): string {
  return `${GENSIN_UI_BASE}/${encodeURIComponent(uiName)}.webp`;
}

export function getCharacterPortrait(nameId: string) {
  return genshinUiUrl(`UI_AvatarIcon_${nameId}`);
}

export function getCharacterCoop(nameId: string) {
  return genshinUiUrl(`UI_CoopImg_${nameId}`);
}

/**
 * TCG character card art. Synced by `scripts/sync/tcg-cards-r2.ts` to
 * `characters/{name_id}/card.webp` (not genshin/ui — keep that prefix for TCG).
 */
export function getCharacterCard(nameId: string) {
  return `${CDN_BASE}/characters/${encodeURIComponent(nameId)}/card.webp`;
}

export function getCharacterGachaSplash(nameId: string) {
  return genshinUiUrl(`UI_Gacha_AvatarImg_${nameId}`);
}

/** CDN URL for a skill / talent UI_* icon name from character kit JSON. */
export function getUiAssetUrl(uiName: string) {
  return genshinUiUrl(uiName.replace(/\.(png|webp|jpe?g)$/i, ""));
}

/**
 * Enemy icon URL. `assetId` is the DB `enemies.asset` stem (UI_MonsterIcon_*,
 * UI_Img_LeyLineChallenge_*, …) — same flat genshin/ui layout as other textures.
 */
export function getEnemyAsset(assetId: string) {
  return genshinUiUrl(assetId.replace(/\.(png|webp|jpe?g)$/i, ""));
}

// ── GOOD key helpers ────────────────────────────────────────────────────────
//
// GOOD keys are PascalCase derived by removing all symbols from the name and
// capitalising each word (e.g. "Gladiator's Finale" → "GladiatorsFinale",
// "Wolf-Fang" → "WolfFang", "The Catch" → "TheCatch").

/**
 * Derive a GOOD key from a human-readable name by stripping symbols and spaces.
 * Compatible with character `name`, weapon `name`, and artifact set `name`.
 */
export function toGoodKey(name: string | null): string {
  return (name ?? "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

/**
 * Build a Map from GOOD key → object with a `name` field.
 * Generic so it works for Characters, weapons, and artifact sets alike.
 */
export function buildGoodKeyMap<T extends { name: string | null }>(
  items: T[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = toGoodKey(item.name);
    if (key) map.set(key, item);
  }
  return map;
}

// ── Static weapon & artifact data ───────────────────────────────────────────

export interface WeaponData {
  id: number;
  name: string;
  stars: number;
  weaponType: string;
  icon: string;
  awakenIcon: string;
  splashIcon: string;
  /** Ascended base ATK at level 90. */
  baseAtk: number;
  /** Secondary stat at level 90, or null. */
  subStat: {
    propType: string;
    label: string;
    value: number;
    isPercent: boolean;
  } | null;
  /** Passive refinements R1–R5 (empty when none). */
  refinements: { rank: number; description: string }[];
}

export interface ArtifactSetData {
  id: number;
  name: string;
  icon: string;
  bonuses: { needCount: number; description: string }[];
}

/** Pre-built: GOOD weapon key → WeaponData */
export const weaponByKey = buildGoodKeyMap(weaponsRaw as WeaponData[]);

/** Pre-built: GOOD artifact set key → ArtifactSetData */
export const artifactSetByKey = buildGoodKeyMap(artifactSetsRaw as ArtifactSetData[]);

/**
 * Community baseline treats 4★ weapons as R0 — refinement is rarely ranked.
 * Unknown keys are treated as not-4★ so we don't invent R0 for missing data.
 */
export function isFourStarWeapon(weaponKey: string): boolean {
  const weapon = weaponByKey.get(weaponKey);
  return weapon ? weapon.stars <= 4 : false;
}

/** Refinement to show in UI (always 0 for 4★ weapons). */
export function displayWeaponRefinement(
  weaponKey: string,
  refinement: number,
): number {
  return isFourStarWeapon(weaponKey) ? 0 : refinement;
}

/**
 * Format constellation + refinement for investment cards.
 * 4★ weapons always show R0.
 */
export function formatInvestmentCR(
  cons: number,
  refinement: number,
  weaponKey: string,
): string {
  return `C${cons}R${displayWeaponRefinement(weaponKey, refinement)}`;
}

/** Weapon GOOD keys longest-first — avoids partial replacements in labels. */
const WEAPON_KEYS_BY_LENGTH = [...weaponByKey.keys()].sort(
  (a, b) => b.length - a.length,
);

/**
 * Replace GOOD weapon keys in an investment sim label with display names.
 * Leaves character keys / C/R tokens alone.
 */
export function humanizeInvestmentLabel(label: string): string {
  if (!label) return label;
  let out = label;
  for (const key of WEAPON_KEYS_BY_LENGTH) {
    if (!out.includes(key)) continue;
    const name = weaponByKey.get(key)?.name;
    if (!name) continue;
    out = out.split(key).join(name);
  }
  return out;
}

// ── Stat key → English ──────────────────────────────────────────────────────
//
// gcsim uses internal stat keys defined in the GOOD interface.
// This map translates them to human-readable English labels.

const STAT_KEY_MAP: Record<string, string> = {
  // Flat
  hp: "HP",
  atk: "ATK",
  def: "DEF",
  // Percentage
  hp_: "HP%",
  atk_: "ATK%",
  def_: "DEF%",
  // Elemental DMG
  pyro_dmg_: "Pyro DMG Bonus",
  hydro_dmg_: "Hydro DMG Bonus",
  cryo_dmg_: "Cryo DMG Bonus",
  electro_dmg_: "Electro DMG Bonus",
  anemo_dmg_: "Anemo DMG Bonus",
  geo_dmg_: "Geo DMG Bonus",
  dendro_dmg_: "Dendro DMG Bonus",
  physical_dmg_: "Physical DMG Bonus",
  // Special
  eleMas: "Elemental Mastery",
  enerRech_: "Energy Recharge",
  critRate_: "CRIT Rate",
  critDMG_: "CRIT DMG",
  heal_: "Healing Bonus",
};

/** Translate a gcsim stat key into a readable English label. */
export function translateStatKey(key: string): string {
  if (!key) return key;
  // Direct match
  if (STAT_KEY_MAP[key]) return STAT_KEY_MAP[key];
  // Normalize: trim trailing underscores and try again
  const trimmed = key.replace(/_+$/, "");
  if (STAT_KEY_MAP[trimmed]) return STAT_KEY_MAP[trimmed];
  return key;
}

/**
 * Build a character namecard background URL pointing at our CDN.
 * Synced as `genshin/ui/UI_NameCardPic_{name_id}_P.webp`.
 */
export function getNamecardUrl(nameId: string): string {
  return genshinUiUrl(`UI_NameCardPic_${nameId}_P`);
}

// ── gcsim CDN URLs ──────────────────────────────────────────────────────────

const SIM_BASE = "https://images.lightkeepers.moe/sim";
const SIM_CONFIGS_BASE = "https://images.lightkeepers.moe/sim-configs";

/**
 * Build a URL to the gcsim config.txt for a given simulation state key.
 * Configs are synced by `scripts/sync/gcsim-r2.ts` and stored as
 * `sim-configs/{state_key}/config.txt` in R2 with immutable caching.
 */
export function getSimConfigUrl(stateKey: string): string {
  return `${SIM_CONFIGS_BASE}/${encodeURIComponent(stateKey)}/config.txt`;
}

/**
 * Aggregate character config summaries (`sim/characters.json.gz`).
 * Synced by `scripts/sync/gcsim-r2.ts` from `output/characters.json`.
 */
export function getSimCharactersIndexUrl(): string {
  return `${SIM_BASE}/characters.json.gz`;
}

/**
 * Per-character config summary (`sim/characters/{Key}.json.gz`).
 * Synced from `output/characters/{Key}.json`. Gzipped like the aggregate;
 * fetch with normal `fetch()` — browsers decode Content-Encoding: gzip.
 */
export function getSimCharacterSummaryUrl(characterKey: string): string {
  return `${SIM_BASE}/characters/${encodeURIComponent(characterKey)}.json.gz`;
}
