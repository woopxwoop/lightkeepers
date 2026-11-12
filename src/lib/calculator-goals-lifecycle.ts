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
  captureGoalsEditRevision,
  fetchGoalsCloud,
  goalsLocalEditSince,
  goalsLocalRevision,
  localRevisionWasCloudApply,
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
  /**
   * The stored list still has edits the cloud response did not include.
   * A later POST is what clears it; assigning the snapshot does not.
   */
  cloudDirty?: boolean;
};

/**
 * Failed-read recovery for one account. The base is that user's list at the
 * failure, then the cloud side of the last merge, so a copied cloud goal is
 * not treated as a local edit later. Stored locally so a reload can merge
 * again until a cloud save clears it.
 */
const GOALS_RECOVERY_KEY = "calculatorGoalsRecovery";

type GoalsRecovery = {
  userId: string;
  baseJson: string;
  /** Bumps on every write so a later snapshot is not cleared by an older save. */
  generation: number;
  /**
   * A failed read holds posting until the next merge. A rebased cloud base
   * only feeds that merge and must not block a newer cloud response.
   */
  holdPost: boolean;
};

let recoveryGenerationCounter = 0;

function readRecovery(): GoalsRecovery | null {
  try {
    const raw = localStorage.getItem(GOALS_RECOVERY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      userId?: unknown;
      baseJson?: unknown;
      generation?: unknown;
      holdPost?: unknown;
    };
    if (typeof parsed.userId !== "string" || parsed.userId.length === 0)
      return null;
    if (typeof parsed.baseJson !== "string" || parsed.baseJson.length === 0)
      return null;
    const generation =
      typeof parsed.generation === "number" && parsed.generation >= 0
        ? parsed.generation
        : 0;
    if (generation > recoveryGenerationCounter) {
      recoveryGenerationCounter = generation;
    }
    return {
      userId: parsed.userId,
      baseJson: parsed.baseJson,
      generation,
      holdPost: parsed.holdPost !== false,
    };
  } catch {
    return null;
  }
}

