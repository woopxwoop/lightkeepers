import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  captureGoals,
  goalsDiffersFromSnapshot,
} from "./calculator-goals-snapshot.ts";
import { createCharacterGoal, emptyGoalsState } from "./calculator-goals.ts";
import type { CalculatorGoalsState } from "./types/calculator-goals.ts";

describe("calculator goals snapshot", () => {
  it("captureGoals freezes a clone independent of later edits", () => {
    const goal = createCharacterGoal("Hutao", { id: "a" });
    const state: CalculatorGoalsState = {
      ...emptyGoalsState(),
      goals: [goal],
      selectedId: "a",
    };
    const pending = captureGoals(state);

    goal.name_id = "Xingqiu";
    state.selectedId = null;

    const frozen = pending.state.goals[0];
    assert.ok(frozen && frozen.kind === "character");
    assert.equal(frozen.name_id, "Hutao");
    assert.equal(pending.state.selectedId, "a");
    assert.equal(pending.differsFrom(state), true);
    assert.equal(pending.differsFrom(pending.state), false);
  });

  it("goalsDiffersFromSnapshot compares against saved JSON", () => {
    const state: CalculatorGoalsState = {
      ...emptyGoalsState(),
      goals: [createCharacterGoal("Hutao", { id: "a" })],
      selectedId: "a",
    };
    const saved = captureGoals(state).json;
    assert.equal(goalsDiffersFromSnapshot(state, saved), false);
    assert.equal(
      goalsDiffersFromSnapshot(
        {
          ...state,
          goals: [createCharacterGoal("Xingqiu", { id: "a" })],
        },
        saved,
      ),
      true,
    );
  });
});
