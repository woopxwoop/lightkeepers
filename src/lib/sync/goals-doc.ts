/**
 * Calculator goals as a synced document (design: docs/design/account-sync.md).
 */

import {
  emptyGoalsState,
  MAX_CALCULATOR_GOALS,
  parseGoalsState,
} from "#lib/planner/calculator-goals.js";
import type {
  CalculatorGoal,
  CalculatorGoalsState,
} from "#lib/types/calculator-goals.js";
import { defineSyncedDocSpec, type MergeResult } from "#lib/sync/synced-doc.js";

/** `selectedId` is local UI state and never makes the two sides differ. */
function sameGoals(a: CalculatorGoalsState, b: CalculatorGoalsState): boolean {
  return (
    JSON.stringify(parseGoalsState(a).goals) ===
    JSON.stringify(parseGoalsState(b).goals)
  );
}

/**
 * Merge goal lists by goal id after the server rejected a stale write.
 *
 * Rule: **the most recent change wins, per goal.** Goals carry no edit
 * times, so "most recent" means the save happening now (`local`). That is
 * right for a stale tab and wrong only for an offline edit sent much later.
 *
 * Each goal is compared with `base`, the list both sides last agreed on:
 * - changed on one side only → that side (added, edited, or removed)
 * - changed on both sides    → `local`, including a local removal
 * - `base` null (the server never had a list) → every goal counts as added,
 *   so the result is the union, `local` winning on shared ids
 *
 * Order: `local` order, then goals only `remote` added. `selectedId` stays
 * local.
 *
 * If that list would exceed `MAX_CALCULATOR_GOALS`, return `"ask"` before
 * normalization. `parseGoalsState` would otherwise drop the tail, and
 * reconciliation would write the shortened list. The editors show that
 * question; Save does not pick a side (`saveAnswersAsk` is false).
 */
export function mergeGoals(
  base: CalculatorGoalsState | null,
  local: CalculatorGoalsState,
  remote: CalculatorGoalsState,
): MergeResult<CalculatorGoalsState> {
  const json = (goal: CalculatorGoal) => JSON.stringify(goal);
  const baseById = new Map((base?.goals ?? []).map((g) => [g.id, json(g)]));
  const remoteById = new Map(remote.goals.map((g) => [g.id, g]));
  const localIds = new Set(local.goals.map((g) => g.id));
  const goals: CalculatorGoal[] = [];

  for (const goal of local.goals) {
    const before = baseById.get(goal.id);
    const localChanged = before === undefined || json(goal) !== before;
    const theirs = remoteById.get(goal.id);
    if (!theirs) {
      // Remote removed it. Untouched here → stays removed; edited here → kept.
      if (localChanged) goals.push(goal);
      continue;
    }
    goals.push(localChanged ? goal : theirs);
  }

  for (const goal of remote.goals) {
    if (localIds.has(goal.id)) continue;
    // Only remote added it → keep. In base but gone here → removed locally,
    // and the local removal is the latest change.
    if (!baseById.has(goal.id)) goals.push(goal);
  }

  if (goals.length > MAX_CALCULATOR_GOALS) return "ask";
  return parseGoalsState({ goals, selectedId: local.selectedId });
}

export const goalsDocSpec = defineSyncedDocSpec<CalculatorGoalsState>({
  key: "goals",
  endpoint: "/api/calculator-goals",
  field: "goals",
  schemaVersion: 1,
  empty: emptyGoalsState,
  parse: (raw) => parseGoalsState(raw),
  // The server stores the goal list only. The selection stays on the device.
  toWire: (state) => parseGoalsState(state).goals,
  fromWire: (wire, local) =>
    parseGoalsState({ goals: wire, selectedId: local.selectedId }),
  equal: sameGoals,
  merge: mergeGoals,
  saveAnswersAsk: false,
});
