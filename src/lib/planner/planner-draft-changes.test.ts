import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countChangedGoals,
  parseSavedGoalsJson,
} from "./planner-draft-changes.ts";
import {
  createCharacterGoal,
  createWeaponGoal,
  emptyGoalsState,
} from "./calculator-goals.ts";
import type { CalculatorGoalsState } from "../types/calculator-goals.ts";

function stateWith(goals: CalculatorGoalsState["goals"]): CalculatorGoalsState {
  return { ...emptyGoalsState(), goals, selectedId: null };
}

describe("planner draft changes", () => {
  it("parseSavedGoalsJson returns null for empty or unreadable JSON", () => {
    assert.equal(parseSavedGoalsJson(""), null);
    assert.equal(parseSavedGoalsJson("{not json"), null);
    const saved = stateWith([createCharacterGoal("Hutao", { id: "a" })]);
    const parsed = parseSavedGoalsJson(JSON.stringify(saved));
    assert.deepEqual(
      parsed?.goals.map((g) => g.id),
      ["a"],
    );
  });

  it("counts nothing without a saved snapshot", () => {
    const state = stateWith([createCharacterGoal("Hutao", { id: "a" })]);
    assert.equal(
      countChangedGoals({
        state,
        savedJson: "",
        saved: null,
        pendingRemoveIds: new Set(),
      }),
      0,
    );
  });

  it("counts every current goal when the snapshot is unreadable", () => {
    const state = stateWith([
      createCharacterGoal("Hutao", { id: "a" }),
      createWeaponGoal(14501, { id: "b" }),
    ]);
    assert.equal(
      countChangedGoals({
        state,
        savedJson: "{not json",
        saved: null,
        pendingRemoveIds: new Set(),
      }),
      2,
    );
  });

  it("counts edits, additions, removals, and pending removes once each", () => {
    const kept = createCharacterGoal("Hutao", { id: "kept" });
    const edited = createCharacterGoal("Xingqiu", { id: "edited" });
    const pending = createWeaponGoal(14501, { id: "pending" });
    const dropped = createWeaponGoal(14502, { id: "dropped" });
    const savedState = stateWith([kept, edited, pending, dropped]);
    const savedJson = JSON.stringify(savedState);
    const saved = parseSavedGoalsJson(savedJson);

    const state = stateWith([
      kept,
      { ...edited, starred: true },
      pending,
      createCharacterGoal("Bennett", { id: "added" }),
    ]);
    assert.equal(
      countChangedGoals({
        state,
        savedJson,
        saved,
        pendingRemoveIds: new Set(["pending"]),
      }),
      4,
    );
    assert.equal(
      countChangedGoals({
        state: savedState,
        savedJson,
        saved,
        pendingRemoveIds: new Set(),
      }),
      0,
    );
  });
});
