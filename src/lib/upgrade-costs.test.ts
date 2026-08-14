import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  CharacterUpgradeCosts,
  UpgradeCostsCatalog,
  UpgradeCurves,
  UpgradePromoteStep,
  UpgradeTalentTrack,
  WeaponUpgradeCosts,
} from "./types/upgrade-costs.ts";
import {
  diffCharacterUpgrade,
  diffWeaponUpgrade,
  expItemsNeeded,
  gateCharacterConfig,
  gateWeaponConfig,
  orderCharacterConfigs,
  orderWeaponConfigs,
  formatMaterialSourceLine,
  collapseCraftRanks,
  craftRanksCanExpand,
  maxTalentForAscension,
  minAscensionForTalent,
  minAscensionForLevel,
  minLevelForAscension,
  sumLevelExp,
  UPGRADE_DEFAULTS,
} from "./upgrade-costs.ts";

/** Standard 20/40/50/60/70/80/90 unlock table. */
const STANDARD_PROMOTES: UpgradePromoteStep[] = [
  { promoteLevel: 0, mora: 0, unlockMaxLevel: 20, items: [] },
  {
    promoteLevel: 1,
    mora: 1000,
    unlockMaxLevel: 40,
    items: [{ id: 11, count: 1 }],
  },
  {
    promoteLevel: 2,
    mora: 2000,
    unlockMaxLevel: 50,
    items: [{ id: 11, count: 2 }],
  },
  {
    promoteLevel: 3,
    mora: 3000,
    unlockMaxLevel: 60,
    items: [{ id: 11, count: 3 }],
  },
  {
    promoteLevel: 4,
    mora: 4000,
    unlockMaxLevel: 70,
    items: [{ id: 11, count: 4 }],
  },
  {
    promoteLevel: 5,
    mora: 5000,
    unlockMaxLevel: 80,
    items: [{ id: 11, count: 5 }],
  },
  {
    promoteLevel: 6,
    mora: 6000,
    unlockMaxLevel: 90,
    items: [{ id: 11, count: 6 }],
  },
];

function talentTrack(): UpgradeTalentTrack {
  return {
    proudSkillGroupId: 1,
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      mora: (i + 1) * 100,
      items: i === 0 ? [] : [{ id: 22, count: 1 }],
    })),
  };
}

const character: CharacterUpgradeCosts = {
  name_id: "TestChar",
  game_id: 1,
  name: "Test",
  element: "Pyro",
  avatarPromoteId: 1,
  promotes: STANDARD_PROMOTES,
  talents: {
    normal: talentTrack(),
    skill: talentTrack(),
    burst: talentTrack(),
  },
};

const weapon: WeaponUpgradeCosts = {
  id: 14501,
  name: "Test Spear",
  rankLevel: 5,
  weaponPromoteId: 1,
  icon: "x",
  promotes: STANDARD_PROMOTES,
};

/** Index = current level; 1→90 walks indices 1..89. */
const LEVEL_EXP = 1_000;
const avatarLevelExp = Array.from({ length: 91 }, (_, level) =>
  level >= 1 && level < 90 ? LEVEL_EXP : 0,
);

const curves: UpgradeCurves = {
  avatarLevelExp,
  weaponLevelExpByRarity: { "5": avatarLevelExp },
  avatarExpItems: [],
  weaponExpItems: [],
};

