/**
 * Import a GOOD JSON roster (any `source`; see `$lib/types/good/good`).
 * Characters, weapons (including unequipped), and artifacts are kept.
 * Materials and extra producer fields (GO `id`, etc.) are ignored.
 * Spec ranges that exceed planner caps (character level 100, talent 15)
 * are clamped on ingest.
 */

import type {
  CharacterOwned,
  InventoryArtifact,
  InventorySubstat,
  InventoryWeapon,
  RosterProgress,
} from "$lib/definitions";
import {
  DEFAULT_ROSTER_PROGRESS,
  goodKeysForRosterName,
  MAX_CONSTELLATION,
  MAX_REFINEMENT,
  MAX_WEAPON_KEY_LENGTH,
} from "$lib/roster-progress";
import {
  cloneInventoryArtifact,
  cloneInventoryWeapon,
  inventoryWeaponToRoster,
  isArtifactSlot,
  MAX_ARTIFACT_LEVEL,
  MAX_ARTIFACT_SUBSTATS,
  MAX_GOOD_KEY_LENGTH,
  MAX_STAT_KEY_LENGTH,
  MAX_UNACTIVATED_SUBSTATS,
} from "$lib/roster-inventory";
import type {
  IArtifact,
  ICharacter,
  IGOOD,
  IWeapon,
} from "$lib/types/good/good";
import { MAX_ASCENSION, MAX_LEVEL, MAX_TALENT } from "$lib/upgrade-costs";

export const MAX_GOOD_FILE_BYTES = 10 * 1024 * 1024;

/** GOOD character row after ingest (clamped to app caps, weapon attached). */
export type GoodCharacterRecord = RosterProgress & { key: string };

export type GoodParseResult =
  | {
      ok: true;
      characters: Map<string, GoodCharacterRecord>;
      weapons: InventoryWeapon[];
      artifacts: InventoryArtifact[];
    }
  | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGoodFile(value: unknown): value is IGOOD {
  return isRecord(value) && value.format === "GOOD";
}

function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.trunc(n);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

function parseKey(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim();
  if (!key || key.length > maxLength) return null;
  return key;
}

function parseLocation(value: unknown): string {
  if (typeof value !== "string") return "";
  const location = value.trim();
  return location.length > MAX_GOOD_KEY_LENGTH ? "" : location;
}

function parseGoodWeapon(row: unknown): InventoryWeapon | null {
  if (!isRecord(row)) return null;
  const weapon = row as Partial<IWeapon> & Record<string, unknown>;
  const key = parseKey(weapon.key, MAX_WEAPON_KEY_LENGTH);
  if (!key) return null;
  return {
    key,
    level: clampInt(weapon.level, 1, MAX_LEVEL, 1),
    ascension: clampInt(weapon.ascension, 0, MAX_ASCENSION, 0),
    refinement: clampInt(weapon.refinement, 1, MAX_REFINEMENT, 1),
    location: parseLocation(weapon.location),
    lock: weapon.lock === true,
  };
}

function parseSubstat(row: unknown): InventorySubstat | null {
  if (!isRecord(row)) return null;
  const key = parseKey(row.key, MAX_STAT_KEY_LENGTH);
  if (!key) return null;
  const value = typeof row.value === "number" ? row.value : Number(row.value);
  if (!Number.isFinite(value)) return null;
  const stat: InventorySubstat = { key, value };
  if (
    typeof row.initialValue === "number" &&
    Number.isFinite(row.initialValue)
  ) {
    stat.initialValue = row.initialValue;
  }
  return stat;
}

function parseGoodArtifact(row: unknown): InventoryArtifact | null {
  if (!isRecord(row)) return null;
  const artifact = row as Partial<IArtifact> & Record<string, unknown>;
  const setKey = parseKey(artifact.setKey, MAX_GOOD_KEY_LENGTH);
  if (!setKey || !isArtifactSlot(artifact.slotKey)) return null;
  const mainStatKey = parseKey(artifact.mainStatKey, MAX_STAT_KEY_LENGTH);
  if (!mainStatKey) return null;
  const substats = Array.isArray(artifact.substats)
    ? artifact.substats
        .map(parseSubstat)
        .filter((stat): stat is InventorySubstat => stat != null)
        .slice(0, MAX_ARTIFACT_SUBSTATS)
    : [];
  const parsed: InventoryArtifact = {
    setKey,
    slotKey: artifact.slotKey,
    level: clampInt(artifact.level, 0, MAX_ARTIFACT_LEVEL, 0),
    rarity: clampInt(artifact.rarity, 1, 5, 1),
    mainStatKey,
    location: parseLocation(artifact.location),
    lock: artifact.lock === true,
    substats,
  };
  if (typeof artifact.totalRolls === "number") {
    parsed.totalRolls = clampInt(artifact.totalRolls, 0, 9, 0);
  }
  if (typeof artifact.astralMark === "boolean") {
    parsed.astralMark = artifact.astralMark;
  }
  if (typeof artifact.elixirCrafted === "boolean") {
    parsed.elixirCrafted = artifact.elixirCrafted;
  }
  if (Array.isArray(artifact.unactivatedSubstats)) {
    const unactivated = artifact.unactivatedSubstats
      .map(parseSubstat)
      .filter((stat): stat is InventorySubstat => stat != null)
      .slice(0, MAX_UNACTIVATED_SUBSTATS);
    if (unactivated.length > 0) parsed.unactivatedSubstats = unactivated;
  }
  return parsed;
}

