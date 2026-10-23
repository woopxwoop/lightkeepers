import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AccountBuildGrade } from "./account-build-grade.ts";
import {
  appendAuditSuggestions,
  auditRowCanAddToPlanner,
  auditRowPlannerState,
  hasCharacterGoal,
  hasWeaponGoal,
  type AuditSuggestionRow,
} from "./audit-planner-goals.ts";
import {
  createCharacterGoal,
  createWeaponGoal,
  emptyGoalsState,
  MAX_CALCULATOR_GOALS,
} from "./calculator-goals.ts";
import type {
  CharacterOwned,
  InventoryWeapon,
  RosterProgress,
} from "./definitions.ts";
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
      {
        id: 11401,
        name: "Staff of Homa",
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

function needsWorkGrade(
  steps: AccountBuildGrade["adviceSteps"],
): AccountBuildGrade {
  return {
    bucket: "needs_work",
    complete: true,
    axes: { weapon: true, set: true, mains: true, progress: false },
    gaps: ["progress"],
    adviceSteps: steps,
    advice: [],
    aside: [],
    priority: 1,
    ungradedReason: null,
  };
}

function ownedHutao(weaponKey: string | null = null): CharacterOwned {
  return {
    name: "Hu Tao",
    name_id: "Hutao",
    isOwned: true,
    progress: {
      level: 70,
      ascension: 4,
      constellation: 0,
      talents: { normal: 6, skill: 6, burst: 6 },
      weapon: weaponKey
        ? {
            key: weaponKey,
            level: 70,
            ascension: 4,
            refinement: 1,
          }
        : null,
    },
  } as CharacterOwned;
}

function gradedProgress(
  weaponKey: string,
  level: number,
  ascension: number,
): RosterProgress {
  return {
    level: 70,
    ascension: 4,
    constellation: 0,
    talents: { normal: 6, skill: 6, burst: 6 },
    weapon: { key: weaponKey, level, ascension, refinement: 1 },
  };
}

function charRow(
  nameId: string,
  steps: AccountBuildGrade["adviceSteps"],
  weaponKey: string | null = null,
): AuditSuggestionRow {
  return {
    nameId,
    grade: needsWorkGrade(steps),
    weaponKey,
    builds: null,
  };
}

describe("audit-planner-goals", () => {
  it("adds a character goal when none exists", () => {
    const catalog = catalogWith(["Hutao"]);
    const row = charRow("Hutao", [{ kind: "level", current: 70, target: 90 }]);
    const result = appendAuditSuggestions(emptyGoalsState(), catalog, [row], {
      owned: [ownedHutao()],
      weapons: null,
    });
    assert.equal(result.added, 1);
    assert.equal(result.skipped, 0);
    assert.equal(result.state.goals.length, 1);
    assert.equal(result.state.goals[0]?.kind, "character");
    if (result.state.goals[0]?.kind === "character") {
      assert.equal(result.state.goals[0].name_id, "Hutao");
      assert.ok(
        result.state.goals[0].target.level > result.state.goals[0].start.level,
      );
    }
  });

  it("skips character when a goal already exists", () => {
    const catalog = catalogWith(["Hutao"]);
    const row = charRow("Hutao", [{ kind: "level", current: 70, target: 90 }]);
    const state = {
      ...emptyGoalsState(),
      goals: [createCharacterGoal("Hutao")],
    };
    assert.equal(hasCharacterGoal(state, "Hutao"), true);
    const result = appendAuditSuggestions(state, catalog, [row], {
      owned: [ownedHutao()],
      weapons: null,
    });
    assert.equal(result.added, 0);
    assert.equal(result.skipped, 1);
    assert.equal(result.state.goals.length, 1);
    assert.equal(result.state.goals[0]?.id, state.goals[0]?.id);
  });

  it("adds a weapon goal only when hard weapon advice exists", () => {
    const catalog = catalogWith(["Hutao"]);
    const noWeapon = appendAuditSuggestions(
      emptyGoalsState(),
      catalog,
      [
        charRow(
          "Hutao",
          [{ kind: "level", current: 70, target: 90 }],
          "StaffOfHoma",
        ),
      ],
      { owned: [ownedHutao("StaffOfHoma")], weapons: null },
    );
    assert.equal(noWeapon.added, 1);
    assert.equal(
      noWeapon.state.goals.filter((g) => g.kind === "weapon").length,
      0,
    );

    const withWeapon = appendAuditSuggestions(
      emptyGoalsState(),
      catalog,
      [
        {
          ...charRow(
            "Hutao",
            [
              { kind: "level", current: 70, target: 90 },
              { kind: "weapon_level", current: 70, target: 90 },
            ],
            "StaffOfHoma",
          ),
          progress: gradedProgress("StaffOfHoma", 70, 4),
        },
      ],
      { owned: [ownedHutao("StaffOfHoma")], weapons: null },
    );
    assert.equal(withWeapon.added, 2);
    const weaponGoal = withWeapon.state.goals.find((g) => g.kind === "weapon");
    assert.ok(weaponGoal);
    if (weaponGoal?.kind === "weapon") {
      assert.equal(weaponGoal.weapon_id, 11401);
      assert.equal(weaponGoal.start.level, 70);
      assert.equal(weaponGoal.start.ascension, 4);
      assert.equal(weaponGoal.target.level, 90);
    }
  });

  it("starts the weapon goal at the graded copy, not a lower spare", () => {
    const catalog = catalogWith(["Hutao"]);
    const spare: InventoryWeapon = {
      key: "StaffOfHoma",
      level: 1,
      ascension: 0,
      refinement: 1,
      location: "",
      lock: false,
    };
    const equipped: InventoryWeapon = {
      key: "StaffOfHoma",
      level: 80,
      ascension: 6,
      refinement: 1,
      location: "HuTao",
      lock: false,
    };
    const result = appendAuditSuggestions(
      emptyGoalsState(),
      catalog,
      [
        {
          ...charRow(
            "Hutao",
            [{ kind: "weapon_level", current: 80, target: 90 }],
            "StaffOfHoma",
          ),
          progress: gradedProgress("StaffOfHoma", 80, 6),
        },
      ],
      { owned: [ownedHutao("StaffOfHoma")], weapons: [equipped, spare] },
    );
    assert.equal(result.added, 1);
    const weaponGoal = result.state.goals.find((g) => g.kind === "weapon");
    assert.ok(weaponGoal);
    if (weaponGoal?.kind === "weapon") {
      assert.equal(weaponGoal.start.level, 80);
      assert.equal(weaponGoal.start.ascension, 6);
      assert.equal(weaponGoal.target.level, 90);
    }
  });

  it("skips weapon when a goal already exists for that id", () => {
    const catalog = catalogWith(["Hutao"]);
    const state = {
      ...emptyGoalsState(),
      goals: [createWeaponGoal(11401)],
    };
    assert.equal(hasWeaponGoal(state, 11401), true);
    const result = appendAuditSuggestions(
      state,
      catalog,
      [
        charRow(
          "Hutao",
          [{ kind: "weapon_ascension", current: 4, target: 6 }],
          "StaffOfHoma",
        ),
      ],
      { owned: [ownedHutao("StaffOfHoma")], weapons: null },
    );
    assert.equal(result.added, 0);
    assert.equal(result.skipped, 1);
    assert.equal(result.state.goals.length, 1);
  });

  it("batch add reports skip counts and never duplicates", () => {
    const catalog = catalogWith(["Hutao", "Xiangling"]);
    const state = {
      ...emptyGoalsState(),
      goals: [createCharacterGoal("Hutao")],
    };
    const rows = [
      charRow("Hutao", [{ kind: "skill", current: 6, target: 9 }]),
      charRow("Xiangling", [{ kind: "burst", current: 6, target: 9 }]),
      {
        ...charRow(
          "Hutao",
          [{ kind: "weapon_level", current: 70, target: 90 }],
          "StaffOfHoma",
        ),
        progress: gradedProgress("StaffOfHoma", 70, 4),
      },
    ];
    const result = appendAuditSuggestions(state, catalog, rows, {
      owned: [
        ownedHutao("StaffOfHoma"),
        {
          name: "Xiangling",
          name_id: "Xiangling",
          isOwned: true,
          progress: {
            level: 60,
            ascension: 3,
            constellation: 0,
            talents: { normal: 1, skill: 6, burst: 6 },
            weapon: null,
          },
        } as CharacterOwned,
      ],
      weapons: null,
    });
    assert.equal(result.added, 2);
    assert.equal(result.skipped, 1);
    assert.equal(
      result.state.goals.filter((g) => g.kind === "character").length,
      2,
    );
    assert.equal(
      result.state.goals.filter((g) => g.kind === "weapon").length,
      1,
    );
  });

  it("stops at MAX_CALCULATOR_GOALS", () => {
    const catalog = catalogWith(["Hutao", "Xiangling"]);
    const goals = Array.from({ length: MAX_CALCULATOR_GOALS }, (_, i) =>
      createCharacterGoal(`Pad${i}`),
    );
    const state = { ...emptyGoalsState(), goals };
    const result = appendAuditSuggestions(
      state,
      catalog,
      [charRow("Hutao", [{ kind: "level", current: 70, target: 90 }])],
      { owned: [ownedHutao()], weapons: null },
    );
    assert.equal(result.added, 0);
    assert.equal(result.state.goals.length, MAX_CALCULATOR_GOALS);
  });

  it("auditRowCanAddToPlanner reflects skip and advice gates", () => {
    const catalog = catalogWith(["Hutao"]);
    const row = charRow("Hutao", [{ kind: "level", current: 70, target: 90 }]);
    assert.equal(
      auditRowCanAddToPlanner(emptyGoalsState(), catalog, row),
      true,
    );
    const withGoal = {
      ...emptyGoalsState(),
      goals: [createCharacterGoal("Hutao")],
    };
    assert.equal(auditRowCanAddToPlanner(withGoal, catalog, row), false);
    const weaponOnly = charRow(
      "Hutao",
      [{ kind: "weapon_level", current: 70, target: 90 }],
      "StaffOfHoma",
    );
    assert.equal(auditRowCanAddToPlanner(withGoal, catalog, weaponOnly), true);
  });

  it("auditRowPlannerState distinguishes add / in planner / full / none", () => {
    const catalog = catalogWith(["Hutao"]);
    const row = charRow("Hutao", [{ kind: "level", current: 70, target: 90 }]);
    assert.equal(auditRowPlannerState(null, null, row), "add");
    assert.equal(auditRowPlannerState(emptyGoalsState(), catalog, row), "add");
    const withGoal = {
      ...emptyGoalsState(),
      goals: [createCharacterGoal("Hutao")],
    };
    assert.equal(auditRowPlannerState(withGoal, catalog, row), "in_planner");
    const full = {
      ...emptyGoalsState(),
      goals: Array.from({ length: MAX_CALCULATOR_GOALS }, (_, i) =>
        createCharacterGoal(`Pad${i}`),
      ),
    };
    assert.equal(auditRowPlannerState(full, catalog, row), "full");
    assert.equal(
      auditRowPlannerState(emptyGoalsState(), catalog, charRow("Hutao", [])),
      "none",
    );
  });
});
