import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  characterExpBooks,
  formatCount,
  materialRows,
  scopedGoalCosts,
  weaponExpOres,
} from "./planner-cost-view.ts";
import {
  aggregateGoalCosts,
  costsForGoal,
  createCharacterGoal,
  createWeaponGoal,
  emptyAggregate,
} from "./calculator-goals.ts";
import type { UpgradeCostsCatalog } from "../types/upgrade-costs.ts";

const catalog: UpgradeCostsCatalog = {
  characters: [],
  weapons: [
    {
      id: 1,
      name: "Sword",
      rankLevel: 4,
      weaponPromoteId: 1,
      icon: "UI_Sword",
      promotes: [
        { promoteLevel: 0, mora: 0, unlockMaxLevel: 20, items: [] },
        {
          promoteLevel: 1,
          mora: 5000,
          unlockMaxLevel: 40,
          items: [{ id: 101, count: 3 }],
        },
      ],
    },
  ],
  materials: {
    "101": {
      id: 101,
      name: "Teachings",
      icon: "UI_101",
      rankLevel: 2,
      craftIntoId: 102,
    },
    "102": {
      id: 102,
      name: "Guide",
      icon: "UI_102",
      rankLevel: 3,
      sources: [{ kind: "domain", name: "Forsaken Rift", days: ["Mon"] }],
    },
  },
  curves: {
    avatarLevelExp: [],
    weaponLevelExpByRarity: {},
    avatarExpItems: [
      { id: 104001, count: 0, exp: 1000 },
      { id: 104003, count: 0, exp: 20000 },
    ],
    weaponExpItems: [
      { id: 104011, count: 0, exp: 400 },
      { id: 104013, count: 0, exp: 10000 },
    ],
  },
};

function weaponGoal(id: string, starred = false) {
  return createWeaponGoal(1, {
    id,
    ...(starred ? { starred: true } : {}),
    start: { level: 20, ascension: 0 },
    target: { level: 40, ascension: 1 },
  });
}

describe("planner cost view", () => {
  it("scopedGoalCosts sums the selected, starred, or all active goals", () => {
    const a = weaponGoal("a", true);
    const b = weaponGoal("b");
    const removed = weaponGoal("c");
    const goals = [a, b, removed];
    const pendingRemoveIds = new Set(["c"]);
    const base = { goals, starred: [a], pendingRemoveIds, catalog };

    assert.deepEqual(
      scopedGoalCosts({ ...base, scope: "selected", selectedGoal: b }),
      costsForGoal(b, catalog),
    );
    assert.deepEqual(
      scopedGoalCosts({ ...base, scope: "selected", selectedGoal: removed }),
      emptyAggregate(),
    );
    assert.deepEqual(
      scopedGoalCosts({ ...base, scope: "selected", selectedGoal: null }),
      emptyAggregate(),
    );
    assert.deepEqual(
      scopedGoalCosts({ ...base, scope: "starred", selectedGoal: null }),
      aggregateGoalCosts([a], catalog),
    );
    assert.deepEqual(
      scopedGoalCosts({ ...base, scope: "all", selectedGoal: null }),
      aggregateGoalCosts([a, b], catalog),
    );
  });

  it("characterExpBooks / weaponExpOres split EXP into items", () => {
    assert.deepEqual(characterExpBooks(0, catalog), []);
    assert.deepEqual(characterExpBooks(41500, catalog), [
      { id: 104003, count: 2 },
      { id: 104001, count: 2 },
    ]);
    assert.deepEqual(weaponExpOres(-1, catalog), []);
    assert.deepEqual(weaponExpOres(10100, catalog), [
      { id: 104013, count: 1 },
      { id: 104011, count: 1 },
    ]);
  });

  it("materialRows sorts by id, drops zeros, and fills missing meta", () => {
    assert.deepEqual(
      materialRows({ "999": 2, "102": 1, "5": 0 }, catalog, true),
      [
        {
          id: "102",
          count: 1,
          name: "Guide",
          icon: "UI_102",
          rankLevel: 3,
          sources: [{ kind: "domain", name: "Forsaken Rift", days: ["Mon"] }],
        },
        {
          id: "999",
          count: 2,
          name: "Material 999",
          icon: "UI_ItemIcon_999",
          rankLevel: 1,
          sources: [],
        },
      ],
    );
  });

  it("materialRows folds craft ranks only when collapsed", () => {
    const bag = { "101": 3, "102": 1 };
    assert.deepEqual(
      materialRows(bag, catalog, true).map((r) => [r.id, r.count]),
      [
        ["101", 3],
        ["102", 1],
      ],
    );
    assert.deepEqual(
      materialRows(bag, catalog, false).map((r) => [r.id, r.count]),
      [["101", 6]],
    );
  });

  it("formatCount groups thousands", () => {
    assert.equal(formatCount(1234567), "1,234,567");
  });
});
