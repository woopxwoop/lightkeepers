/**
 * Calculator goals snapshots: a frozen clone + JSON, taken before any await
 * so a save commits exactly what the editor showed. Storage and the server
 * belong to the synced document (`#lib/app/goals-sync.js`).
 */

import { parseGoalsState } from "#lib/calculator-goals.js";
import type { CalculatorGoalsState } from "#lib/types/calculator-goals.js";

export type GoalsCapture = {
  state: CalculatorGoalsState;
  json: string;
  differsFrom(current: CalculatorGoalsState): boolean;
};

export function captureGoals(state: CalculatorGoalsState): GoalsCapture {
  const normalized = parseGoalsState(state);
  const json = JSON.stringify(normalized);
  return {
    state: normalized,
    json,
    differsFrom(current) {
      return JSON.stringify(parseGoalsState(current)) !== json;
    },
  };
}

export function goalsDiffersFromSnapshot(
  state: CalculatorGoalsState,
  savedJson: string,
): boolean {
  return JSON.stringify(parseGoalsState(state)) !== savedJson;
}
