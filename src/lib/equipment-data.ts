/**
 * Weapon / artifact static tables.
 *
 * JSON is loaded via dynamic import so layout / home chunks do not pay for
 * ~400KB of weapons data. In the browser nothing loads until a reader asks:
 * components use `useEquipmentData()` / `useWeapon()` / `useArtifactSet()`,
 * plain modules call `ensureEquipmentData()` before reading the maps. (The
 * server auto-starts the load at import for SSR — see the bottom of the file.)
 * `equipmentVersion` bumps after load so Svelte dependents can re-derive.
 *
 * Base-stat tables (character/weapon bases + level curves, artifact mains)
 * are a second, on-demand group: `ensureBaseStatData()`. Never auto-started;
 * only stat-sheet views (`useEquipmentData({ baseStats: true })`) pay for them.
 *
 * Weapon refinement text (~80% of the raw weapon data) is a third on-demand
 * group: `ensureWeaponRefinements()`. Never auto-started; WeaponTooltip
 * starts it when a tip first opens (`HoverTooltip` `onopen`), and reads it
 * through `weaponRefinements()`.
 * All groups bump the same `equipmentVersion`.
 */
import { writable } from "svelte/store";
import {
  artifactIconUrl,
  artifactPieceIconUrl,
  weaponIconUrl,
} from "#lib/asset-urls.js";
import { buildGoodKeyMap, foldGoodKey } from "#lib/utils.js";

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
}

export type WeaponRefinement = { rank: number; description: string };

export interface ArtifactSetData {
  id: number;
  name: string;
  icon: string;
  bonuses: { needCount: number; description: string }[];
}

/** Populated in place after `ensureEquipmentData()` resolves. */
export const weaponByKey = new Map<string, WeaponData>();

/** Same rows as `weaponByKey`, keyed by numeric game id. */
export const weaponById = new Map<number, WeaponData>();

/** Populated in place after `ensureEquipmentData()` resolves. */
export const artifactSetByKey = new Map<string, ArtifactSetData>();

/** Bumps when maps finish loading — subscribe in $derived for reactivity. */
export const equipmentVersion = writable(0);

/**
 * True after a load fails. `equipmentVersion` stays on the last successful
 * tables, so a failed first load is visible here instead of as "still loading".
 */
export const equipmentLoadFailed = writable(false);

type LoadGroup = "equipment" | "baseStats" | "refinements";
const failedGroups = new Set<LoadGroup>();

/** One group's retry succeeding must not clear the other group's failure. */
function markLoadFailed(group: LoadGroup, failed: boolean): void {
  if (failed) failedGroups.add(group);
  else failedGroups.delete(group);
  equipmentLoadFailed.set(failedGroups.size > 0);
}

/** Vite / tsx JSON modules expose the payload as `default`. */
function jsonDefault<T>(mod: unknown): T {
  return ((mod as { default?: T }).default ?? mod) as T;
}

let weaponKeysByLength: string[] = [];
let loadPromise: Promise<void> | null = null;

/**
 * Load weapons + artifact JSON into the shared maps (idempotent / coalesced).
 */
export function ensureEquipmentData(): Promise<void> {
  if (weaponByKey.size > 0 && artifactSetByKey.size > 0) {
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const [weaponsMod, artifactsMod] = await Promise.all([
      import("#lib/data/weapon-index.json"),
      // Descriptions are copied from game files (Hoyoverse wording as-is,
      // including awkward clauses like Scarlet Proof’s Stellar Swirl 4pc).
      import("#lib/data/artifact-sets.json"),
    ]);
    const weaponsRaw = jsonDefault<WeaponData[]>(weaponsMod);
    const artifactSetsRaw = jsonDefault<ArtifactSetData[]>(artifactsMod);

    const nextWeapons = new Map<string, WeaponData>();
    const nextWeaponIds = new Map<number, WeaponData>();
    for (const [key, value] of buildGoodKeyMap(weaponsRaw)) {
      nextWeapons.set(key, value);
      nextWeaponIds.set(value.id, value);
    }
    const nextSets = new Map<string, ArtifactSetData>();
    for (const [key, value] of buildGoodKeyMap(artifactSetsRaw)) {
      nextSets.set(key, value);
    }
    const nextKeys = [...nextWeapons.keys()].sort(
      (a, b) => b.length - a.length,
    );

    weaponByKey.clear();
    weaponById.clear();
    for (const [key, value] of nextWeapons) {
      weaponByKey.set(key, value);
      weaponById.set(value.id, value);
    }
    artifactSetByKey.clear();
    for (const [key, value] of nextSets) artifactSetByKey.set(key, value);
    weaponKeysByLength = nextKeys;
    markLoadFailed("equipment", false);
    equipmentVersion.update((n) => n + 1);
  })().catch((err) => {
    loadPromise = null;
    markLoadFailed("equipment", true);
    throw err;
  });

  return loadPromise;
}

