/**
 * Build Audit rows: grade owned characters once, then keep the ones below
 * their Builds targets as the build-next queue.
 */

import {
  compareGradeRows,
  formatAdviceStep,
  gradeOwnedBuild,
  type AccountBuildAdviceStep,
  type AccountBuildGrade,
  type AccountBuildNameResolvers,
} from "$lib/account-build-grade";
import type {
  CharacterOwned,
  InventoryArtifact,
  InventoryWeapon,
  RosterProgress,
} from "$lib/definitions";
import { rosterBuildViewFromOwned } from "$lib/roster-build-card";
import type { CharacterIndex } from "$lib/types/investment";
import { toGoodKey } from "$lib/utils";

export type AuditRow = {
  character: CharacterOwned;
  nameId: string;
  sortName: string;
  grade: AccountBuildGrade;
  progress: RosterProgress;
  weaponKey: string | null;
  builds: CharacterIndex | null;
};

export function gradeAuditRoster(input: {
  roster: readonly CharacterOwned[];
  weapons: readonly InventoryWeapon[];
  artifacts: readonly InventoryArtifact[];
  summaryFor: (key: string) => CharacterIndex | null;
  summaryError: boolean;
  resolvers: AccountBuildNameResolvers;
}): AuditRow[] {
  return input.roster
    .filter((c) => c.isOwned)
    .map((character) => {
      const view = rosterBuildViewFromOwned(
        character,
        input.weapons,
        input.artifacts,
      );
      const summaryKey = view.locationKey || toGoodKey(character.name) || "";
      const builds = summaryKey ? input.summaryFor(summaryKey) : null;
      const grade = gradeOwnedBuild({
        view,
        builds,
        nameId: character.name_id,
        summaryError: input.summaryError,
        ...input.resolvers,
      });
      return {
        character,
        nameId: character.name_id,
        sortName: character.name ?? character.name_id,
        grade,
        progress: view.progress,
        weaponKey: view.weapon?.key ?? null,
        builds,
      };
    });
}

/**
 * Characters below their Builds targets, highest Stygian usage first, then
 * biggest gaps. At-target and ungraded characters have nothing to act on.
 */
export function buildNextRows(
  rows: readonly AuditRow[],
  usageByNameId: ReadonlyMap<string, number>,
): AuditRow[] {
  return rows
    .filter((r) => r.grade.bucket === "needs_work")
    .sort((a, b) => compareGradeRows(a, b, null, usageByNameId));
}

/** Weapon steps are prefixed so "Lv 80 → Lv 90" can't read as the character. */
export function auditStepLabel(step: AccountBuildAdviceStep): string {
  const text = formatAdviceStep(step);
  return step.kind === "weapon_level" || step.kind === "weapon_ascension"
    ? `Weapon ${text}`
    : text;
}
