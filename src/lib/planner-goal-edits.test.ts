import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createCharacterGoal,
  emptyGoalsState,
  MAX_CALCULATOR_GOALS,
} from "./calculator-goals.ts";
import {
  appendCatalogCharacterGoal,
  appendCatalogWeaponGoal,
  plannerCharacterOptions,
  resolveCatalogCharacterId,
} from "./planner-goal-edits.ts";
import type { UpgradeCostsCatalog } from "./types/upgrade-costs.ts";

function catalogWith(ids: string[]): UpgradeCostsCatalog {
  const emptyTrack = {
    proudSkillGroupId: 0,
    levels: [] as { level: number; mora: number; items: never[] }[],
  };
  const promotes = [
    { promoteLevel: 0, mora: 0, unlockMaxLevel: 20, items: [] },
    {
      promoteLevel: 1,
      mora: 1000,
      unlockMaxLevel: 40,
      items: [] as { id: number; count: number }[],
    },
    { promoteLevel: 2, mora: 2000, unlockMaxLevel: 50, items: [] },
    { promoteLevel: 3, mora: 3000, unlockMaxLevel: 60, items: [] },
    { promoteLevel: 4, mora: 4000, unlockMaxLevel: 70, items: [] },
    { promoteLevel: 5, mora: 5000, unlockMaxLevel: 80, items: [] },
    { promoteLevel: 6, mora: 6000, unlockMaxLevel: 90, items: [] },
  ];
  return {
    characters: ids.map((name_id) => ({
      name_id,
      game_id: 1,
      name: name_id,
      element: "Pyro",
      avatarPromoteId: 1,
      promotes,
      talents: {
        normal: emptyTrack,
        skill: emptyTrack,
        burst: emptyTrack,
      },
    })),
    weapons: [
      {
        id: 14501,
        name: "A Thousand Floating Dreams",
        rankLevel: 5,
        weaponPromoteId: 1,
        icon: "",
        promotes,
      },
    ],
    materials: {},
    curves: {
      avatarLevelExp: [],
      weaponLevelExpByRarity: {},
      avatarExpItems: [],
      weaponExpItems: [],
    },
  };
}

describe("planner goal edits", () => {
  it("maps bare Traveler ids onto an elemental kit", () => {
    const catalog = catalogWith(["Hutao", "PlayerBoy-Pyro"]);
    assert.equal(resolveCatalogCharacterId(catalog, "Hutao"), "Hutao");
    assert.equal(
      resolveCatalogCharacterId(catalog, "PlayerBoy"),
      "PlayerBoy-Pyro",
    );
    assert.equal(resolveCatalogCharacterId(catalog, "Missing"), undefined);
  });

  it("stars a character added from the itinerary", () => {
    const catalog = catalogWith(["Hutao"]);
    const result = appendCatalogCharacterGoal(
      emptyGoalsState(),
      catalog,
      "Hutao",
      { owned: [], weapons: null, starred: true },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.goal.kind, "character");
    if (result.goal.kind !== "character") return;
    assert.equal(result.goal.name_id, "Hutao");
    assert.equal(result.goal.starred, true);
  });

  it("lifts target above GOOD start when start is past the default goal", () => {
    const catalog = catalogWith(["Hutao"]);
    const result = appendCatalogCharacterGoal(
      emptyGoalsState(),
      catalog,
      "Hutao",
      {
        owned: [
          {
            name: "Hu Tao",
            name_id: "Hutao",
            isOwned: true,
            progress: {
              level: 80,
              ascension: 5,
              constellation: 0,
              talents: { normal: 6, skill: 8, burst: 8 },
              weapon: null,
            },
          },
        ],
        weapons: null,
      },
    );
    assert.equal(result.ok, true);
    if (!result.ok || result.goal.kind !== "character") return;
    assert.equal(result.goal.start.level, 80);
    assert.equal(result.goal.start.ascension, 5);
    assert.ok(result.goal.target.level > result.goal.start.level);
    assert.ok(result.goal.target.ascension >= result.goal.start.ascension);
  });

  it("lifts weapon target above GOOD start", () => {
    const catalog = catalogWith([]);
    const result = appendCatalogWeaponGoal(emptyGoalsState(), catalog, 14501, {
      owned: [],
      weapons: [
        {
          key: "AThousandFloatingDreams",
          level: 70,
          ascension: 5,
          refinement: 1,
          location: "",
          lock: false,
        },
      ],
    });
    assert.equal(result.ok, true);
    if (!result.ok || result.goal.kind !== "weapon") return;
    assert.equal(result.goal.start.level, 70);
    assert.ok(
      result.goal.target.level > result.goal.start.level ||
        result.goal.target.ascension > result.goal.start.ascension,
    );
  });

  it("stars a weapon added from the itinerary", () => {
    const catalog = catalogWith([]);
    const result = appendCatalogWeaponGoal(
      emptyGoalsState(),
      catalog,
      14501,
      { owned: [], weapons: null, starred: true },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.goal.kind, "weapon");
    assert.equal(result.goal.starred, true);
  });

  it("rejects characters missing from the catalog", () => {
    const catalog = catalogWith(["Hutao"]);
    const result = appendCatalogCharacterGoal(
      emptyGoalsState(),
      catalog,
      "Missing",
      { owned: [], weapons: null },
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /catalog/i);
  });

  it("puts owned characters first when asked", () => {
    const catalog = catalogWith(["Xingqiu", "Hutao"]);
    const owned = plannerCharacterOptions(
      catalog,
      new Set(["Hutao"]),
      true,
    );
    assert.deepEqual(
      owned.map((o) => o.value),
      ["Hutao", "Xingqiu"],
    );
    const natural = plannerCharacterOptions(
      catalog,
      new Set(["Hutao"]),
      false,
    );
    assert.deepEqual(
      natural.map((o) => o.value),
      ["Xingqiu", "Hutao"],
    );
  });

  it("respects the goal cap", () => {
    const catalog = catalogWith(["Hutao"]);
    let state = emptyGoalsState();
    for (let i = 0; i < MAX_CALCULATOR_GOALS; i += 1) {
      state = {
        ...state,
        goals: [...state.goals, createCharacterGoal("Hutao", { id: `g${i}` })],
      };
    }
    const result = appendCatalogCharacterGoal(state, catalog, "Hutao", {
      owned: [],
      weapons: null,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /at most/);
  });
});
