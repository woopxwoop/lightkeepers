/**
 * GOOD weapons / artifacts slices (not the catalog roster).
 * Persist on `user_rosters.weapons` / `.artifacts`; fetch via loadRoster*.
 */

import type {
  InventoryArtifact,
  InventoryArtifactSlot,
  InventorySubstat,
  InventoryWeapon,
  RosterWeapon,
} from "$lib/definitions";

export const MAX_INVENTORY_WEAPONS = 2048;
export const MAX_INVENTORY_ARTIFACTS = 8192;
export const MAX_GOOD_KEY_LENGTH = 64;
export const MAX_STAT_KEY_LENGTH = 32;
export const MAX_ARTIFACT_LEVEL = 20;
export const INVENTORY_ARTIFACT_SLOTS: readonly InventoryArtifactSlot[] = [
  "flower",
  "plume",
  "sands",
  "goblet",
  "circlet",
];

export function cloneInventoryWeapon(weapon: InventoryWeapon): InventoryWeapon {
  return {
    key: weapon.key,
    level: weapon.level,
    ascension: weapon.ascension,
    refinement: weapon.refinement,
    location: weapon.location,
    lock: weapon.lock,
  };
}

function cloneSubstat(stat: InventorySubstat): InventorySubstat {
  return stat.initialValue === undefined
    ? { key: stat.key, value: stat.value }
    : { key: stat.key, value: stat.value, initialValue: stat.initialValue };
}

export function cloneInventoryArtifact(
  artifact: InventoryArtifact,
): InventoryArtifact {
  const next: InventoryArtifact = {
    setKey: artifact.setKey,
    slotKey: artifact.slotKey,
    level: artifact.level,
    rarity: artifact.rarity,
    mainStatKey: artifact.mainStatKey,
    location: artifact.location,
    lock: artifact.lock,
    substats: artifact.substats.map(cloneSubstat),
  };
  if (artifact.totalRolls !== undefined) next.totalRolls = artifact.totalRolls;
  if (artifact.astralMark !== undefined) next.astralMark = artifact.astralMark;
  if (artifact.elixirCrafted !== undefined) {
    next.elixirCrafted = artifact.elixirCrafted;
  }
  if (artifact.unactivatedSubstats) {
    next.unactivatedSubstats = artifact.unactivatedSubstats.map(cloneSubstat);
  }
  return next;
}

export function inventoryWeaponToRoster(weapon: InventoryWeapon): RosterWeapon {
  return {
    key: weapon.key,
    level: weapon.level,
    ascension: weapon.ascension,
    refinement: weapon.refinement,
  };
}

/** Equipped weapon for a GOOD character key (`location`). */
export function equippedWeaponForLocation(
  weapons: readonly InventoryWeapon[],
  location: string,
): InventoryWeapon | null {
  if (!location) return null;
  return weapons.find((weapon) => weapon.location === location) ?? null;
}

/** Best inventory copy of a weapon key (highest level, then refinement). */
export function bestInventoryWeaponByKey(
  weapons: readonly InventoryWeapon[],
  key: string,
): InventoryWeapon | null {
  let best: InventoryWeapon | null = null;
  for (const weapon of weapons) {
    if (weapon.key !== key) continue;
    if (
      !best ||
      weapon.level > best.level ||
      (weapon.level === best.level && weapon.refinement > best.refinement)
    ) {
      best = weapon;
    }
  }
  return best;
}

/** Artifacts currently on a GOOD character key. */
export function artifactsForLocation(
  artifacts: readonly InventoryArtifact[],
  location: string,
): InventoryArtifact[] {
  if (!location) return [];
  return artifacts.filter((artifact) => artifact.location === location);
}

/**
 * Unequip `characterKey`, then equip `next` (existing unequipped copy or a new row).
 */
export function equipInventoryWeapon(
  weapons: readonly InventoryWeapon[],
  characterKey: string,
  next: RosterWeapon | null,
): InventoryWeapon[] {
  const cleared = weapons.map((weapon) =>
    weapon.location === characterKey
      ? { ...weapon, location: "" }
      : cloneInventoryWeapon(weapon),
  );
  if (!next) return cleared;
  const free = cleared.findIndex(
    (weapon) => weapon.key === next.key && weapon.location === "",
  );
  const equipped: InventoryWeapon = {
    key: next.key,
    level: next.level,
    ascension: next.ascension,
    refinement: next.refinement,
    location: characterKey,
    lock: false,
  };
  if (free >= 0) {
    const previous = cleared[free]!;
    cleared[free] = { ...equipped, lock: previous.lock };
    return cleared;
  }
  return [...cleared, equipped];
}

export function isArtifactSlot(value: unknown): value is InventoryArtifactSlot {
  return (
    typeof value === "string" &&
    (INVENTORY_ARTIFACT_SLOTS as readonly string[]).includes(value)
  );
}
