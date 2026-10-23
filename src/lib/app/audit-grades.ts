/**
 * Client loader for Build Audit: GOOD gear slices + Builds summaries, then one
 * grading pass over every owned character. Not part of layout bootstrap.
 * Throws when the Builds index can't load — nothing is gradable without it.
 *
 * Stygian usage (tierlist) is loaded separately by the page — rows don't
 * depend on it, only ordering does.
 */

import {
  characterSummaryFromIndex,
  loadCharacterIndex,
} from "$lib/app/character-summary";
import {
  loadRosterArtifacts,
  loadRosterWeapons,
} from "$lib/app/roster-inventory";
import { gradeAuditRoster, type AuditRow } from "$lib/audit-grades";
import type { CharacterOwned } from "$lib/definitions";
import {
  artifactSetByKey,
  ensureEquipmentData,
  weaponByKey,
} from "$lib/equipment-data";
import { translateStatKey } from "$lib/utils";

export async function loadAuditGrades(
  roster: readonly CharacterOwned[],
): Promise<AuditRow[]> {
  const [weapons, artifacts] = await Promise.all([
    loadRosterWeapons(),
    loadRosterArtifacts(),
  ]);
  await ensureEquipmentData().catch(() => {});
  const index = await loadCharacterIndex();

  return gradeAuditRoster({
    roster,
    weapons,
    artifacts,
    summaryFor: (key) => characterSummaryFromIndex(index, key),
    summaryError: false,
    resolvers: {
      getWeaponStars: (key) => weaponByKey.get(key)?.stars ?? 0,
      getWeaponName: (key) => weaponByKey.get(key)?.name ?? null,
      getSetName: (key) => artifactSetByKey.get(key)?.name ?? null,
      translateStat: translateStatKey,
    },
  });
}
