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
} from "#lib/account-build-grade.js";
import type {
  CharacterOwned,
  InventoryArtifact,
  InventoryWeapon,
  RosterProgress,
} from "#lib/definitions.js";
import { rosterBuildViewFromOwned } from "#lib/roster-build-card.js";
import type { CharacterIndex } from "#lib/types/investment.js";
import { toGoodKey } from "#lib/utils.js";

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
 * Stable regrade key. Character ids alone miss a cloud sync that keeps the
 * same roster and replaces the progress those grades were computed from.
 */
export function auditRosterFingerprint(
  owned: readonly CharacterOwned[],
): string {
  return owned
    .map((character) => {
      const progress = character.progress;
      const talents = progress?.talents;
      const weapon = progress?.weapon;
      return [
        character.name_id,
        progress?.level ?? "",
        progress?.ascension ?? "",
        progress?.constellation ?? "",
        talents?.normal ?? "",
        talents?.skill ?? "",
        talents?.burst ?? "",
        weapon?.key ?? "",
        weapon?.level ?? "",
        weapon?.ascension ?? "",
        weapon?.refinement ?? "",
      ].join("\0");
    })
    .sort()
    .join("\n");
}

/**
 * Characters below their Builds targets, highest Stygian usage first, then
 * biggest gaps. At-target and ungraded characters are left out of the queue.
 * Ungraded means the summary was missing or unusable, not that the build is done.
 */
export function buildNextRows(
  rows: readonly AuditRow[],
  usageByNameId: ReadonlyMap<string, number>,
): AuditRow[] {
  return rows
    .filter((r) => r.grade.bucket === "needs_work")
    .sort((a, b) => compareGradeRows(a, b, null, usageByNameId));
}

function characterCount(count: number): string {
  return `${count} ${count === 1 ? "character" : "characters"}`;
}

function ungradedDataPhrase(rows: readonly Pick<AuditRow, "grade">[]): string {
  let stale = false;
  let missing = false;
  let error = false;
  for (const row of rows) {
    if (row.grade.bucket !== "ungraded") continue;
    if (row.grade.ungradedReason === "stale") stale = true;
    else if (row.grade.ungradedReason === "missing") missing = true;
    else error = true;
  }
  if (stale && !missing && !error) return "Builds data is out of date";
  if (missing && !stale && !error) return "Builds data is missing";
  if (error && !stale && !missing) return "Builds didn’t load";
  return "Builds data is missing or out of date";
}

/** Why ungraded characters are absent from the queue. Null when every row was graded. */
export function auditUngradedNote(
  rows: readonly Pick<AuditRow, "grade">[],
): string | null {
  const ungraded = rows.filter((row) => row.grade.bucket === "ungraded").length;
  if (ungraded === 0) return null;
  return `Couldn’t grade ${characterCount(ungraded)} — ${ungradedDataPhrase(rows)}.`;
}

/**
 * Empty build-next copy. A roster of only ungraded characters is missing
 * data, not a set of finished builds.
 */
export function auditEmptyQueueMessage(
  rows: readonly Pick<AuditRow, "grade">[],
): string {
  const note = auditUngradedNote(rows);
  if (!note) {
    return "Nothing to build here — everyone meets their Builds targets.";
  }
  const built = rows.filter((row) => row.grade.bucket === "built_well").length;
  if (built === 0) return note;
  const done =
    built === 1
      ? "1 character meets their Builds targets"
      : `${built} characters meet their Builds targets`;
  return `${done}. ${note}`;
}

/** Weapon steps are prefixed so "Lv 80 → Lv 90" can't read as the character. */
export function auditStepLabel(step: AccountBuildAdviceStep): string {
  const text = formatAdviceStep(step);
  return step.kind === "weapon_level" || step.kind === "weapon_ascension"
    ? `Weapon ${text}`
    : text;
}
