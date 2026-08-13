/**
 * Rebuild a GOOD document from inventory slices (minus materials).
 */

import type {
  CharacterOwned,
  InventoryArtifact,
  InventoryWeapon,
} from "$lib/definitions";
import { toGoodKey } from "$lib/utils";
import type {
  IArtifact,
  ICharacter,
  IGOOD,
  IWeapon,
} from "$lib/types/good/good";

export const GOOD_EXPORT_SOURCE = "Lightkeepers";
export const GOOD_EXPORT_VERSION = 3;

export function serializeGoodDocument(input: {
  roster: readonly CharacterOwned[];
  weapons?: readonly InventoryWeapon[];
  artifacts?: readonly InventoryArtifact[];
}): IGOOD {
  const characters: ICharacter[] = [];
  for (const row of input.roster) {
    if (!row.isOwned) continue;
    const key = toGoodKey(row.name);
    if (!key) continue;
    const progress = row.progress;
    characters.push({
      key: key as ICharacter["key"],
      level: progress?.level ?? 1,
      constellation: progress?.constellation ?? 0,
      ascension: progress?.ascension ?? 0,
      talent: {
        auto: progress?.talents.normal ?? 1,
        skill: progress?.talents.skill ?? 1,
        burst: progress?.talents.burst ?? 1,
      },
    });
  }
  return {
    format: "GOOD",
    version: GOOD_EXPORT_VERSION,
    source: GOOD_EXPORT_SOURCE,
    characters,
    weapons: (input.weapons ?? []).map((weapon) => ({
      key: weapon.key as IWeapon["key"],
      level: weapon.level,
      ascension: weapon.ascension,
      refinement: weapon.refinement,
      location: weapon.location as IWeapon["location"],
      lock: weapon.lock,
    })),
    artifacts: (input.artifacts ?? []).map((artifact) => {
      const next: IArtifact = {
        setKey: artifact.setKey as IArtifact["setKey"],
        slotKey: artifact.slotKey,
        level: artifact.level,
        rarity: artifact.rarity,
        mainStatKey: artifact.mainStatKey as IArtifact["mainStatKey"],
        location: artifact.location as IArtifact["location"],
        lock: artifact.lock,
        substats: artifact.substats.map((stat) => ({
          key: stat.key as IArtifact["substats"][number]["key"],
          value: stat.value,
          ...(stat.initialValue !== undefined
            ? { initialValue: stat.initialValue }
            : {}),
        })),
      };
      if (artifact.totalRolls !== undefined)
        next.totalRolls = artifact.totalRolls;
      if (artifact.astralMark !== undefined)
        next.astralMark = artifact.astralMark;
      if (artifact.elixirCrafted !== undefined) {
        next.elixirCrafted = artifact.elixirCrafted;
      }
      if (artifact.unactivatedSubstats) {
        next.unactivatedSubstats = artifact.unactivatedSubstats.map((stat) => ({
          key: stat.key as IArtifact["substats"][number]["key"],
          value: stat.value,
          ...(stat.initialValue !== undefined
            ? { initialValue: stat.initialValue }
            : {}),
        }));
      }
      return next;
    }),
  };
}
