/**
 * Rebuild a GOOD document from inventory slices (minus materials).
 */

import type {
  CharacterOwned,
  InventoryArtifact,
  InventoryWeapon,
} from "$lib/definitions";
import { toGoodKey, travelerElementKey } from "$lib/utils";
import type {
  IArtifact,
  ICharacter,
  IGOOD,
  IWeapon,
} from "$lib/types/good/good";

export const GOOD_EXPORT_SOURCE = "Lightkeepers";
export const GOOD_EXPORT_VERSION = 3;

function goodExportCharacterKey(row: CharacterOwned): string | null {
  const kit = row.name_id.match(/^Player(?:Boy|Girl)-([A-Za-z]+)$/);
  if (kit) return `Traveler${kit[1]}`;
  const key = toGoodKey(row.name);
  if (!key) return null;
  if (key === "Traveler") return travelerElementKey(row.element) ?? "Traveler";
  return key;
}

function isMoreAdvanced(next: ICharacter, existing: ICharacter): boolean {
  return (
    next.level > existing.level ||
    (next.level === existing.level &&
      next.constellation > existing.constellation)
  );
}

export function serializeGoodDocument(input: {
  roster: readonly CharacterOwned[];
  weapons?: readonly InventoryWeapon[];
  artifacts?: readonly InventoryArtifact[];
}): IGOOD {
  const byKey = new Map<string, ICharacter>();
  for (const row of input.roster) {
    if (!row.isOwned) continue;
    const key = goodExportCharacterKey(row);
    if (!key) continue;
    const progress = row.progress;
    const record: ICharacter = {
      key: key as ICharacter["key"],
      level: progress?.level ?? 1,
      constellation: progress?.constellation ?? 0,
      ascension: progress?.ascension ?? 0,
      talent: {
        auto: progress?.talents.normal ?? 1,
        skill: progress?.talents.skill ?? 1,
        burst: progress?.talents.burst ?? 1,
      },
    };
    const existing = byKey.get(key);
    if (!existing || isMoreAdvanced(record, existing)) {
      byKey.set(key, record);
    }
  }
  const characters = [...byKey.values()];
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
