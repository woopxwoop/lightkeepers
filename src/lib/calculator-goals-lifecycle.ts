/**
 * Shared calculator-goals lifecycle for planner + itinerary.
 * Hydration, same-tab sync, pending removes, save, character autofill.
 */

import { get } from "svelte/store";
import {
  applyCloudGoals,
  findGoal,
  parseGoalsState,
  removeGoal,
  replaceGoal,
} from "#lib/calculator-goals.js";
import {
  captureGoals,
  fetchGoalsCloud,
  goalsLocalRevision,
  persistGoalsLocal,
  postGoals,
  readGoalsLocal,
  writeGoalsLocal,
  type GoalsCapture,
  type GoalsCloudRead,
} from "#lib/calculator-goals-snapshot.js";
import {
  fetchPlannerTargetFromBuilds,
  simKeyForCatalogCharacter,
} from "#lib/planner-goal-edits.js";
import type { CalculatorGoalsState } from "#lib/types/calculator-goals.js";
import type { UpgradeCostsCatalog } from "#lib/types/upgrade-costs.js";
import { orderCharacterConfigs } from "#lib/upgrade-costs.js";

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

export type GoalsHydration = GoalsCapture & {
  /** False when the cloud read failed. Save writes local only and does not POST. */
  postCloud: boolean;
  syncError: string;
};

/**
 * Local → optional cloud (signed-in). A stored cloud list wins, including
 * an empty one. No row keeps local. A failed read keeps local, reports
 * `syncError`, and sets `postCloud` false.
 * A same-tab save during the read bumps `goalsLocalRevision`; that older
 * response is discarded and does not replace the save. A failed read still
 * does not POST, including when the revision moved.
 */
export async function hydrateGoalsState(
  signedIn: boolean,
): Promise<GoalsHydration> {
  const local = readGoalsLocal();
  if (!signedIn) {
    return { ...captureGoals(local), postCloud: false, syncError: "" };
  }
  const revision = get(goalsLocalRevision);
  let cloud: GoalsCloudRead;
  try {
    cloud = await fetchGoalsCloud();
  } catch {
    cloud = {
      status: "error",
      message: "Sync failed (0) — goals not synced",
    };
  }
  if (get(goalsLocalRevision) !== revision) {
    const current = captureGoals(readGoalsLocal());
    if (cloud.status === "error") {
      return {
        ...current,
        postCloud: false,
        syncError: cloud.message,
      };
    }
    return { ...current, postCloud: true, syncError: "" };
  }
  if (cloud.status === "error") {
    return {
      ...captureGoals(local),
      postCloud: false,
      syncError: cloud.message,
    };
  }
  if (cloud.status === "goals") {
    const next = applyCloudGoals(local, cloud.goals);
    persistGoalsLocal(next);
    return { ...captureGoals(next), postCloud: true, syncError: "" };
  }
  return { ...captureGoals(local), postCloud: true, syncError: "" };
}

/** Same-tab sync: re-read local only when it differs from the saved baseline. */
export function readGoalsIfChanged(savedSnapshot: string): GoalsCapture | null {
  const pending = captureGoals(readGoalsLocal());
  if (pending.json === savedSnapshot) return null;
  return pending;
}

export type SaveGoalsResult =
  { ok: true; capture: GoalsCapture } | { ok: false; message: string };

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
