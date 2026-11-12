/**
 * Goals merge: the most recent change wins, per goal (the save now = latest).
 *
 * Run: pnpm exec tsx --test src/lib/sync/goals-doc.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGoalsState } from "../calculator-goals.ts";
import type {
  CalculatorGoal,
  CalculatorGoalsState,
} from "../types/calculator-goals.ts";
import { mergeGoals } from "./goals-doc.ts";

const goal = (id: string, name_id = "Furina"): CalculatorGoal =>
  parseGoalsState({ goals: [{ id, kind: "character", name_id }] }).goals[0];

/** A visible edit: starring the goal. */
const edited = (g: CalculatorGoal): CalculatorGoal => ({ ...g, starred: true });

const list = (
  goals: CalculatorGoal[],
  selectedId: string | null = null,
): CalculatorGoalsState => parseGoalsState({ goals, selectedId });

function merged(
  base: CalculatorGoalsState | null,
  local: CalculatorGoalsState,
  remote: CalculatorGoalsState,
): CalculatorGoalsState {
  const result = mergeGoals(base, local, remote);
  assert.notEqual(result, "ask");
  return result as CalculatorGoalsState;
}

const ids = (state: CalculatorGoalsState) => state.goals.map((g) => g.id);

describe("mergeGoals", () => {
  const a = goal("a", "Furina");
  const b = goal("b", "Neuvillette");
  const c = goal("c", "Nahida");

  it("keeps changes each side made to different goals", () => {
    const base = list([a, b]);
    const result = merged(base, list([edited(a), b]), list([a, edited(b)]));
    assert.deepEqual(result.goals, [edited(a), edited(b)]);
  });

  it("keeps additions from both sides, local order first", () => {
    const base = list([a]);
    const result = merged(base, list([a, b]), list([a, c]));
    assert.deepEqual(ids(result), ["a", "b", "c"]);
  });

  it("the save now wins when both sides edited the same goal", () => {
    const mine = edited(a); // starred here
    const theirs = goal("a", "Nahida"); // character changed on the other device
    const result = merged(list([a]), list([mine]), list([theirs]));
    assert.deepEqual(result.goals, [mine]);
  });

  it("a removal on one side wins when the other side left the goal alone", () => {
    const base = list([a, b]);
    assert.deepEqual(ids(merged(base, list([a]), list([a, b]))), ["a"]);
    assert.deepEqual(ids(merged(base, list([a, b]), list([a]))), ["a"]);
  });

  it("removed here, edited there → stays removed (the save now is latest)", () => {
    const base = list([a, b]);
    const result = merged(base, list([a]), list([a, edited(b)]));
    assert.deepEqual(ids(result), ["a"]);
  });

  it("edited here, removed there → kept (the save now is latest)", () => {
    const base = list([a, b]);
    const result = merged(base, list([a, edited(b)]), list([a]));
    assert.deepEqual(result.goals, [a, edited(b)]);
  });

  it("with no base, takes the union and local wins on shared ids", () => {
    const result = merged(null, list([edited(a), b]), list([a, c]));
    assert.deepEqual(result.goals, [edited(a), b, c]);
  });

  it("keeps the local selection", () => {
    const base = list([a, b]);
    const result = merged(base, list([a, b], "b"), list([a, b], "a"));
    assert.equal(result.selectedId, "b");
  });
});