// ---------------------------------------------------------------------------
// Base-stat tables (on demand — see module doc)
// ---------------------------------------------------------------------------

export type CharacterPromoteStep = {
  asc: number;
  hp: number;
  atk: number;
  def: number;
  stats: Record<string, number>;
};

export interface CharacterBaseStats {
  name_id: string;
  name: string;
  level: number;
  hp: number;
  atk: number;
  def: number;
  ascension: Record<string, number>;
  baseCritRate: number;
  baseCritDMG: number;
  /** Pre-curve AvatarExcel flats (present after curve extract). */
  hpBase?: number;
  atkBase?: number;
  defBase?: number;
  growCurves?: { hp: string; atk: string; def: string };
  promotes?: CharacterPromoteStep[];
}

export type WeaponPromoteStep = {
  asc: number;
  atk: number;
};

export type WeaponSubBase = {
  propType: string;
  initValue: number;
  curve: string;
  isPercent: boolean;
};

export interface WeaponBaseRow {
  key: string;
  name: string;
  stars: number;
  atkBase: number;
  atkCurve: string;
  subStat: WeaponSubBase | null;
  promotes: WeaponPromoteStep[];
}

/** GROW_CURVE_* → level string → multiplier. */
export type StatCurves = Record<string, Record<string, number>>;

/** rarity → GOOD level → main-stat map (from ReliquaryLevel). */
export type ArtifactMainStatTable = Record<
  string,
  Record<string, Record<string, number>>
>;

/** Populated in place after `ensureBaseStatData()` resolves. */
export const characterBaseByKey = new Map<string, CharacterBaseStats>();
/** Populated in place after `ensureBaseStatData()` resolves. */
export const weaponBaseByKey = new Map<string, WeaponBaseRow>();
/** Populated in place after `ensureBaseStatData()` resolves. */
export const characterStatCurves: StatCurves = {};
/** Populated in place after `ensureBaseStatData()` resolves. */
export const weaponStatCurves: StatCurves = {};
/** Populated in place after `ensureBaseStatData()` resolves. */
export const artifactMainStats: ArtifactMainStatTable = {};

let baseStatPromise: Promise<void> | null = null;

/**
 * Load base-stat JSON into the shared tables (idempotent / coalesced).
 * Until it resolves, build-stats falls back to L90 / 5★ +20 bakes.
 */
export function ensureBaseStatData(): Promise<void> {
  if (characterBaseByKey.size > 0) return Promise.resolve();
  if (baseStatPromise) return baseStatPromise;

  baseStatPromise = (async () => {
    const [chars, charCurves, weapons, weaponCurves, artifactMains] =
      await Promise.all([
        import("#lib/data/character-bases.json"),
        import("#lib/data/character-stat-curves.json"),
        import("#lib/data/weapon-bases.json"),
        import("#lib/data/weapon-stat-curves.json"),
        import("#lib/data/artifact-main-stats.json"),
      ]);

    weaponBaseByKey.clear();
    for (const [key, row] of Object.entries(
      jsonDefault<Record<string, WeaponBaseRow>>(weapons),
    )) {
      weaponBaseByKey.set(key, row);
    }
    Object.assign(characterStatCurves, jsonDefault<StatCurves>(charCurves));
    Object.assign(weaponStatCurves, jsonDefault<StatCurves>(weaponCurves));
    Object.assign(
      artifactMainStats,
      jsonDefault<ArtifactMainStatTable>(artifactMains),
    );
    // Last: `characterBaseByKey.size` is the "loaded" signal above.
    characterBaseByKey.clear();
    for (const [key, row] of Object.entries(
      jsonDefault<Record<string, CharacterBaseStats>>(chars),
    )) {
      characterBaseByKey.set(key, row);
    }
    markLoadFailed("baseStats", false);
    equipmentVersion.update((n) => n + 1);
  })().catch((err) => {
    baseStatPromise = null;
    markLoadFailed("baseStats", true);
    throw err;
  });

  return baseStatPromise;
}

// ---------------------------------------------------------------------------
// Weapon refinement text (on demand — see module doc)
// ---------------------------------------------------------------------------

/** Populated in place after `ensureWeaponRefinements()` resolves. */
const weaponRefinementsById = new Map<number, WeaponRefinement[]>();

let refinementsPromise: Promise<void> | null = null;

/**
 * Load weapon refinement JSON into the shared table (idempotent / coalesced).
 * Until it resolves, `weaponRefinements()` returns `[]`.
 */
export function ensureWeaponRefinements(): Promise<void> {
  if (weaponRefinementsById.size > 0) return Promise.resolve();
  if (refinementsPromise) return refinementsPromise;

  refinementsPromise = (async () => {
    const mod = await import("#lib/data/weapon-refinements.json");

    weaponRefinementsById.clear();
    for (const [id, ranks] of Object.entries(
      jsonDefault<Record<string, WeaponRefinement[]>>(mod),
    )) {
      weaponRefinementsById.set(Number(id), ranks);
    }
    markLoadFailed("refinements", false);
    equipmentVersion.update((n) => n + 1);
  })().catch((err) => {
    refinementsPromise = null;
    markLoadFailed("refinements", true);
    throw err;
  });

  return refinementsPromise;
}

