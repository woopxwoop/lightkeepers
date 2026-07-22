/**
 * Weapon / artifact static tables.
 *
 * Kept out of `$lib/utils` so portrait URLs, labels, and bootstrap helpers
 * do not pull ~400KB of weapons.json into every layout chunk.
 */
import weaponsRaw from "$lib/data/weapons.json";
import artifactSetsRaw from "$lib/data/artifact-sets.json";
import { buildGoodKeyMap } from "$lib/utils";

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
export const artifactSetByKey = buildGoodKeyMap(
  artifactSetsRaw as ArtifactSetData[],
);

/**
 * True only for known 5★ weapons. Missing keys are treated as not-5★.
 */
export function isFiveStarWeapon(weaponKey: string): boolean {
  const weapon = weaponByKey.get(weaponKey);
  return weapon?.stars === 5;
}

/**
 * Refinement rank to show in UI.
 * When the weapon icon is visible, use the sim's actual refinement.
 * When it isn't, any non-5★ weapon falls back to R0 (community baseline).
 */
export function displayWeaponRefinement(
  weaponKey: string,
  refinement: number,
  opts?: { weaponShown?: boolean },
): number {
  if (opts?.weaponShown) return refinement;
  return isFiveStarWeapon(weaponKey) ? refinement : 0;
}

/**
 * Format constellation + refinement when the weapon itself isn't shown.
 * Non-5★ weapons use R0 in that case.
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
 * When `characterByKey` is provided, character GOOD keys are replaced too
 * (longest-first so compound keys win).
 */
export function humanizeInvestmentLabel(
  label: string,
  characterByKey?: Map<string, string>,
): string {
  if (!label) return label;
  let out = label;
  for (const key of WEAPON_KEYS_BY_LENGTH) {
    if (!out.includes(key)) continue;
    const name = weaponByKey.get(key)?.name;
    if (!name) continue;
    out = out.split(key).join(name);
  }
  if (characterByKey?.size) {
    const keys = [...characterByKey.keys()].sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (!out.includes(key)) continue;
      const name = characterByKey.get(key);
      if (!name) continue;
      out = out.split(key).join(name);
    }
  }
  return out;
}