describe("upgrade-costs math", () => {
  it("sums level EXP across the half-open range", () => {
    assert.equal(sumLevelExp(avatarLevelExp, 1, 90), 89 * LEVEL_EXP);
    assert.equal(sumLevelExp(avatarLevelExp, 1, 1), 0);
    assert.equal(sumLevelExp([0, 10, 20, 30], 1, 4), 60);
  });

  it("character 1/0 + 1/1/1 → 90/6 + 9/9/9 adds exp, mora, and materials", () => {
    const result = diffCharacterUpgrade(
      character,
      curves,
      UPGRADE_DEFAULTS.characterStart,
      {
        level: 90,
        ascension: 6,
        talents: { normal: 9, skill: 9, burst: 9 },
      },
    );

    assert.equal(result.exp, 89 * LEVEL_EXP);
    // Promotes 1–6: 1000+…+6000; talents 2–9 × 3 tracks: 4400×3.
    assert.equal(result.mora, 21_000 + 13_200);
    assert.equal(result.materials["11"], 21);
    assert.equal(result.materials["22"], 24);
  });

  it("identical start/target yields zero", () => {
    const cfg = {
      level: 70,
      ascension: 4,
      talents: { normal: 6, skill: 6, burst: 6 },
    };
    const result = diffCharacterUpgrade(character, curves, cfg, cfg);
    assert.deepEqual(result, { mora: 0, exp: 0, materials: {} });
  });

  it("diffs a 5★ weapon 1→90", () => {
    const result = diffWeaponUpgrade(
      weapon,
      curves,
      UPGRADE_DEFAULTS.weaponStart,
      UPGRADE_DEFAULTS.weaponTarget,
    );
    assert.equal(result.exp, 89 * LEVEL_EXP);
    assert.equal(result.mora, 21_000);
    assert.equal(result.materials["11"], 21);
  });

  it("greedy EXP books cover the total", () => {
    const books = [
      { id: 104003, exp: 20_000 },
      { id: 104002, exp: 5_000 },
      { id: 104001, exp: 1_000 },
    ];
    const needed = expItemsNeeded(53_000, books);
    const covered = needed.reduce((sum, n) => {
      const book = books.find((b) => b.id === n.id)!;
      return sum + book.exp * n.count;
    }, 0);
    assert.ok(covered >= 53_000);
  });

  it("skips non-positive exp items before greedy fill", () => {
    const needed = expItemsNeeded(1_000, [
      { id: 1, exp: 0 },
      { id: 2, exp: -100 },
      { id: 3, exp: 400 },
    ]);
    assert.deepEqual(needed, [{ id: 3, count: 3 }]);
  });

  it("gates talent caps by ascension", () => {
    assert.equal(maxTalentForAscension(0), 1);
    assert.equal(maxTalentForAscension(2), 2);
    assert.equal(maxTalentForAscension(4), 6);
    assert.equal(maxTalentForAscension(6), 10);
    assert.equal(minAscensionForTalent(9), 6);
    assert.equal(minAscensionForTalent(2), 2);
  });

  it("gates level floors by ascension", () => {
    assert.equal(minLevelForAscension(STANDARD_PROMOTES, 0), 1);
    assert.equal(minLevelForAscension(STANDARD_PROMOTES, 1), 20);
    assert.equal(minLevelForAscension(STANDARD_PROMOTES, 2), 40);
    assert.equal(minLevelForAscension(STANDARD_PROMOTES, 6), 80);
    assert.equal(minAscensionForLevel([], 50), 0);
    assert.equal(minAscensionForLevel(STANDARD_PROMOTES, 1), 0);
  });

  it("gateCharacterConfig clamps level/talents and raises ascension", () => {
    const clamped = gateCharacterConfig(
      {
        level: 90,
        ascension: 0,
        talents: { normal: 9, skill: 1, burst: 1 },
      },
      STANDARD_PROMOTES,
    );
    assert.equal(clamped.ascension, 6);
    assert.equal(clamped.level, 90);
    assert.equal(clamped.talents.normal, 9);

    const lowered = gateCharacterConfig(
      {
        level: 90,
        ascension: 2,
        talents: { normal: 10, skill: 10, burst: 10 },
      },
      STANDARD_PROMOTES,
    );
    assert.equal(lowered.ascension, 6);
    assert.equal(lowered.talents.normal, 10);

    const ascOnly = gateCharacterConfig(
      {
        level: 50,
        ascension: 2,
        talents: { normal: 10, skill: 1, burst: 1 },
      },
      STANDARD_PROMOTES,
    );
    assert.equal(ascOnly.ascension, 6);
    assert.equal(ascOnly.level, 80);
    assert.equal(ascOnly.talents.normal, 10);

    const downAsc = gateCharacterConfig(
      {
        level: 80,
        ascension: 2,
        talents: { normal: 6, skill: 1, burst: 1 },
      },
      STANDARD_PROMOTES,
      { preferAscension: true },
    );
    assert.equal(downAsc.ascension, 2);
    assert.equal(downAsc.level, 50);
    assert.equal(downAsc.talents.normal, 2);

    const upAscFloor = gateCharacterConfig(
      {
        level: 1,
        ascension: 6,
        talents: { normal: 1, skill: 1, burst: 1 },
      },
      STANDARD_PROMOTES,
      { preferAscension: true },
    );
    assert.equal(upAscFloor.ascension, 6);
    assert.equal(upAscFloor.level, 80);

    const preferLevelDown = gateCharacterConfig(
      {
        level: 50,
        ascension: 6,
        talents: { normal: 10, skill: 1, burst: 1 },
      },
      STANDARD_PROMOTES,
      { preferLevel: true },
    );
    assert.equal(preferLevelDown.ascension, 2);
    assert.equal(preferLevelDown.level, 50);
    assert.equal(preferLevelDown.talents.normal, 2);

    const preferLevelUp = gateCharacterConfig(
      {
        level: 90,
        ascension: 0,
        talents: { normal: 1, skill: 1, burst: 1 },
      },
      STANDARD_PROMOTES,
      { preferLevel: true },
    );
    assert.equal(preferLevelUp.ascension, 6);
    assert.equal(preferLevelUp.level, 90);
  });

  it("gateWeaponConfig clamps level to ascension", () => {
    const gated = gateWeaponConfig(
      { level: 90, ascension: 1 },
      STANDARD_PROMOTES,
    );
    assert.equal(gated.ascension, 6);
    assert.equal(gated.level, 90);

    const low = gateWeaponConfig(
      { level: 45, ascension: 1 },
      STANDARD_PROMOTES,
    );
    assert.equal(low.ascension, 2);
    assert.equal(low.level, 45);

    const forceDown = gateWeaponConfig(
      { level: 90, ascension: 1 },
      STANDARD_PROMOTES,
      { preferAscension: true },
    );
    assert.equal(forceDown.ascension, 1);
    assert.equal(forceDown.level, 40);

    const preferLevel = gateWeaponConfig(
      { level: 45, ascension: 6 },
      STANDARD_PROMOTES,
      { preferLevel: true },
    );
    assert.equal(preferLevel.ascension, 2);
    assert.equal(preferLevel.level, 45);
  });

  it("orderCharacterConfigs lifts target and raises ascension for level/talents", () => {
    const { start, target } = orderCharacterConfigs(
      {
        level: 50,
        ascension: 2,
        talents: { normal: 8, skill: 1, burst: 1 },
      },
      {
        level: 20,
        ascension: 0,
        talents: { normal: 1, skill: 1, burst: 1 },
      },
      STANDARD_PROMOTES,
    );
    assert.equal(start.ascension, 5);
    assert.equal(start.level, 70);
    assert.equal(start.talents.normal, 8);
    assert.equal(target.ascension, 5);
    assert.equal(target.level, 70);
    assert.equal(target.talents.normal, 8);

    const raised = orderCharacterConfigs(
      {
        level: 1,
        ascension: 0,
        talents: { normal: 1, skill: 1, burst: 1 },
      },
      {
        level: 90,
        ascension: 0,
        talents: { normal: 10, skill: 1, burst: 1 },
      },
      STANDARD_PROMOTES,
    );
    assert.equal(raised.target.ascension, 6);
    assert.equal(raised.target.level, 90);
    assert.equal(raised.target.talents.normal, 10);

    const levelDrivesAscension = orderCharacterConfigs(
      {
        level: 1,
        ascension: 0,
        talents: { normal: 1, skill: 1, burst: 1 },
      },
      {
        level: 50,
        ascension: 6,
        talents: { normal: 10, skill: 1, burst: 1 },
      },
      STANDARD_PROMOTES,
      { preferTargetLevel: true },
    );
    assert.equal(levelDrivesAscension.target.ascension, 2);
    assert.equal(levelDrivesAscension.target.level, 50);
    assert.equal(levelDrivesAscension.target.talents.normal, 2);

    const ascensionDrivesLevel = orderCharacterConfigs(
      {
        level: 1,
        ascension: 0,
        talents: { normal: 1, skill: 1, burst: 1 },
      },
      {
        level: 1,
        ascension: 6,
        talents: { normal: 1, skill: 1, burst: 1 },
      },
      STANDARD_PROMOTES,
      { preferTargetAscension: true },
    );
    assert.equal(ascensionDrivesLevel.target.ascension, 6);
    assert.equal(ascensionDrivesLevel.target.level, 80);

    const preferStartLevel = orderCharacterConfigs(
      {
        level: 45,
        ascension: 6,
        talents: { normal: 1, skill: 1, burst: 1 },
      },
      {
        level: 20,
        ascension: 0,
        talents: { normal: 1, skill: 1, burst: 1 },
      },
      STANDARD_PROMOTES,
      { preferStartLevel: true },
    );
    assert.equal(preferStartLevel.start.level, 45);
    assert.equal(preferStartLevel.start.ascension, 2);
    assert.equal(preferStartLevel.target.level, 45);
    assert.equal(preferStartLevel.target.ascension, 2);

    const preferStartAscension = orderCharacterConfigs(
      {
        level: 90,
        ascension: 2,
        talents: { normal: 1, skill: 1, burst: 1 },
      },
      {
        level: 90,
        ascension: 6,
        talents: { normal: 1, skill: 1, burst: 1 },
      },
      STANDARD_PROMOTES,
      { preferStartAscension: true },
    );
    assert.equal(preferStartAscension.start.level, 50);
    assert.equal(preferStartAscension.start.ascension, 2);
    assert.equal(preferStartAscension.target.level, 90);
    assert.equal(preferStartAscension.target.ascension, 6);
  });

  it("orderWeaponConfigs lifts target level and raises ascension", () => {
    const { start, target } = orderWeaponConfigs(
      { level: 80, ascension: 1 },
      { level: 40, ascension: 0 },
      STANDARD_PROMOTES,
    );
    assert.equal(start.ascension, 5);
    assert.equal(start.level, 80);
    assert.equal(target.ascension, 5);
    assert.equal(target.level, 80);

    const preferStartLevel = orderWeaponConfigs(
      { level: 45, ascension: 6 },
      { level: 20, ascension: 0 },
      STANDARD_PROMOTES,
      { preferStartLevel: true },
    );
    assert.equal(preferStartLevel.start.level, 45);
    assert.equal(preferStartLevel.start.ascension, 2);
    assert.equal(preferStartLevel.target.level, 45);
    assert.equal(preferStartLevel.target.ascension, 2);
  });
});