// Server: load once per process at import so SSR can render weapon names and
// icons (component hooks only start the load in onMount, which never runs on
// the server). Browser: on demand only — useEquipmentData() / useWeapon() /
// useArtifactSet() / ensureEquipmentData() trigger it, so pages that show no
// equipment never download the weapon/artifact JSON.
if (typeof window === "undefined") {
  void ensureEquipmentData().catch(() => {
    /* an SSR render or the next caller retries via ensureEquipmentData() */
  });
}

/**
 * Displayable icon URL for a GOOD weapon key.
 * Null while the tables are still loading, for unknown keys, and for weapons
 * without an awaken icon — the single source of truth for "icon is shown".
 */
export function weaponIconSrc(weaponKey: string): string | null {
  const weapon = weaponByKey.get(weaponKey);
  if (!weapon?.awakenIcon) return null;
  return weaponIconUrl(weapon.awakenIcon);
}

/** Refinement ranks R1–R5 for a weapon; `[]` while loading or when none. */
export function weaponRefinements(
  weapon: WeaponData | null | undefined,
): WeaponRefinement[] {
  if (!weapon) return [];
  return weaponRefinementsById.get(weapon.id) ?? [];
}

/** Display name for a GOOD weapon key; null while loading or unknown. */
export function weaponName(weaponKey: string): string | null {
  return weaponByKey.get(weaponKey)?.name ?? null;
}

/** Display name for a GOOD artifact set key; null while loading or unknown. */
export function artifactSetName(setKey: string): string | null {
  return artifactSetByKey.get(setKey)?.name ?? null;
}

/**
 * Match free text (agent output, pasted names, odd casing) to a known GOOD key:
 * exact, then case-insensitive, then {@link foldGoodKey}. Null when nothing
 * matches or the tables have not loaded.
 */
function resolveGoodKey(
  raw: string,
  table: ReadonlyMap<string, unknown>,
): string | null {
  if (table.has(raw)) return raw;
  const lower = raw.toLowerCase();
  for (const key of table.keys()) if (key.toLowerCase() === lower) return key;
  const fold = foldGoodKey(raw);
  if (!fold) return null;
  for (const key of table.keys()) if (foldGoodKey(key) === fold) return key;
  return null;
}

/** Free-text weapon name/key → GOOD weapon key (see `resolveGoodKey`). */
export function resolveWeaponKey(raw: string): string | null {
  return resolveGoodKey(raw, weaponByKey);
}

/** Free-text artifact set name/key → GOOD set key (see `resolveGoodKey`). */
export function resolveArtifactSetKey(raw: string): string | null {
  return resolveGoodKey(raw, artifactSetByKey);
}

/** Weapon rarity (1–5); null while loading or unknown. */
export function weaponStars(weaponKey: string): number | null {
  return weaponByKey.get(weaponKey)?.stars ?? null;
}

/** Set icon URL for a GOOD artifact set key; null while loading or unknown. */
export function artifactSetIconSrc(setKey: string): string | null {
  const set = artifactSetByKey.get(setKey);
  return set ? artifactIconUrl(set.icon) : null;
}

/** Per-slot piece icon for a set (flower, plume, …); null while loading or unknown. */
export function artifactPieceIconSrc(
  setKey: string,
  slot: Parameters<typeof artifactPieceIconUrl>[1],
): string | null {
  return artifactPieceIconUrl(artifactSetByKey.get(setKey)?.icon, slot);
}

/**
 * True only for known 5★ weapons. Missing keys are treated as not-5★.
 */
function isFiveStarWeapon(weaponKey: string): boolean {
  return weaponStars(weaponKey) === 5;
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

/**
 * Replace GOOD weapon keys in an investment sim label with display names.
 * When `characterByKey` is provided, character GOOD keys are replaced too
 * (longest-first so compound keys win).
 *
 * ``fiveStarWeaponsAs: "R1"`` — limited/signature 5★ keys become ``R1``
 * instead of the weapon name (vertical upgrades; non-sig 5★s live under
 * ``owned`` and should keep ``"name"``).
 */
export function humanizeInvestmentLabel(
  label: string,
  characterByKey?: Map<string, string>,
  opts?: { fiveStarWeaponsAs?: "name" | "R1" },
): string {
  if (!label) return label;
  const fiveStarAs = opts?.fiveStarWeaponsAs ?? "name";
  let out = label;
  for (const key of weaponKeysByLength) {
    if (!out.includes(key)) continue;
    if (fiveStarAs === "R1" && isFiveStarWeapon(key)) {
      out = out.split(key).join("R1");
      continue;
    }
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
