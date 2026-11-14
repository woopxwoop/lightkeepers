/**
 * Local ↔ cloud roster comparison for the sync conflict popup.
 *
 * Only sync-relevant fields count (owned flag, level/ascension/constellation,
 * talents, weapon); catalog metadata differences are ignored.
 */

import type {
  CharacterOwned,
  CharacterPortraitRef,
  RosterProgress,
} from "#lib/definitions.js";

export type RosterSyncWeaponBits = {
  key: string;
  level: number;
  ascension: number;
  refinement: number;
};

export type RosterSyncProgressBits = {
  level: number;
  ascension: number;
  constellation: number;
  talents: string;
  weapon: RosterSyncWeaponBits | null;
};

export type RosterSyncDiff = {
  name_id: string;
  /** Display name from either side (prefers local). */
  name: string;
  /** Enough for CharacterIcon (prefers local row). */
  portrait: CharacterPortraitRef;
  ownedChanged: boolean;
  localOwned: boolean;
  cloudOwned: boolean;
  progressChanged: boolean;
  localProgress: RosterSyncProgressBits | null;
  cloudProgress: RosterSyncProgressBits | null;
};

function progressBits(
  progress: RosterProgress | null | undefined,
): RosterSyncProgressBits | null {
  if (!progress) return null;
  return {
    level: progress.level,
    ascension: progress.ascension,
    constellation: progress.constellation,
    talents: `${progress.talents.normal}/${progress.talents.skill}/${progress.talents.burst}`,
    weapon: progress.weapon
      ? {
          key: progress.weapon.key,
          level: progress.weapon.level,
          ascension: progress.weapon.ascension,
          refinement: progress.weapon.refinement,
        }
      : null,
  };
}

function sameWeaponBits(
  a: RosterSyncWeaponBits | null,
  b: RosterSyncWeaponBits | null,
): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return (
    a.key === b.key &&
    a.level === b.level &&
    a.ascension === b.ascension &&
    a.refinement === b.refinement
  );
}

/** Structural equality for progressBits projections (null-safe). */
function sameProgressBits(
  a: RosterSyncProgressBits | null,
  b: RosterSyncProgressBits | null,
): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return (
    a.level === b.level &&
    a.ascension === b.ascension &&
    a.constellation === b.constellation &&
    a.talents === b.talents &&
    sameWeaponBits(a.weapon, b.weapon)
  );
}

/** Per-character owned/progress deltas between local and cloud (unchanged omitted). */
export function diffRostersForSync(
  local: CharacterOwned[],
  cloud: CharacterOwned[],
): RosterSyncDiff[] {
  const localById = new Map(local.map((c) => [c.name_id, c]));
  const cloudById = new Map(cloud.map((c) => [c.name_id, c]));
  const nameIds = new Set([...localById.keys(), ...cloudById.keys()]);
  const diffs: RosterSyncDiff[] = [];

  for (const name_id of nameIds) {
    const localRow = localById.get(name_id);
    const cloudRow = cloudById.get(name_id);
    const localOwned = localRow?.isOwned ?? false;
    const cloudOwned = cloudRow?.isOwned ?? false;
    const localProgress = progressBits(localRow?.progress);
    const cloudProgress = progressBits(cloudRow?.progress);
    const ownedChanged = localOwned !== cloudOwned;
    const progressChanged = !sameProgressBits(localProgress, cloudProgress);
    if (!ownedChanged && !progressChanged) continue;
    const name = localRow?.name || cloudRow?.name || name_id;
    diffs.push({
      name_id,
      name,
      portrait: {
        name_id,
        name,
        element: localRow?.element ?? cloudRow?.element ?? null,
      },
      ownedChanged,
      localOwned,
      cloudOwned,
      progressChanged,
      localProgress,
      cloudProgress,
    });
  }

  diffs.sort((a, b) => {
    // Ownership-only first, then mixed, then progress-only — then name.
    const rank = (d: RosterSyncDiff) =>
      d.ownedChanged && !d.progressChanged
        ? 0
        : d.ownedChanged && d.progressChanged
          ? 1
          : 2;
    const byKind = rank(a) - rank(b);
    if (byKind !== 0) return byKind;
    return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  });
  return diffs;
}