function writeRecovery(
  record: { userId: string; baseJson: string; holdPost?: boolean } | null,
): void {
  try {
    if (!record) {
      localStorage.removeItem(GOALS_RECOVERY_KEY);
      return;
    }
    recoveryGenerationCounter += 1;
    const stored: GoalsRecovery = {
      userId: record.userId,
      baseJson: record.baseJson,
      generation: recoveryGenerationCounter,
      holdPost: record.holdPost !== false,
    };
    localStorage.setItem(GOALS_RECOVERY_KEY, JSON.stringify(stored));
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
  writeRecovery({
    userId,
    baseJson: captureGoals(local).json,
    holdPost: true,
  });
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
  const existing = readRecovery();
  return existing?.userId === userId && existing.holdPost;
}

/** The next merge compares local edits with this read's cloud list. */
function rebaseRecovery(userId: string, cloudSide: CalculatorGoalsState): void {
  writeRecovery({
    userId,
    baseJson: captureGoals(cloudSide).json,
    holdPost: false,
  });
}

/** Drop the recovery snapshot after the merged list has been stored in the cloud. */
export function clearPendingGoalsRecovery(): void {
  writeRecovery(null);
}

/**
 * Drop recovery only when this POST is still the account's current list.
 * A newer snapshot for the same user, or local goals saved after the POST
 * body was captured, stays for the next merge.
 */
function clearRecoveryOwnedBy(
  userId: string | null | undefined,
  covered: { generation: number | null; goalsJson: string },
): void {
  if (!userId) return;
  const existing = readRecovery();
  if (!existing || existing.userId !== userId) return;
  if (existing.generation !== covered.generation) return;
  if (captureGoals(readGoalsLocal()).json !== covered.goalsJson) return;
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
 * Store `next` when it adds goals the current local list does not have.
 * `postCloud` is true only once that full list is the one a later POST would send.
 */
function hydrationFromReconciled(
  current: CalculatorGoalsState,
  next: CalculatorGoalsState,
): GoalsHydration {
  const reconciled = captureGoals(next);
  const storedNow = captureGoals(current);
  if (reconciled.json === storedNow.json) {
    return { ...storedNow, postCloud: true, syncError: "" };
  }
  const stored = persistGoalsLocal(next);
  return {
    ...captureGoals(stored ? next : current),
    postCloud: stored,
    syncError: stored ? "" : "Sync failed (0) — goals not synced",
  };
}

/**
 * Read order for overlapping hydrates. A cloud-applied revision only means
 * the latest local write came from a hydrate; an older response still must
 * not replace a list a newer read already stored.
 */
let goalsReadSerial = 0;
let appliedGoalsReadSerial = 0;

function takeGoalsReadSerial(): number {
  goalsReadSerial += 1;
  return goalsReadSerial;
}

function noteGoalsReadApplied(serial: number): void {
  if (serial > appliedGoalsReadSerial) appliedGoalsReadSerial = serial;
}

function goalsReadWasSuperseded(serial: number): boolean {
  return serial < appliedGoalsReadSerial;
}

function savedStateDuringRead(
  editRevision: number,
): CalculatorGoalsState | null {
  const json = goalsLocalEditSince(editRevision);
  if (json == null) return null;
  try {
    return parseGoalsState(JSON.parse(json) as unknown);
  } catch {
    return null;
  }
}

function appliedHydration(
  readSerial: number,
  currentState: CalculatorGoalsState,
  next: CalculatorGoalsState,
  userId: string | null,
): GoalsHydration {
  const revisionBefore = get(goalsLocalRevision);
  const hydration = hydrationFromReconciled(currentState, next);
  if (hydration.postCloud) noteGoalsReadApplied(readSerial);
  if (hydration.postCloud && get(goalsLocalRevision) !== revisionBefore) {
    rememberGoalsWrite(userId);
  }
  return hydration;
}

/** Revision and account of the local goals write a cloud save may roll back. */
let goalsWriteOwner: { revision: number; userId: string | null } | null = null;

function rememberGoalsWrite(userId: string | null | undefined): void {
  goalsWriteOwner = {
    revision: get(goalsLocalRevision),
    userId: userId ?? null,
  };
}

/**
 * A hydration for another account takes over rollback ownership even when it
 * stored nothing, so an earlier account's failed POST cannot restore its
 * snapshot over the list this account now shows.
 */
function claimGoalsWrites(userId: string | null | undefined): void {
  if ((goalsWriteOwner?.userId ?? null) === (userId ?? null)) return;
  rememberGoalsWrite(userId);
}

/**
 * Restore `snapshot` only when this save's revision and account are still
 * the latest local write. A newer save or hydration keeps its goals.
 */
function restoreGoalsIfCurrent(
  revision: number,
  userId: string | null | undefined,
  snapshot: string,
): void {
  if (get(goalsLocalRevision) !== revision) return;
  const owner = goalsWriteOwner;
  if (!owner || owner.revision !== revision) return;
  if ((owner.userId ?? null) !== (userId ?? null)) return;
  writeGoalsLocal(snapshot);
}

/**
 * Remember the cloud side when the merge kept a local add or a local edit
 * of a goal the cloud already had. A later read merges against that side
 * until a matching POST. Identical goal lists do not need a base.
 */
function cloudGoalsDiffer(
  merged: CalculatorGoalsState,
  cloudGoals: CalculatorGoalsState["goals"],
): { cloudSide: CalculatorGoalsState; differs: boolean } {
  const cloudSide = applyCloudGoals(merged, cloudGoals);
  return {
    cloudSide,
    differs: JSON.stringify(merged.goals) !== JSON.stringify(cloudSide.goals),
  };
}

function keepMergedEdits(
  userId: string | null,
  merged: CalculatorGoalsState,
  cloudGoals: CalculatorGoalsState["goals"],
): void {
  if (!userId) return;
  const { cloudSide, differs } = cloudGoalsDiffer(merged, cloudGoals);
  if (!differs) return;
  rebaseRecovery(userId, cloudSide);
}

/**
 * A settled read whose list still differs from the recovery base has
 * unsynced goals. Uses the peekPendingLocal flow, so a base that now matches
 * is dropped.
 */
function withPendingRecovery(
  hydration: GoalsHydration,
  userId: string | null,
  state: CalculatorGoalsState,
): GoalsHydration {
  if (!hydration.postCloud || !userId) return hydration;
  return peekPendingLocal(userId, state)
    ? { ...hydration, cloudDirty: true }
    : hydration;
}

/** Mark a stored merge that still has edits the cloud list does not. */
function withCloudDirty(
  hydration: GoalsHydration,
  merged: CalculatorGoalsState,
  cloudGoals: CalculatorGoalsState["goals"],
): GoalsHydration {
  if (!hydration.postCloud) return hydration;
  if (!cloudGoalsDiffer(merged, cloudGoals).differs) return hydration;
  return { ...hydration, cloudDirty: true };
}

/**
 * True when the editor may take a cloud read at `revision`.
 * Equality with the revision already shown is safe. A later cloud apply is
 * safe too. A same-tab save is not — that revision is a local edit.
 */
export function goalsRevisionAllowsCloudReplace(
  revision: number,
  baselineRevision: number,
): boolean {
  if (revision === baselineRevision) return true;
  return localRevisionWasCloudApply(
    revision,
    captureGoals(readGoalsLocal()).json,
  );
}

/**
 * The visible session owns this hydration. Pending and mismatched stores do
 * not, so a later session update can repeat the read. A signed-in read that
 * neither applied nor failed was discarded and must not stick. A failed read
 * does stick, with `postCloud` left false.
 */
export function acceptGoalsHydrationUser(input: {
  readUserId: string | null;
  sessionPending: boolean;
  sessionUserId: string | null;
  postCloud: boolean;
  syncError: string;
}): boolean {
  if (input.sessionPending || input.sessionUserId !== input.readUserId) {
    return false;
  }
  if (input.readUserId !== null && !input.postCloud && input.syncError === "") {
    return false;
  }
  return true;
}

/**
 * An accepted read that failed. It keeps its account with posting off, and
 * the page reads again on the next session or local revision change before
 * cloud posting turns back on.
 */
export function goalsReadFailed(hydration: {
  postCloud: boolean;
  syncError: string;
}): boolean {
  return !hydration.postCloud && hydration.syncError !== "";
}

/**
 * Local → optional cloud (signed-in). A stored cloud list wins, including
 * an empty one, when no local-only edits are waiting. No row keeps local.
 * A failed read keeps local, reports `syncError`, and sets `postCloud` false.
 * A same-tab save during the read is merged with the cloud list. A revision
 * bump from applying cloud goals is not a local edit. An older response
 * keeps the list a newer read already stored. A failed read still does not
 * POST.
 * `replaceLocal: false` keeps the local list and leaves posting disabled
 * until a later read reconciles it with the cloud list.
 * `allowWrite` runs after the response arrives and before any cloud list or
 * recovery snapshot is stored. A stale account returns the local list and
 * does not write.
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
    if (!opts?.allowWrite || opts.allowWrite()) claimGoalsWrites(null);
    return { ...captureGoals(local), postCloud: false, syncError: "" };
  }
  const userId = opts?.userId ?? null;
  const readSerial = takeGoalsReadSerial();
  const editRevision = captureGoalsEditRevision();
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
  const allowWrite = !opts?.allowWrite || opts.allowWrite();
  const revisionNow = get(goalsLocalRevision);
  const currentState = readGoalsLocal();
  const current = captureGoals(currentState);
  const cloudApplied =
    revisionNow !== revision &&
    localRevisionWasCloudApply(revisionNow, current.json);

  if (revisionNow !== revision) {
    if (cloud.status === "error" || keepUnreconciled) {
      // A cloud apply bumped the revision. Recording `local` from before
      // that write would classify the applied list as a local edit.
      if (cloud.status === "error" && allowWrite && !cloudApplied) {
        noteFailedRead(userId, local);
      }
      return {
        ...current,
        postCloud: false,
        syncError: cloud.status === "error" ? cloud.message : "",
      };
    }
    if (cloud.status === "goals") {
      if (!allowWrite || recoveryPending(userId)) {
        return { ...current, postCloud: false, syncError: "" };
      }
      // A newer read already stored its list. `cloudApplied` is true for that
      // write too, and applying this older cloud list would drop the save.
      claimGoalsWrites(userId);
      if (goalsReadWasSuperseded(readSerial)) {
        return withPendingRecovery(
          { ...current, postCloud: true, syncError: "" },
          userId,
          currentState,
        );
      }
      // After a cloud apply, the stored list already merged any mid-read
      // save against the newer read's cloud side. Comparing that save with
      // a recovery base that advanced since would drop cloud-only goals.
      const savedDuringRead = cloudApplied
        ? null
        : savedStateDuringRead(editRevision);
      if (savedDuringRead) {
        // A rebased recovery base omits additions the last merge kept.
        // The pre-read list still contains them, so an unchanged addition
        // would look synced and be dropped when the cloud omits it.
        const pendingBase = peekPendingLocal(userId, savedDuringRead);
        const reconciled = reconcilePendingGoals(
          pendingBase ?? local,
          savedDuringRead,
          cloud.goals,
        );
        const hydration = appliedHydration(
          readSerial,
          currentState,
          reconciled,
          userId,
        );
        if (hydration.postCloud) {
          const { differs } = cloudGoalsDiffer(reconciled, cloud.goals);
          if (pendingBase && userId && !differs) clearPendingGoalsRecovery();
          else keepMergedEdits(userId, reconciled, cloud.goals);
        }
        return withCloudDirty(hydration, reconciled, cloud.goals);
      }
      if (cloudApplied) {
        // Recovered local additions survive a revision marked cloud-applied.
        const pendingBase = peekPendingLocal(userId, currentState);
        const cloudSide = applyCloudGoals(currentState, cloud.goals);
        const next = pendingBase
          ? reconcilePendingGoals(pendingBase, currentState, cloud.goals)
          : cloudSide;
        const hydration = appliedHydration(
          readSerial,
          currentState,
          next,
          userId,
        );
        if (hydration.postCloud && pendingBase && userId) {
          if (cloudGoalsDiffer(next, cloud.goals).differs) {
            rebaseRecovery(userId, cloudSide);
          } else {
            clearPendingGoalsRecovery();
          }
        }
        return withCloudDirty(hydration, next, cloud.goals);
      }
      const reconciled = reconcilePendingGoals(
        local,
        currentState,
        cloud.goals,
      );
      const hydration = appliedHydration(
        readSerial,
        currentState,
        reconciled,
        userId,
      );
      if (hydration.postCloud) keepMergedEdits(userId, reconciled, cloud.goals);
      return withCloudDirty(hydration, reconciled, cloud.goals);
    }
    if (!allowWrite) {
      return { ...current, postCloud: false, syncError: "" };
    }
    claimGoalsWrites(userId);
    return withPendingRecovery(
      { ...current, postCloud: true, syncError: "" },
      userId,
      currentState,
    );
  }
  if (cloud.status === "error") {
    if (allowWrite) noteFailedRead(userId, local);
    return {
      ...captureGoals(local),
      postCloud: false,
      syncError: cloud.message,
    };
  }
  if (cloud.status === "goals") {
    if (keepUnreconciled || !allowWrite) {
      return {
        ...captureGoals(readGoalsLocal()),
        postCloud: false,
        syncError: "",
      };
    }
    claimGoalsWrites(userId);
    if (goalsReadWasSuperseded(readSerial)) {
      return withPendingRecovery(
        { ...current, postCloud: true, syncError: "" },
        userId,
        currentState,
      );
    }
    const pendingBase = peekPendingLocal(userId, currentState);
    const cloudSide = applyCloudGoals(currentState, cloud.goals);
    const next = pendingBase
      ? reconcilePendingGoals(pendingBase, currentState, cloud.goals)
      : cloudSide;
    const alreadyStored = captureGoals(next).json === current.json;
    const wrote = alreadyStored ? false : persistGoalsLocal(next);
    const postCloud = alreadyStored || wrote;
    const { differs } = cloudGoalsDiffer(next, cloud.goals);
    // An already-stored merge still has to move the recovery base. Leaving
    // the previous base in place keeps a cloud copy that later disappears.
    if (postCloud && pendingBase && userId) {
      if (differs) rebaseRecovery(userId, cloudSide);
      else clearPendingGoalsRecovery();
    }
    if (postCloud) noteGoalsReadApplied(readSerial);
    if (wrote) rememberGoalsWrite(userId);
    return {
      ...captureGoals(postCloud ? next : readGoalsLocal()),
      postCloud,
      syncError: postCloud ? "" : "Sync failed (0) — goals not synced",
      ...(postCloud && differs ? { cloudDirty: true } : {}),
    };
  }
  if (!allowWrite) {
    return {
      ...captureGoals(readGoalsLocal()),
      postCloud: false,
      syncError: "",
    };
  }
  claimGoalsWrites(userId);
  return withPendingRecovery(
    { ...captureGoals(local), postCloud: true, syncError: "" },
    userId,
    local,
  );
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
  /** Account this cloud save covers. Another account's recovery stays. */
  userId?: string | null;
}): Promise<SaveGoalsResult> {
  const pending = captureGoals(
    goalsWithoutPendingRemoves(input.state, input.pendingRemoveIds),
  );
  const userId = input.userId ?? null;
  let writtenRevision: number | null = null;
  try {
    if (!input.cloud && userId) {
      try {
        noteFailedRead(
          userId,
          parseGoalsState(JSON.parse(input.savedSnapshot) as unknown),
        );
      } catch {
        /* a later read replaces a baseline it cannot parse */
      }
    }
    const localOk = writeGoalsLocal(pending.json);
    if (!localOk) {
      console.warn("localStorage unavailable — saving to memory only");
    } else {
      writtenRevision = get(goalsLocalRevision);
      rememberGoalsWrite(userId);
    }
    if (input.cloud) {
      const recoveryAtStart = readRecovery();
      const coveredGeneration =
        recoveryAtStart?.userId === input.userId
          ? recoveryAtStart.generation
          : null;
      const result = await postGoals(pending.state);
      if (!result.ok) {
        if (writtenRevision !== null) {
          restoreGoalsIfCurrent(writtenRevision, userId, input.savedSnapshot);
        }
        return {
          ok: false,
          message: result.message
            ? `Sync failed (${result.status}): ${result.message}`
            : `Sync failed (${result.status}) — goals not saved to cloud`,
        };
      }
      clearRecoveryOwnedBy(input.userId, {
        generation: coveredGeneration,
        goalsJson: pending.json,
      });
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
    if (writtenRevision !== null) {
      restoreGoalsIfCurrent(writtenRevision, userId, input.savedSnapshot);
    }
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
