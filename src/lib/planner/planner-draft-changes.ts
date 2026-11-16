import { parseGoalsState } from "#lib/planner/calculator-goals.js";
import type { CalculatorGoalsState } from "#lib/types/calculator-goals.js";

/** Last saved goals from the draft's snapshot JSON; null when unreadable. */
export function parseSavedGoalsJson(
  savedJson: string,
): CalculatorGoalsState | null {
  if (!savedJson) return null;
  try {
    return parseGoalsState(JSON.parse(savedJson) as unknown);
  } catch {
    return null;
  }
}

/**
 * Goals that differ from the saved snapshot: edited, added, removed, or
 * pending removal. An unreadable snapshot counts every current goal.
 */
export function countChangedGoals({
  state,
  savedJson,
  saved,
  pendingRemoveIds,
}: {
  state: CalculatorGoalsState;
  savedJson: string;
  saved: CalculatorGoalsState | null;
  pendingRemoveIds: ReadonlySet<string>;
}): number {
  if (!savedJson) return 0;
  if (!saved) return state.goals.length;
  const current = parseGoalsState(state).goals;
  const savedMap = new Map(saved.goals.map((g) => [g.id, g]));
  let n = 0;
  const seen = new Set<string>();
  for (const g of current) {
    seen.add(g.id);
    if (pendingRemoveIds.has(g.id)) {
      n += 1;
      continue;
    }
    const prev = savedMap.get(g.id);
    if (!prev || JSON.stringify(prev) !== JSON.stringify(g)) n += 1;
  }
  for (const id of savedMap.keys()) {
    if (!seen.has(id)) n += 1;
  }
  return n;
}
