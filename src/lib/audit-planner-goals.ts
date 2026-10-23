/**
 * Append Audit Needs-work suggestions into Planner goals without duplicates.
 * Skips characters/weapons that already have a goal; never overrides.
 */

import {
  WEAPON_GRADE_TARGET,
  type AccountBuildAdviceKind,
  type AccountBuildGrade,
} from "$lib/account-build-grade";
import {
  appendGoal,
  createCharacterGoal,
  createWeaponGoal,
  MAX_CALCULATOR_GOALS,
} from "$lib/calculator-goals";
import type {
  CharacterOwned,
  InventoryWeapon,
  RosterProgress,
} from "$lib/definitions";
import { resolveCatalogCharacterId } from "$lib/planner-goal-edits";
import { plannerTargetFromBuilds } from "$lib/planner-targets";
import {
  progressToCharacterStart,
  rosterProgressForNameId,
} from "$lib/roster-progress";
import type {
  CalculatorGoalsState,
  CharacterCalculatorGoal,
  WeaponCalculatorGoal,
} from "$lib/types/calculator-goals";
import type { CharacterIndex } from "$lib/types/investment";
import type { UpgradeCostsCatalog } from "$lib/types/upgrade-costs";
import {
  MAX_ASCENSION,
  MAX_LEVEL,
  orderCharacterConfigs,
  orderWeaponConfigs,
  UPGRADE_DEFAULTS,
} from "$lib/upgrade-costs";
import { toGoodKey } from "$lib/utils";

const CHAR_PROGRESS_KINDS = new Set<AccountBuildAdviceKind>([
  "level",
  "ascension",
  "normal",
  "skill",
  "burst",
]);

const WEAPON_PROGRESS_KINDS = new Set<AccountBuildAdviceKind>([
  "weapon_level",
  "weapon_ascension",
]);

export type AuditSuggestionRow = {
  nameId: string;
  grade: AccountBuildGrade;
  weaponKey: string | null;
  /**
   * Progress the row was graded from. Weapon goals start at this copy's
   * level and ascension — the copy that produced the advice.
   */
  progress?: RosterProgress | null;
  /** Builds summary used for character target autofill. */
  builds: CharacterIndex | null;
};

export type AppendAuditSuggestionsResult = {
  state: CalculatorGoalsState;
  /** New goals appended this call. */
  added: number;
  /** Character/weapon suggestions skipped because a matching goal already existed. */
  skipped: number;
};

export function hasCharacterProgressAdvice(grade: AccountBuildGrade): boolean {
  return grade.adviceSteps.some((s) => CHAR_PROGRESS_KINDS.has(s.kind));
}

export function hasWeaponProgressAdvice(grade: AccountBuildGrade): boolean {
  return grade.adviceSteps.some((s) => WEAPON_PROGRESS_KINDS.has(s.kind));
}

export function hasCharacterGoal(
  state: CalculatorGoalsState,
  nameId: string,
): boolean {
  return state.goals.some(
    (g) => g.kind === "character" && g.name_id === nameId,
  );
}

export function hasWeaponGoal(
  state: CalculatorGoalsState,
  weaponId: number,
): boolean {
  return state.goals.some(
    (g) => g.kind === "weapon" && g.weapon_id === weaponId,
  );
}

export function catalogWeaponIdForKey(
  catalog: UpgradeCostsCatalog,
  weaponKey: string,
): number | null {
  const row = catalog.weapons.find((w) => toGoodKey(w.name) === weaponKey);
  return row?.id ?? null;
}

/** Whether this Audit row can add at least one new goal given current state. */
export function auditRowCanAddToPlanner(
  state: CalculatorGoalsState,
  catalog: UpgradeCostsCatalog,
  row: AuditSuggestionRow,
): boolean {
  if (state.goals.length >= MAX_CALCULATOR_GOALS) return false;
  const resolved = resolveCatalogCharacterId(catalog, row.nameId);
  if (
    resolved &&
    hasCharacterProgressAdvice(row.grade) &&
    !hasCharacterGoal(state, resolved)
  ) {
    return true;
  }
  if (row.weaponKey && hasWeaponProgressAdvice(row.grade)) {
    const weaponId = catalogWeaponIdForKey(catalog, row.weaponKey);
    if (weaponId != null && !hasWeaponGoal(state, weaponId)) return true;
  }
  return false;
}

/**
 * What the Audit row's planner control shows.
 * `add` is optimistic while planner goals / catalog are still loading.
 */
export type AuditPlannerState = "add" | "in_planner" | "full" | "none";

export function auditRowPlannerState(
  state: CalculatorGoalsState | null,
  catalog: UpgradeCostsCatalog | null,
  row: AuditSuggestionRow,
): AuditPlannerState {
  const charAdvice = hasCharacterProgressAdvice(row.grade);
  const weaponAdvice = hasWeaponProgressAdvice(row.grade);
  if (!charAdvice && !weaponAdvice) return "none";
  if (!state || !catalog) return "add";
  if (auditRowCanAddToPlanner(state, catalog, row)) return "add";

  const resolved = resolveCatalogCharacterId(catalog, row.nameId);
  const weaponId = row.weaponKey
    ? catalogWeaponIdForKey(catalog, row.weaponKey)
    : null;
  const covered =
    (charAdvice && resolved != null && hasCharacterGoal(state, resolved)) ||
    (weaponAdvice && weaponId != null && hasWeaponGoal(state, weaponId));
  if (covered) return "in_planner";
  if (state.goals.length >= MAX_CALCULATOR_GOALS) return "full";
  return "none";
}

