/**
 * Labels for the goals over-cap conflict.
 *
 * Run: pnpm exec tsx --test src/lib/app/goals-sync-conflict.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createCharacterGoal,
  emptyGoalsState,
  parseGoalsState,
} from "../calculator-goals.ts";
import { goalConflictLabel, goalsMissingFrom } from "./goals-sync-conflict.ts";

const state = (...goals: Record<string, unknown>[]) =>
  parseGoalsState({ goals });

describe("goal conflict labels", () => {
  it("names a character by name_id and a weapon by catalog id", () => {
    const goals = state(
      { id: "c", kind: "character", name_id: "Furina" },
      { id: "w", kind: "weapon", weapon_id: 12 },
    );
    assert.deepEqual(goals.goals.map(goalConflictLabel), [
      "Furina",
      "Weapon 12",
    ]);
  });

  it("lists goals present on only one side", () => {
    const local = state(
      { id: "a", kind: "character", name_id: "Furina" },
      { id: "b", kind: "character", name_id: "Neuvillette" },
    );
    const remote = state(
      { id: "a", kind: "character", name_id: "Furina" },
      { id: "c", kind: "weapon", weapon_id: 3 },
    );
    assert.deepEqual(goalsMissingFrom(local, remote), ["Neuvillette"]);
    assert.deepEqual(goalsMissingFrom(remote, local), ["Weapon 3"]);
  });

  it("includes a shared goal whose fields changed", () => {
    const local = {
      ...emptyGoalsState(),
      goals: [
        createCharacterGoal("Furina", {
          id: "a",
          target: {
            level: 90,
            ascension: 6,
            talents: { normal: 8, skill: 8, burst: 8 },
          },
        }),
      ],
    };
    const remote = {
      ...emptyGoalsState(),
      goals: [createCharacterGoal("Furina", { id: "a" })],
    };
    assert.deepEqual(goalsMissingFrom(local, remote), ["Furina (edited)"]);
    assert.deepEqual(goalsMissingFrom(remote, local), ["Furina (edited)"]);
  });
});
