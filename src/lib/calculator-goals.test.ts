import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_CALCULATOR_GOALS,
  MAX_GOAL_ID_LENGTH,
  addCharacterResult,
  addWeaponResult,
  appendGoal,
  applyCloudGoals,
  createCharacterGoal,
  createWeaponGoal,
  emptyAggregate,
  emptyGoalsState,
  moveGoal,
  parseGoalsState,
  removeGoal,
  replaceGoal,
  starredGoals,
  toggleGoalStarred,
} from "./calculator-goals.ts";

describe("calculator goals", () => {
  it("parseGoalsState drops invalid entries and caps selection", () => {
    const state = parseGoalsState({
      version: 1,
      selectedId: "keep",
      goals: [
        {
          id: "keep",
          kind: "character",
          name_id: "Hutao",
          start: {
            level: 1,
            ascension: 0,
            talents: { normal: 1, skill: 1, burst: 1 },
          },
          target: {
            level: 90,
            ascension: 6,
            talents: { normal: 9, skill: 9, burst: 9 },
          },
        },
        { id: "bad", kind: "character" },
        {
          id: "w1",
          kind: "weapon",
          weapon_id: 14501,
          start: { level: 1, ascension: 0 },
          target: { level: 90, ascension: 6 },
        },
        {
          id: "w-string",
          kind: "weapon",
          weapon_id: "14502",
          start: { level: 1, ascension: 0 },
          target: { level: 90, ascension: 6 },
        },
        {
          id: "w-neg",
          kind: "weapon",
          weapon_id: -1,
          start: { level: 1, ascension: 0 },
          target: { level: 90, ascension: 6 },
        },
        {
          id: "w-zero",
          kind: "weapon",
          weapon_id: 0,
          start: { level: 1, ascension: 0 },
          target: { level: 90, ascension: 6 },
        },
        {
          id: "w-frac",
          kind: "weapon",
          weapon_id: 14.5,
          start: { level: 1, ascension: 0 },
          target: { level: 90, ascension: 6 },
        },
        {
          id: "a".repeat(MAX_GOAL_ID_LENGTH + 1),
          kind: "character",
          name_id: "Xingqiu",
          start: {
            level: 1,
            ascension: 0,
            talents: { normal: 1, skill: 1, burst: 1 },
          },
          target: {
            level: 90,
            ascension: 6,
            talents: { normal: 9, skill: 9, burst: 9 },
          },
        },
        {
          id: "keep",
          kind: "character",
          name_id: "Xingqiu",
          start: {
            level: 1,
            ascension: 0,
            talents: { normal: 1, skill: 1, burst: 1 },
          },
          target: {
            level: 90,
            ascension: 6,
            talents: { normal: 9, skill: 9, burst: 9 },
          },
        },
      ],
    });
    assert.equal(state.goals.length, 3);
    assert.equal(state.selectedId, "keep");
    assert.equal(state.goals[1]?.kind, "weapon");
    assert.equal(state.goals[2]?.kind, "weapon");
    if (state.goals[2]?.kind === "weapon") {
      assert.equal(state.goals[2].weapon_id, 14502);
    }
  });

  it("applyCloudGoals keeps local selectedId when still present", () => {
    const local = parseGoalsState({
      goals: [createCharacterGoal("Hutao", { id: "a" })],
      selectedId: "a",
    });
    const cloud = [
      createCharacterGoal("Xingqiu", { id: "b" }),
      createCharacterGoal("Hutao", { id: "a" }),
    ];
    const next = applyCloudGoals(local, cloud);
    assert.equal(next.goals.length, 2);
    assert.equal(next.selectedId, "a");
  });

  it("applyCloudGoals falls back when selectedId missing in cloud", () => {
    const local = parseGoalsState({
      goals: [createCharacterGoal("Hutao", { id: "a" })],
      selectedId: "a",
    });
    const cloud = [createWeaponGoal(14501, { id: "w" })];
    const next = applyCloudGoals(local, cloud);
    assert.equal(next.selectedId, "w");
  });

  it("append / replace / remove maintain selectedId", () => {
    let state = emptyGoalsState();
    const g1 = createCharacterGoal("Hutao", { id: "a" });
    const g2 = createWeaponGoal(14501, { id: "b" });
    state = appendGoal(state, g1);
    assert.equal(state.selectedId, "a");
    state = appendGoal(state, g2);
    assert.equal(state.selectedId, "b");
    state = replaceGoal(state, {
      ...g2,
      target: { level: 70, ascension: 4 },
    });
    assert.equal(state.goals[1]?.kind, "weapon");
    if (state.goals[1]?.kind === "weapon") {
      assert.equal(state.goals[1].target.level, 70);
    }
    state = removeGoal(state, "b");
    assert.equal(state.goals.length, 1);
    assert.equal(state.selectedId, "a");
  });

  it("moveGoal reorders and ignores invalid indices", () => {
    let state = emptyGoalsState();
    state = appendGoal(state, createCharacterGoal("Hutao", { id: "a" }));
    state = appendGoal(state, createWeaponGoal(14501, { id: "b" }));
    state = appendGoal(state, createCharacterGoal("Xingqiu", { id: "c" }));
    state = moveGoal(state, 2, 0);
    assert.deepEqual(
      state.goals.map((g) => g.id),
      ["c", "a", "b"],
    );
    assert.equal(state.selectedId, "c");
    const same = moveGoal(state, 1, 1);
    assert.equal(same, state);
    assert.deepEqual(
      moveGoal(state, -1, 0).goals.map((g) => g.id),
      ["c", "a", "b"],
    );
  });

  it("append respects max goals", () => {
    let state = emptyGoalsState();
    for (let i = 0; i < MAX_CALCULATOR_GOALS; i++) {
      state = appendGoal(state, createCharacterGoal("Hutao", { id: `g${i}` }));
    }
    const before = state.goals.length;
    state = appendGoal(state, createCharacterGoal("Hutao", { id: "overflow" }));
    assert.equal(state.goals.length, before);
    assert.equal(state.goals.length, MAX_CALCULATOR_GOALS);
  });

  it("aggregates character and weapon EXP separately", () => {
    const agg = emptyAggregate();
    addCharacterResult(agg, { mora: 10, exp: 100, materials: { "1": 2 } });
    addWeaponResult(agg, { mora: 5, exp: 50, materials: { "1": 3, "2": 1 } });
    assert.equal(agg.mora, 15);
    assert.equal(agg.characterExp, 100);
    assert.equal(agg.weaponExp, 50);
    assert.deepEqual(agg.materials, { "1": 5, "2": 1 });
  });

  it("keeps starred flags and filters starredGoals", () => {
    const starred = createCharacterGoal("Hutao", { id: "a", starred: true });
    const plain = createWeaponGoal(14501, { id: "b" });
    const state = parseGoalsState({
      goals: [starred, { ...plain, starred: false }],
      selectedId: "a",
    });
    assert.equal(state.goals[0]?.starred, true);
    assert.equal(state.goals[1]?.starred, undefined);
    assert.deepEqual(
      starredGoals(state.goals).map((g) => g.id),
      ["a"],
    );

    const off = toggleGoalStarred(starred);
    assert.equal(off.starred, undefined);
    const on = toggleGoalStarred(plain);
    assert.equal(on.starred, true);
  });
});
