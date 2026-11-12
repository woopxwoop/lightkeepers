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
  /** False when the cloud read failed or local edits are not reconciled yet. */
  postCloud: boolean;
  syncError: string;
};

/**
 * Failed-read recovery for one account. The base is that user's list at the
 * failure, then the cloud side of the last merge, so a copied cloud goal is
 * not treated as a local edit later. Stored locally so a reload can merge
 * again until a cloud save clears it.
 */
const GOALS_RECOVERY_KEY = "calculatorGoalsRecovery";

type GoalsRecovery = { userId: string; baseJson: string };

function readRecovery(): GoalsRecovery | null {
  try {
    const raw = localStorage.getItem(GOALS_RECOVERY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: unknown; baseJson?: unknown };
    if (typeof parsed.userId !== "string" || parsed.userId.length === 0)
      return null;
    if (typeof parsed.baseJson !== "string" || parsed.baseJson.length === 0)
      return null;
    return { userId: parsed.userId, baseJson: parsed.baseJson };
  } catch {
    return null;
  }
}

function writeRecovery(record: GoalsRecovery | null): void {
  try {
    if (!record) localStorage.removeItem(GOALS_RECOVERY_KEY);
    else localStorage.setItem(GOALS_RECOVERY_KEY, JSON.stringify(record));
  } catch {
    /* the merged goals list is still in local storage */
  }
}

function noteFailedRead(
  userId: string | null | undefined,
  local: CalculatorGoalsState,
): void {
  if (!userId) return;
  const existing = readRecovery();
  if (existing?.userId === userId) return;
  writeRecovery({ userId, baseJson: captureGoals(local).json });
}

/**
 * Pending edits stay until a cloud save lands. A read that finds no local
 * change since the failure drops the snapshot. Another account's snapshot
 * is dropped instead of being merged into this read.
 */
function peekPendingLocal(
  userId: string | null | undefined,
  current: CalculatorGoalsState,
): CalculatorGoalsState | null {
  if (!userId) return null;
  const existing = readRecovery();
  if (!existing) return null;
  if (existing.userId !== userId) {
    writeRecovery(null);
    return null;
  }
  if (existing.baseJson === captureGoals(current).json) {
    writeRecovery(null);
    return null;
  }
  try {
    return parseGoalsState(JSON.parse(existing.baseJson) as unknown);
  } catch {
    writeRecovery(null);
    return null;
  }
}

function recoveryPending(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return readRecovery()?.userId === userId;
}

/** The next merge compares local edits with this read's cloud list. */
function rebaseRecovery(userId: string, cloudSide: CalculatorGoalsState): void {
  writeRecovery({ userId, baseJson: captureGoals(cloudSide).json });
}

/** Drop the recovery snapshot after the merged list has been stored in the cloud. */
export function clearPendingGoalsRecovery(): void {
  writeRecovery(null);
}

/**
 * Cloud is the base. Edits saved after a failed signed-in read stay:
 * local adds and local changes win, and a goal removed since that failure
 * stays removed. Goals the local list did not touch keep the cloud copy.
 */
function reconcilePendingGoals(
  base: CalculatorGoalsState,
  local: CalculatorGoalsState,
  cloudGoals: CalculatorGoalsState["goals"],
): CalculatorGoalsState {
  const cloud = applyCloudGoals(local, cloudGoals);
  const baseById = new Map(
    base.goals.map((goal) => [goal.id, JSON.stringify(goal)]),
  );
  const localById = new Map(local.goals.map((goal) => [goal.id, goal]));
  const seen = new Set<string>();
  const goals: CalculatorGoalsState["goals"] = [];

  for (const cloudGoal of cloud.goals) {
    seen.add(cloudGoal.id);
    const localGoal = localById.get(cloudGoal.id);
    const baseJson = baseById.get(cloudGoal.id);
    if (!localGoal) {
      if (baseJson != null) continue;
      goals.push(cloudGoal);
      continue;
    }
    const localJson = JSON.stringify(localGoal);
    goals.push(
      baseJson == null || localJson !== baseJson ? localGoal : cloudGoal,
    );
  }

  for (const localGoal of local.goals) {
    if (seen.has(localGoal.id)) continue;
    const baseJson = baseById.get(localGoal.id);
    const localJson = JSON.stringify(localGoal);
    if (baseJson == null || localJson !== baseJson) goals.push(localGoal);
  }

  return parseGoalsState({
    goals,
    selectedId: local.selectedId,
  });
}

/**
 * Local → optional cloud (signed-in). A stored cloud list wins, including
 * an empty one, when no local-only edits are waiting. No row keeps local.
 * A failed read keeps local, reports `syncError`, and sets `postCloud` false.
 * A same-tab save during the read bumps `goalsLocalRevision`; that older
 * response is discarded and does not replace the save. A failed read still
 * does not POST, including when the revision moved.
 * `replaceLocal: false` keeps the local list and leaves posting disabled
 * until a later read reconciles it with the cloud list.
 * `allowWrite` runs after the response arrives and before any cloud list is
 * stored. A stale account returns the local list and does not write.
 * `userId` scopes failed-read recovery so one account's edits are not merged
 * into another's cloud list.
 */
export async function hydrateGoalsState(
  signedIn: boolean,
  opts?: {
    replaceLocal?: boolean;
    allowWrite?: () => boolean;
    userId?: string | null;
  },
): Promise<GoalsHydration> {
  const local = readGoalsLocal();
  if (!signedIn) {
    return { ...captureGoals(local), postCloud: false, syncError: "" };
  }
  const userId = opts?.userId ?? null;
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
  const keepUnreconciled = opts?.replaceLocal === false;
  if (get(goalsLocalRevision) !== revision) {
    const current = captureGoals(readGoalsLocal());
    if (cloud.status === "error" || keepUnreconciled) {
      if (cloud.status === "error") noteFailedRead(userId, local);
      return {
        ...current,
        postCloud: false,
        syncError: cloud.status === "error" ? cloud.message : "",
      };
    }
    if (cloud.status === "goals" && recoveryPending(userId)) {
      return { ...current, postCloud: false, syncError: "" };
    }
    return { ...current, postCloud: true, syncError: "" };
  }
  if (cloud.status === "error") {
    noteFailedRead(userId, local);
    return {
      ...captureGoals(local),
      postCloud: false,
      syncError: cloud.message,
    };
  }
  if (cloud.status === "goals") {
    if (keepUnreconciled) {
      return {
        ...captureGoals(readGoalsLocal()),
        postCloud: false,
        syncError: "",
      };
    }
    if (opts?.allowWrite && !opts.allowWrite()) {
      return {
        ...captureGoals(readGoalsLocal()),
        postCloud: false,
        syncError: "",
      };
    }
    const current = readGoalsLocal();
    const pendingBase = peekPendingLocal(userId, current);
    const cloudSide = applyCloudGoals(current, cloud.goals);
    const next = pendingBase
      ? reconcilePendingGoals(pendingBase, current, cloud.goals)
      : cloudSide;
    const stored = persistGoalsLocal(next);
    if (pendingBase && userId && stored) rebaseRecovery(userId, cloudSide);
    return {
      ...captureGoals(next),
      postCloud: !pendingBase || stored,
      syncError:
        pendingBase && !stored ? "Sync failed (0) — goals not synced" : "",
    };
  }
  peekPendingLocal(userId, local);
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
      clearPendingGoalsRecovery();
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
