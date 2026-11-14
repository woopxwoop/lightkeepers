/**
 * Pure goal-editor helpers shared by Planner, itinerary, and audit:
 * pending removes, the unsaved check, and character autofill.
 *
 * Loading, saving, accounts, and the server live in the synced document
 * (`#lib/app/goals-sync.js`, `#lib/app/goals-draft.svelte.js`).
 */

import {
  findGoal,
  parseGoalsState,
  removeGoal,
  replaceGoal,
} from "#lib/planner/calculator-goals.js";
import { captureGoals } from "#lib/planner/calculator-goals-snapshot.js";
import {
  fetchPlannerTargetFromBuilds,
  simKeyForCatalogCharacter,
} from "#lib/planner/planner-goal-edits.js";
import type { CalculatorGoalsState } from "#lib/types/calculator-goals.js";
import type { UpgradeCostsCatalog } from "#lib/types/upgrade-costs.js";
import { orderCharacterConfigs } from "#lib/planner/upgrade-costs.js";

export function goalsWithoutPendingRemoves(
  state: CalculatorGoalsState,
  pendingRemoveIds: ReadonlySet<string>,
): CalculatorGoalsState {
  let next = state;
  for (const id of pendingRemoveIds) {
    next = removeGoal(next, id);
  }
  return next;
}

/** Dirty check on the goals list only — selectedId is local chrome. */
export function goalsListDiffersFromSnapshot(
  state: CalculatorGoalsState,
  savedJson: string,
): boolean {
  try {
    const saved = parseGoalsState(JSON.parse(savedJson) as unknown);
    return (
      JSON.stringify(parseGoalsState(state).goals) !==
      JSON.stringify(saved.goals)
    );
  } catch {
    return captureGoals(state).json !== savedJson;
  }
}

export function goalsHaveUnsavedChanges(input: {
  hydrated: boolean;
  state: CalculatorGoalsState;
  savedSnapshot: string;
  pendingRemoveIds: ReadonlySet<string>;
}): boolean {
  if (!input.hydrated || !input.savedSnapshot) return false;
  if (input.pendingRemoveIds.size > 0) return true;
  return goalsListDiffersFromSnapshot(input.state, input.savedSnapshot);
}

/** Apply build-summary autofill onto a character goal when still current. */
export async function autofillCharacterGoalState(input: {
  state: CalculatorGoalsState;
  catalog: UpgradeCostsCatalog;
  nameId: string;
  goalId: string;
}): Promise<CalculatorGoalsState | null> {
  const row = input.catalog.characters.find((c) => c.name_id === input.nameId);
  if (!row) return null;
  const target = await fetchPlannerTargetFromBuilds(
    input.nameId,
    row.promotes,
    simKeyForCatalogCharacter(input.catalog, input.nameId),
  );
  if (!target) return null;
  const current = findGoal(input.state, input.goalId);
  if (
    !current ||
    current.kind !== "character" ||
    current.name_id !== input.nameId
  ) {
    return null;
  }
  return replaceGoal(input.state, {
    ...current,
    ...orderCharacterConfigs(current.start, target, row.promotes),
  });
}
