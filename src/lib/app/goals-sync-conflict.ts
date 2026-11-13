/**
 * The goals over-cap question. The popup resolves it; dismiss leaves the
 * question open and uploads nothing.
 */

import { get, writable } from "svelte/store";
import type {
  CalculatorGoal,
  CalculatorGoalsState,
} from "#lib/types/calculator-goals.js";

export type GoalsSyncChoice = "keep-local" | "keep-remote" | "dismiss";

export type GoalsSyncConflict = {
  /** The other list is this device's newer saved copy, not the server's. */
  savedCopy: boolean;
  resolve: (choice: GoalsSyncChoice) => void;
};

export const goalsSyncConflict = writable<GoalsSyncConflict | null>(null);

/** A goal's label in the conflict popup. */
export function goalConflictLabel(goal: CalculatorGoal): string {
  return goal.kind === "character" ? goal.name_id : `Weapon ${goal.weapon_id}`;
}

/** Goals in `source` whose id is absent from `other`. */
export function goalsMissingFrom(
  source: CalculatorGoalsState,
  other: CalculatorGoalsState,
): string[] {
  const ids = new Set(other.goals.map((goal) => goal.id));
  return source.goals
    .filter((goal) => !ids.has(goal.id))
    .map(goalConflictLabel);
}

/** Show the conflict dialog and wait for the user's choice. */
export function promptGoalsSyncConflict(
  savedCopy: boolean,
): Promise<GoalsSyncChoice> {
  const previous = get(goalsSyncConflict);
  if (previous) previous.resolve("dismiss");

  return new Promise((resolve) => {
    const conflict: GoalsSyncConflict = {
      savedCopy,
      resolve: (choice) => {
        if (get(goalsSyncConflict) === conflict) goalsSyncConflict.set(null);
        resolve(choice);
      },
    };
    goalsSyncConflict.set(conflict);
  });
}

/** Close a pending conflict without choosing a list. */
export function cancelGoalsSyncConflict(): void {
  const pending = get(goalsSyncConflict);
  if (!pending) return;
  pending.resolve("dismiss");
}
