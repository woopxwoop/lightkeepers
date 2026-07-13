import weaponsRaw from "$lib/data/weapons.json";
import artifactSetsRaw from "$lib/data/artifact-sets.json";

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
