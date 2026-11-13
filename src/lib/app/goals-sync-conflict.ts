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

/**
 * Goals in `source` that the other side does not have, plus shared goals
 * whose fields differ. Additions keep `goalConflictLabel`; edits say so.
 */
export function goalsMissingFrom(
  source: CalculatorGoalsState,
  other: CalculatorGoalsState,
): string[] {
  const otherById = new Map(other.goals.map((goal) => [goal.id, goal]));
  const labels: string[] = [];
  for (const goal of source.goals) {
    const theirs = otherById.get(goal.id);
    if (!theirs) {
      labels.push(goalConflictLabel(goal));
      continue;
    }
    if (JSON.stringify(goal) !== JSON.stringify(theirs)) {
      labels.push(`${goalConflictLabel(goal)} (edited)`);
    }
  }
  return labels;
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
