/**
 * Calculator goals as a synced document (design: docs/design/account-sync.md).
 * Not wired yet — phase 2 moves Planner, Audit, and the itinerary onto it.
 */

import { emptyGoalsState, parseGoalsState } from "#lib/calculator-goals.js";
import type { CalculatorGoalsState } from "#lib/types/calculator-goals.js";
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
 * `base` is the list both sides last agreed on (null: the server never had
 * one). Keep `local.selectedId`. Keep the order of `local`, then add goals
 * that only `remote` added.
 */
export function mergeGoals(
  base: CalculatorGoalsState | null,
  local: CalculatorGoalsState,
  remote: CalculatorGoalsState,
): MergeResult<CalculatorGoalsState> {
  // TODO(owner): decide the per-goal rule. For each id, compare against `base`:
  //   - changed on one side only → take that side
  //   - changed on both sides    → local wins? remote wins? or "ask"?
  //   - deleted on one side, edited on the other → keep the edit, or delete?
  //   - base === null → treat every goal as added on both sides
  // Placeholder until decided: the user's device wins outright.
  void base;
  void remote;
  return local;
}

export const goalsDocSpec = defineSyncedDocSpec<CalculatorGoalsState>({
  key: "goals",
  endpoint: "/api/calculator-goals",
  schemaVersion: 1,
  empty: emptyGoalsState,
  parse: (raw) => parseGoalsState(raw),
  equal: sameGoals,
  merge: mergeGoals,
});