function characterTargetAhead(
  start: CharacterCalculatorGoal["start"],
  target: CharacterCalculatorGoal["target"],
): boolean {
  return (
    target.level > start.level ||
    target.ascension > start.ascension ||
    target.talents.normal > start.talents.normal ||
    target.talents.skill > start.talents.skill ||
    target.talents.burst > start.talents.burst
  );
}

function weaponTargetAhead(
  start: WeaponCalculatorGoal["start"],
  target: WeaponCalculatorGoal["target"],
): boolean {
  return target.level > start.level || target.ascension > start.ascension;
}

function buildCharacterGoal(
  catalog: UpgradeCostsCatalog,
  row: AuditSuggestionRow,
  opts: {
    owned: readonly CharacterOwned[];
    weapons: readonly InventoryWeapon[] | null;
  },
): CharacterCalculatorGoal | null {
  if (!hasCharacterProgressAdvice(row.grade)) return null;
  const resolved = resolveCatalogCharacterId(catalog, row.nameId);
  if (!resolved) return null;
  const catRow = catalog.characters.find((c) => c.name_id === resolved);
  if (!catRow) return null;

  const progress = rosterProgressForNameId(
    [...opts.owned],
    resolved,
    opts.weapons,
  );
  const start = progress
    ? progressToCharacterStart(progress)
    : { ...UPGRADE_DEFAULTS.characterStart };
  const target = row.builds
    ? plannerTargetFromBuilds(row.builds, catRow.promotes)
    : { ...UPGRADE_DEFAULTS.characterTarget };
  let ordered = orderCharacterConfigs(start, target, catRow.promotes);
  if (!characterTargetAhead(ordered.start, ordered.target)) {
    ordered = orderCharacterConfigs(
      ordered.start,
      {
        level: MAX_LEVEL,
        ascension: MAX_ASCENSION,
        talents: ordered.target.talents,
      },
      catRow.promotes,
    );
  }
  if (!characterTargetAhead(ordered.start, ordered.target)) return null;
  return createCharacterGoal(resolved, {
    start: ordered.start,
    target: ordered.target,
  });
}

/** Level and ascension of the weapon the row's advice was computed from. */
function gradedWeaponStart(
  row: AuditSuggestionRow,
): { level: number; ascension: number } | null {
  const weapon = row.progress?.weapon;
  if (!weapon || weapon.key !== row.weaponKey) return null;
  return { level: weapon.level, ascension: weapon.ascension };
}

function buildWeaponGoal(
  catalog: UpgradeCostsCatalog,
  row: AuditSuggestionRow,
): WeaponCalculatorGoal | null {
  if (!row.weaponKey || !hasWeaponProgressAdvice(row.grade)) return null;
  const weaponId = catalogWeaponIdForKey(catalog, row.weaponKey);
  if (weaponId == null) return null;
  const catRow = catalog.weapons.find((w) => w.id === weaponId);
  if (!catRow) return null;

  const start = gradedWeaponStart(row);
  if (!start) return null;
  let ordered = orderWeaponConfigs(
    start,
    { ...WEAPON_GRADE_TARGET },
    catRow.promotes,
  );
  if (!weaponTargetAhead(ordered.start, ordered.target)) {
    ordered = orderWeaponConfigs(
      ordered.start,
      { level: MAX_LEVEL, ascension: MAX_ASCENSION },
      catRow.promotes,
    );
  }
  if (!weaponTargetAhead(ordered.start, ordered.target)) return null;
  return createWeaponGoal(weaponId, {
    start: ordered.start,
    target: ordered.target,
  });
}

/**
 * Append character and/or weapon goals from Audit suggestion rows.
 * Skips existing goals; never overrides. Stops at {@link MAX_CALCULATOR_GOALS}.
 */
export function appendAuditSuggestions(
  state: CalculatorGoalsState,
  catalog: UpgradeCostsCatalog,
  rows: readonly AuditSuggestionRow[],
  opts: {
    owned: readonly CharacterOwned[];
    weapons: readonly InventoryWeapon[] | null;
  },
): AppendAuditSuggestionsResult {
  let next = state;
  let added = 0;
  let skipped = 0;

  for (const row of rows) {
    if (hasCharacterProgressAdvice(row.grade)) {
      const resolved = resolveCatalogCharacterId(catalog, row.nameId);
      if (resolved && catalog.characters.some((c) => c.name_id === resolved)) {
        if (hasCharacterGoal(next, resolved)) {
          skipped += 1;
        } else if (next.goals.length < MAX_CALCULATOR_GOALS) {
          const goal = buildCharacterGoal(catalog, row, opts);
          if (goal) {
            const after = appendGoal(next, goal);
            if (after.goals.length > next.goals.length) {
              next = after;
              added += 1;
            }
          }
        }
      }
    }

    if (hasWeaponProgressAdvice(row.grade) && row.weaponKey) {
      const weaponId = catalogWeaponIdForKey(catalog, row.weaponKey);
      if (weaponId != null) {
        if (hasWeaponGoal(next, weaponId)) {
          skipped += 1;
        } else if (next.goals.length < MAX_CALCULATOR_GOALS) {
          const goal = buildWeaponGoal(catalog, row);
          if (goal) {
            const after = appendGoal(next, goal);
            if (after.goals.length > next.goals.length) {
              next = after;
              added += 1;
            }
          }
        }
      }
    }
  }

  return { state: next, added, skipped };
}
