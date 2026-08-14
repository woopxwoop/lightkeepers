import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createCharacterGoal,
  emptyGoalsState,
  parseGoalsState,
} from "./calculator-goals.ts";
import { captureGoals } from "./calculator-goals-snapshot.ts";
import {
  goalsHaveUnsavedChanges,
  goalsListDiffersFromSnapshot,
  goalsWithoutPendingRemoves,
} from "./calculator-goals-lifecycle.ts";

describe("calculator goals lifecycle", () => {
  it("strips pending removes before save", () => {
    const state = parseGoalsState({
      goals: [
        createCharacterGoal("Hutao", { id: "a" }),
        createCharacterGoal("Xingqiu", { id: "b" }),
      ],
      selectedId: "a",
    });
    const next = goalsWithoutPendingRemoves(state, new Set(["b"]));
    assert.deepEqual(
      next.goals.map((g) => g.id),
      ["a"],
    );
    assert.equal(next.selectedId, "a");
  });

  it("treats selectedId-only edits as clean", () => {
    const base = emptyGoalsState();
    const withGoal = {
      ...base,
      goals: [createCharacterGoal("Hutao", { id: "a" })],
      selectedId: "a",
    };
    const saved = captureGoals(withGoal).json;
    const reselected = { ...withGoal, selectedId: null };
    assert.equal(goalsListDiffersFromSnapshot(reselected, saved), false);
    assert.equal(
      goalsHaveUnsavedChanges({
        hydrated: true,
        state: reselected,
        savedSnapshot: saved,
        pendingRemoveIds: new Set(),
      }),
      false,
    );
    assert.equal(
      goalsHaveUnsavedChanges({
        hydrated: true,
        state: withGoal,
        savedSnapshot: saved,
        pendingRemoveIds: new Set(["a"]),
      }),
      true,
    );
  });
});