describe("formatMaterialSourceLine", () => {
  it("appends domain weekdays", () => {
    assert.equal(
      formatMaterialSourceLine({
        kind: "domain",
        name: "Forsaken Rift",
        days: ["Mon", "Thu", "Sun"],
      }),
      "Forsaken Rift · Mon/Thu/Sun",
    );
  });

  it("is just the name for bosses", () => {
    assert.equal(
      formatMaterialSourceLine({ kind: "boss", name: "Primo Geovishap" }),
      "Primo Geovishap",
    );
  });
});

describe("collapseCraftRanks", () => {
  const catalog: UpgradeCostsCatalog = {
    curves: {
      avatarLevelExp: [],
      weaponLevelExpByRarity: {},
      avatarExpItems: [],
      weaponExpItems: [],
    },
    characters: [],
    weapons: [],
    materials: {
      "1": {
        id: 1,
        name: "Teachings",
        icon: "a",
        rankLevel: 2,
        craftIntoId: 2,
      },
      "2": {
        id: 2,
        name: "Guide",
        icon: "b",
        rankLevel: 3,
        craftIntoId: 3,
      },
      "3": {
        id: 3,
        name: "Philosophies",
        icon: "c",
        rankLevel: 4,
      },
      "11": {
        id: 11,
        name: "Sliver",
        icon: "d",
        rankLevel: 2,
        craftIntoId: 12,
      },
      "12": {
        id: 12,
        name: "Fragment",
        icon: "e",
        rankLevel: 3,
        craftIntoId: 13,
      },
      "13": {
        id: 13,
        name: "Chunk",
        icon: "f",
        rankLevel: 4,
        craftIntoId: 14,
      },
      "14": {
        id: 14,
        name: "Gemstone",
        icon: "g",
        rankLevel: 5,
      },
      "99": { id: 99, name: "Boss drop", icon: "h", rankLevel: 4 },
      "21": {
        id: 21,
        name: "Slime Condensate",
        icon: "i",
        rankLevel: 1,
        craftIntoId: 22,
      },
      "22": {
        id: 22,
        name: "Slime Secretions",
        icon: "j",
        rankLevel: 2,
        craftIntoId: 23,
      },
      "23": {
        id: 23,
        name: "Slime Concentrate",
        icon: "k",
        rankLevel: 3,
      },
    },
  };

  it("leaves a lone lowest rank unchanged", () => {
    assert.deepEqual(collapseCraftRanks({ "1": 2, "99": 4 }, catalog), {
      "1": 2,
      "99": 4,
    });
  });

  it("folds philosophies into teachings when the plan uses teachings", () => {
    assert.deepEqual(
      collapseCraftRanks({ "1": 3, "2": 0, "3": 1, "99": 2 }, catalog),
      { "1": 12, "99": 2 },
    );
  });

  it("stops at the lowest rank the bag actually needs", () => {
    assert.deepEqual(collapseCraftRanks({ "1": 6, "2": 1 }, catalog), {
      "1": 9,
    });
    assert.deepEqual(collapseCraftRanks({ "2": 1 }, catalog), { "2": 1 });
  });

  it("folds gems down to sliver", () => {
    assert.deepEqual(
      collapseCraftRanks({ "11": 2, "12": 4, "13": 2, "14": 1 }, catalog),
      { "11": 59 },
    );
  });

  it("folds common/elite drops into the lowest rank used", () => {
    assert.deepEqual(
      collapseCraftRanks({ "21": 3, "22": 2, "23": 1 }, catalog),
      { "21": 18 },
    );
  });

    it("terminates when craftIntoId forms a cycle", () => {
    const cyclic: UpgradeCostsCatalog = {
      ...catalog,
      materials: {
        "1": {
          id: 1,
          name: "A",
          icon: "a",
          rankLevel: 2,
          craftIntoId: 2,
        },
        "2": {
          id: 2,
          name: "B",
          icon: "b",
          rankLevel: 3,
          craftIntoId: 1,
        },
      },
    };
    assert.deepEqual(collapseCraftRanks({ "1": 3, "2": 1 }, cyclic), {
      "1": 3,
      "2": 1,
    });
  });

  it("drops chains that enter a cycle mid-path", () => {
    const cyclic: UpgradeCostsCatalog = {
      ...catalog,
      materials: {
        "3": {
          id: 3,
          name: "C",
          icon: "c",
          rankLevel: 1,
          craftIntoId: 1,
        },
        "1": {
          id: 1,
          name: "A",
          icon: "a",
          rankLevel: 2,
          craftIntoId: 2,
        },
        "2": {
          id: 2,
          name: "B",
          icon: "b",
          rankLevel: 3,
          craftIntoId: 1,
        },
      },
    };
    assert.deepEqual(collapseCraftRanks({ "3": 2, "1": 1, "2": 1 }, cyclic), {
      "3": 2,
      "1": 1,
      "2": 1,
    });
  });

  it("reports when higher ranks are folded down", () => {
    assert.equal(craftRanksCanExpand({ "1": 3, "2": 1 }, catalog), true);
    assert.equal(craftRanksCanExpand({ "3": 2, "99": 4 }, catalog), false);
    assert.equal(craftRanksCanExpand({ "1": 2, "99": 4 }, catalog), false);
  });
});
