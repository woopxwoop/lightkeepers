/**
 * Roster investment snapshots (level / constellation / equipped weapon).
 * Persisted on `/api/roster` entries and localStorage; GOOD import fills them.
 */

import type {
  InventoryWeapon,
  RosterProgress,
  RosterWeapon,
} from "$lib/definitions";
import type { CharacterUpgradeConfig } from "$lib/types/upgrade-costs";
import { MAX_ASCENSION, MAX_LEVEL, MAX_TALENT } from "$lib/upgrade-costs";
import { toGoodKey, TRAVELER_GUIDE_ELEMENTS } from "$lib/utils";
import {
  equippedWeaponForLocation,
  inventoryWeaponToRoster,
} from "$lib/roster-inventory";

export const MAX_CONSTELLATION = 6;
export const MAX_REFINEMENT = 5;
export const MAX_WEAPON_KEY_LENGTH = 64;

export const DEFAULT_ROSTER_PROGRESS: RosterProgress = {
  level: 1,
  ascension: 0,
  constellation: 0,
  talents: { normal: 1, skill: 1, burst: 1 },
  weapon: null,
};

export function cloneRosterWeapon(
  weapon: RosterWeapon | null | undefined,
): RosterWeapon | null {
  if (!weapon) return null;
  return {
    key: weapon.key,
    level: weapon.level,
    ascension: weapon.ascension,
    refinement: weapon.refinement,
  };
}

export function cloneRosterProgress(
  progress: RosterProgress | null | undefined,
): RosterProgress | null {
  if (!progress) return null;
  return {
    level: progress.level,
    ascension: progress.ascension,
    constellation: progress.constellation,
    talents: { ...progress.talents },
    weapon: cloneRosterWeapon(progress.weapon),
  };
}

function intInRange(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

function parseWeapon(value: unknown): RosterWeapon | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.key !== "string") return null;
  const key = row.key.trim();
  if (!key || key.length > MAX_WEAPON_KEY_LENGTH) return null;
  const level = intInRange(row.level, 1, MAX_LEVEL);
  const ascension = intInRange(row.ascension, 0, MAX_ASCENSION);
  const refinement = intInRange(row.refinement, 1, MAX_REFINEMENT);
  if (level == null || ascension == null || refinement == null) return null;
  return { key, level, ascension, refinement };
}

/** Lenient parse for localStorage / DB rows. Invalid shapes become null. */
export function parseRosterProgress(value: unknown): RosterProgress | null {
  if (value == null) return null;
  if (typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const level = intInRange(row.level, 1, MAX_LEVEL);
  const ascension = intInRange(row.ascension, 0, MAX_ASCENSION);
  const constellation = intInRange(row.constellation, 0, MAX_CONSTELLATION);
  const talentsRaw = row.talents;
  if (
    level == null ||
    ascension == null ||
    constellation == null ||
    typeof talentsRaw !== "object" ||
    talentsRaw === null
  ) {
    return null;
  }
  const talents = talentsRaw as Record<string, unknown>;
  const normal = intInRange(talents.normal, 1, MAX_TALENT);
  const skill = intInRange(talents.skill, 1, MAX_TALENT);
  const burst = intInRange(talents.burst, 1, MAX_TALENT);
  if (normal == null || skill == null || burst == null) return null;
  const weapon = row.weapon === undefined ? null : parseWeapon(row.weapon);
  if (row.weapon != null && weapon == null) return null;
  return {
    level,
    ascension,
    constellation,
    talents: { normal, skill, burst },
    weapon,
  };
}

export function progressToCharacterStart(
  progress: RosterProgress,
): CharacterUpgradeConfig {
  return {
    level: progress.level,
    ascension: progress.ascension,
    talents: { ...progress.talents },
  };
}

/** GOOD / roster display-name keys that identify this catalog row. */
export function goodKeysForRosterName(name: string | null): string[] {
  const key = toGoodKey(name);
  if (!key) return [];
  if (key !== "Traveler") return [key];
  return [
    "Traveler",
    ...TRAVELER_GUIDE_ELEMENTS.map((element) => `Traveler${element}`),
  ];
}

/** Owned roster progress for a catalog / kit `name_id`. */
export function rosterProgressForNameId(
  roster: {
    name?: string | null;
    name_id: string;
    isOwned: boolean;
    progress?: RosterProgress | null;
  }[],
  nameId: string,
  weapons?: readonly InventoryWeapon[] | null,
): RosterProgress | null {
  const exact = roster.find((c) => c.name_id === nameId && c.isOwned);
  let row = exact ?? null;
  if (
    !row?.progress &&
    (nameId.startsWith("PlayerBoy-") || nameId.startsWith("PlayerGirl-"))
  ) {
    row =
      roster.find(
        (c) =>
          c.isOwned &&
          (c.name_id === "PlayerBoy" || c.name_id === "PlayerGirl"),
      ) ?? null;
  }
  const progress = row?.progress ?? null;
  if (!weapons?.length) return progress ?? null;

  let equipped: RosterWeapon | null = null;
  for (const key of goodKeysForRosterName(row?.name ?? null)) {
    const weapon = equippedWeaponForLocation(weapons, key);
    if (weapon) {
      equipped = inventoryWeaponToRoster(weapon);
      break;
    }
  }
  if (!progress && !equipped) return null;
  const base = cloneRosterProgress(progress) ?? {
    ...DEFAULT_ROSTER_PROGRESS,
    talents: { ...DEFAULT_ROSTER_PROGRESS.talents },
  };
  return { ...base, weapon: equipped ?? base.weapon };
}