function parseGoodCharacter(row: unknown): GoodCharacterRecord | null {
  if (!isRecord(row)) return null;
  const character = row as Partial<ICharacter> & Record<string, unknown>;
  const key = parseKey(character.key, MAX_GOOD_KEY_LENGTH);
  if (!key) return null;
  const talent = isRecord(character.talent) ? character.talent : {};
  const auto = talent.auto ?? talent.normal;
  return {
    key,
    level: clampInt(character.level, 1, MAX_LEVEL, 1),
    constellation: clampInt(character.constellation, 0, MAX_CONSTELLATION, 0),
    ascension: clampInt(character.ascension, 0, MAX_ASCENSION, 0),
    talents: {
      normal: clampInt(auto, 1, MAX_TALENT, 1),
      skill: clampInt(talent.skill, 1, MAX_TALENT, 1),
      burst: clampInt(talent.burst, 1, MAX_TALENT, 1),
    },
    weapon: null,
  };
}

/** Pull character, weapon, and artifact records from any GOOD-shaped JSON. */
export function parseGoodRoster(value: unknown): GoodParseResult {
  if (!isRecord(value)) {
    return { ok: false, message: "Not a JSON object." };
  }
  if (!isGoodFile(value)) {
    return { ok: false, message: 'Not a GOOD file (expected format: "GOOD").' };
  }

  const characters = new Map<string, GoodCharacterRecord>();
  if (Array.isArray(value.characters)) {
    for (const row of value.characters) {
      const parsed = parseGoodCharacter(row);
      if (!parsed) continue;
      const existing = characters.get(parsed.key);
      if (
        !existing ||
        parsed.level > existing.level ||
        (parsed.level === existing.level &&
          parsed.constellation > existing.constellation)
      ) {
        characters.set(parsed.key, parsed);
      }
    }
  }

  const weapons: InventoryWeapon[] = [];
  if (Array.isArray(value.weapons)) {
    for (const row of value.weapons) {
      const weapon = parseGoodWeapon(row);
      if (!weapon) continue;
      weapons.push(cloneInventoryWeapon(weapon));
      const location = weapon.location;
      if (!location) continue;
      let owner = characters.get(location);
      if (!owner) {
        owner = {
          key: location,
          ...DEFAULT_ROSTER_PROGRESS,
          talents: { ...DEFAULT_ROSTER_PROGRESS.talents },
          weapon: inventoryWeaponToRoster(weapon),
        };
        characters.set(location, owner);
      } else if (!owner.weapon) {
        owner.weapon = inventoryWeaponToRoster(weapon);
      }
    }
  }

  const artifacts: InventoryArtifact[] = [];
  if (Array.isArray(value.artifacts)) {
    for (const row of value.artifacts) {
      const artifact = parseGoodArtifact(row);
      if (!artifact) continue;
      artifacts.push(cloneInventoryArtifact(artifact));
    }
  }

  if (characters.size === 0) {
    return { ok: false, message: "GOOD file lists no characters." };
  }
  return { ok: true, characters, weapons, artifacts };
}

function pickGoodRecord(
  name: string | null,
  records: ReadonlyMap<string, GoodCharacterRecord>,
): GoodCharacterRecord | null {
  let best: GoodCharacterRecord | null = null;
  for (const key of goodKeysForRosterName(name)) {
    const row = records.get(key);
    if (!row) continue;
    if (
      !best ||
      row.level > best.level ||
      (row.level === best.level && row.constellation > best.constellation)
    ) {
      best = row;
    }
  }
  return best;
}

function toProgress(record: GoodCharacterRecord): RosterProgress {
  return {
    level: record.level,
    ascension: record.ascension,
    constellation: record.constellation,
    talents: { ...record.talents },
    weapon: record.weapon
      ? {
          key: record.weapon.key,
          level: record.weapon.level,
          ascension: record.weapon.ascension,
          refinement: record.weapon.refinement,
        }
      : null,
  };
}

/** Own + snapshot roster rows that appear in the GOOD file; unown the rest. */
export function applyGoodRoster(
  roster: CharacterOwned[],
  records: ReadonlyMap<string, GoodCharacterRecord>,
): CharacterOwned[] {
  return roster.map((character) => {
    const record = pickGoodRecord(character.name, records);
    if (!record) {
      return { ...character, isOwned: false, progress: null };
    }
    return {
      ...character,
      isOwned: true,
      progress: toProgress(record),
    };
  });
}
