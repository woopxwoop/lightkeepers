/**
 * Shared calculator-goals lifecycle for planner + itinerary.
 * Hydration, same-tab sync, pending removes, save, character autofill.
 */

import {
  applyCloudGoals,
  findGoal,
  parseGoalsState,
  removeGoal,
  replaceGoal,
} from "$lib/calculator-goals";
import {
  captureGoals,
  fetchGoalsCloud,
  persistGoalsLocal,
  postGoals,
  readGoalsLocal,
  writeGoalsLocal,
  type GoalsCapture,
} from "$lib/calculator-goals-snapshot";
import {
  fetchPlannerTargetFromBuilds,
  simKeyForCatalogCharacter,
} from "$lib/planner-goal-edits";
import type { CalculatorGoalsState } from "$lib/types/calculator-goals";
import type { UpgradeCostsCatalog } from "$lib/types/upgrade-costs";
import { orderCharacterConfigs } from "$lib/upgrade-costs";

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

/**
 * Local → optional cloud (signed-in). Cloud list wins when a row exists.
 * Always returns a capture ready to commit as the saved baseline.
 */
export async function hydrateGoalsState(signedIn: boolean): Promise<GoalsCapture> {
  let local = readGoalsLocal();
  if (signedIn) {
    try {
      const cloud = await fetchGoalsCloud();
      if (cloud) {
        local = applyCloudGoals(local, cloud);
        persistGoalsLocal(local);
      }
    } catch {
      /* keep local */
    }
  }
  return captureGoals(local);
}

/** Same-tab sync: re-read local only when it differs from the saved baseline. */
export function readGoalsIfChanged(
  savedSnapshot: string,
): GoalsCapture | null {
  const pending = captureGoals(readGoalsLocal());
  if (pending.json === savedSnapshot) return null;
  return pending;
}

export type SaveGoalsResult =
  | { ok: true; capture: GoalsCapture }
  | { ok: false; message: string };

/**
 * Persist pending removes + editor state. On cloud failure, restores
 * `savedSnapshot` to localStorage so other tabs stay consistent.
 */
export async function saveGoalsState(input: {
  state: CalculatorGoalsState;
  pendingRemoveIds: ReadonlySet<string>;
  savedSnapshot: string;
  cloud: boolean;
}): Promise<SaveGoalsResult> {
  const pending = captureGoals(
    goalsWithoutPendingRemoves(input.state, input.pendingRemoveIds),
  );
  try {
    const localOk = writeGoalsLocal(pending.json);
    if (!localOk) {
      console.warn("localStorage unavailable — saving to memory only");
    }
    if (input.cloud) {
      const result = await postGoals(pending.state);
      if (!result.ok) {
        writeGoalsLocal(input.savedSnapshot);
        return {
          ok: false,
          message: result.message
            ? `Sync failed (${result.status}): ${result.message}`
            : `Sync failed (${result.status}) — goals not saved to cloud`,
        };
      }
      return { ok: true, capture: pending };
    }
    if (!localOk) {
      return {
        ok: false,
        message: "Could not save goals locally",
      };
    }
    return { ok: true, capture: pending };
  } catch (e) {
    writeGoalsLocal(input.savedSnapshot);
    console.error("Goals save error:", e);
    return {
      ok: false,
      message: `Something went wrong — your changes may not be saved (${(e as Error)?.name ?? typeof e})`,
    };
  }
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
