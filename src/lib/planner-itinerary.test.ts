import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCharacterGoal, createWeaponGoal } from "./calculator-goals.ts";
import {
  FARM_WEEK_PAIRS,
  displayedMaterialId,
  farmGoalRef,
  farmMaterialContributors,
  farmPlacesFromMaterials,
  farmPlacesOfKind,
  farmTodayColumn,
  farmWeekDays,
  faceMaterialOnPlaces,
  todayWeekday,
  uniqueGoalsOnPlaces,
  type FarmGoalRef,
} from "./planner-itinerary.ts";
import type { UpgradeCostsCatalog } from "./types/upgrade-costs.ts";

function emptyCurves(): UpgradeCostsCatalog["curves"] {
  return {
    avatarLevelExp: [0],
    weaponLevelExpByRarity: {},
    avatarExpItems: [],
    weaponExpItems: [],
  };
}

const catalog: UpgradeCostsCatalog = {
  curves: emptyCurves(),
  characters: [],
  weapons: [],
  materials: {
    "11": {
      id: 11,
      name: "Philosophies of Freedom",
      icon: "UI_ItemIcon_11",
      rankLevel: 4,
      sources: [
        {
          kind: "domain",
          name: "Forsaken Rift",
          days: ["Mon", "Thu", "Sun"],
        },
      ],
    },
    "12": {
      id: 12,
      name: "Guide to Freedom",
      icon: "UI_ItemIcon_12",
      rankLevel: 3,
      sources: [
        {
          kind: "domain",
          name: "Forsaken Rift",
          days: ["Mon", "Thu", "Sun"],
        },
      ],
    },
    "13": {
      id: 13,
      name: "Guide to Diligence",
      icon: "UI_ItemIcon_13",
      rankLevel: 3,
      sources: [
        {
          kind: "domain",
          name: "Taishan Mansion",
          days: ["Tue", "Fri", "Sun"],
        },
      ],
    },
    "14": {
      id: 14,
      name: "Philosophies of Resistance",
      icon: "UI_ItemIcon_14",
      rankLevel: 4,
      sources: [
        {
          kind: "domain",
          name: "Forsaken Rift",
          days: ["Tue", "Fri", "Sun"],
        },
      ],
    },
    "21": {
      id: 21,
      name: "Dvalin's Plume",
      icon: "UI_ItemIcon_21",
      rankLevel: 5,
      sources: [{ kind: "weekly", name: "Stormterror" }],
    },
    "31": {
      id: 31,
      name: "Juvenile Jade",
      icon: "UI_ItemIcon_31",
      rankLevel: 4,
      sources: [
        { kind: "boss", name: "Primo Geovishap", icon: "UI_Monster_1" },
      ],
    },
    "41": {
      id: 41,
      name: "Slime Condensate",
      icon: "UI_ItemIcon_41",
      rankLevel: 1,
      sources: [{ kind: "common", name: "Slime" }],
    },
    "51": {
      id: 51,
      name: "Valberry",
      icon: "UI_ItemIcon_51",
      rankLevel: 1,
    },
    "61": {
      id: 61,
      name: "Tail of Boreas",
      icon: "UI_ItemIcon_61",
      rankLevel: 5,
      sources: [
        {
          kind: "boss",
          name: "Lupus Boreas, Dominator of Wolves",
          icon: "UI_MonsterIcon_LupiBoreas",
        },
      ],
    },
  },
};

describe("farmPlacesFromMaterials", () => {
  it("groups domain/weekly/boss and skips locals and common drops", () => {
    const places = farmPlacesFromMaterials(
      { "11": 2, "12": 4, "21": 1, "31": 3, "41": 8, "51": 9 },
      catalog,
    );
    assert.deepEqual(
      places.map((p) => p.name),
      ["Forsaken Rift", "Stormterror", "Primo Geovishap"],
    );
    assert.deepEqual(
      places[0]?.materials.map((m) => m.name),
      ["Philosophies of Freedom", "Guide to Freedom"],
    );
    assert.deepEqual(places[0]?.days, ["Mon", "Thu", "Sun"]);
    assert.equal(places[0]?.icon, "UI_ItemIcon_11");
    assert.equal(places[1]?.icon, "UI_ItemIcon_21");
    assert.equal(places[2]?.icon, "UI_Monster_1");
  });

  it("counts 5-star Boreas drops as a weekly boss", () => {
    const places = farmPlacesFromMaterials({ "31": 1, "61": 1 }, catalog);
    assert.deepEqual(
      farmPlacesOfKind(places, "weekly").map((p) => p.name),
      ["Lupus Boreas, Dominator of Wolves"],
    );
    assert.deepEqual(
      farmPlacesOfKind(places, "boss").map((p) => p.name),
      ["Primo Geovishap"],
    );
  });

  it("keeps 5-star world-boss gemstones as boss (craft chain)", () => {
    const withGem: UpgradeCostsCatalog = {
      ...catalog,
      materials: {
        ...catalog.materials,
        "71": {
          id: 71,
          name: "Agnidus Agate Sliver",
          icon: "UI_ItemIcon_71",
          rankLevel: 2,
          craftIntoId: 72,
          sources: [{ kind: "boss", name: "Pyro Regisvine" }],
        },
        "72": {
          id: 72,
          name: "Agnidus Agate Gemstone",
          icon: "UI_ItemIcon_72",
          rankLevel: 5,
          sources: [{ kind: "boss", name: "Pyro Regisvine" }],
        },
      },
    };
    const places = farmPlacesFromMaterials({ "72": 1 }, withGem);
    assert.deepEqual(
      farmPlacesOfKind(places, "boss").map((p) => p.name),
      ["Pyro Regisvine"],
    );
    assert.deepEqual(farmPlacesOfKind(places, "weekly"), []);
  });

  it("lists unique contributing goals on a day's places", () => {
    const places = farmPlacesFromMaterials({ "11": 1, "12": 1 }, catalog);
    const hu: FarmGoalRef = { id: "a", name: "Hu Tao", icon: null };
    const xq: FarmGoalRef = { id: "b", name: "Xingqiu", icon: null };
    const contributors = new Map<string, FarmGoalRef[]>([
      ["11", [hu, xq]],
      ["12", [hu]],
    ]);
    assert.deepEqual(
      uniqueGoalsOnPlaces(places, contributors).map((g) => g.name),
      ["Hu Tao", "Xingqiu"],
    );
  });

  it("keeps one face when two goals share a character", () => {
    const places = farmPlacesFromMaterials({ "11": 1 }, catalog);
    const huA: FarmGoalRef = {
      id: "a",
      name: "Hu Tao",
      icon: null,
      name_id: "hu_tao",
    };
    const huB: FarmGoalRef = {
      id: "b",
      name: "Hu Tao",
      icon: null,
      name_id: "hu_tao",
    };
    const contributors = new Map<string, FarmGoalRef[]>([["11", [huA, huB]]]);
    assert.deepEqual(
      uniqueGoalsOnPlaces(places, contributors).map((g) => g.id),
      ["a"],
    );
  });

  it("picks the highest-rank material for a face on a day", () => {
    const places = farmPlacesFromMaterials({ "11": 2, "12": 5 }, catalog);
    const hu: FarmGoalRef = { id: "a", name: "Hu Tao", icon: null };
    const contributors = new Map<string, FarmGoalRef[]>([
      ["11", [hu]],
      ["12", [hu]],
    ]);
    const mat = faceMaterialOnPlaces(hu, places, contributors);
    assert.equal(mat?.id, "11");
    assert.equal(mat?.name, "Philosophies of Freedom");
  });

  it("keeps the same domain as separate places when rotations differ", () => {
    const places = farmPlacesFromMaterials({ "11": 1, "14": 1 }, catalog);
    assert.deepEqual(
      places.map((p) => [p.name, p.days, p.materials[0]?.name]),
      [
        ["Forsaken Rift", ["Mon", "Thu", "Sun"], "Philosophies of Freedom"],
        ["Forsaken Rift", ["Tue", "Fri", "Sun"], "Philosophies of Resistance"],
      ],
    );
  });
});

describe("farmWeekDays", () => {
  it("groups domains onto Mon/Thu, Tue/Fri, Wed/Sat columns", () => {
    const places = farmPlacesFromMaterials(
      { "11": 1, "13": 1, "14": 1, "21": 1, "31": 1 },
      catalog,
    );
    const thu = farmWeekDays(places, "Thu");
    assert.deepEqual(
      thu.map((d) => d.day),
      FARM_WEEK_PAIRS.map((p) => p.label),
    );
    assert.deepEqual(
      thu.map((d) => [d.today, d.places.map((p) => p.materials[0]?.name)]),
      [
        [true, ["Philosophies of Freedom"]],
        [false, ["Philosophies of Resistance", "Guide to Diligence"]],
        [false, []],
      ],
    );
    assert.deepEqual(
      farmPlacesOfKind(places, "weekly").map((p) => p.name),
      ["Stormterror"],
    );
    assert.deepEqual(
      farmPlacesOfKind(places, "boss").map((p) => p.name),
      ["Primo Geovishap"],
    );
  });

  it("omits Sunday from the expanded paired grid", () => {
    const places = farmPlacesFromMaterials({ "11": 1, "13": 1 }, catalog);
    const sun = farmWeekDays(places, "Sun");
    assert.deepEqual(
      sun.map((d) => d.day),
      FARM_WEEK_PAIRS.map((p) => p.label),
    );
    assert.equal(
      sun.some((d) => d.today),
      false,
    );
  });

  it("Sunday today includes every domain rotation", () => {
    const places = farmPlacesFromMaterials({ "11": 1, "13": 1 }, catalog);
    const col = farmTodayColumn(places, "Sun");
    assert.equal(col.day, "Sun");
    assert.equal(col.today, true);
    assert.deepEqual(
      col.places.map((p) => p.name),
      ["Forsaken Rift", "Taishan Mansion"],
    );
  });
});

describe("displayedMaterialId", () => {
  const chainCatalog: UpgradeCostsCatalog = {
    ...catalog,
    materials: {
      ...catalog.materials,
      "12": { ...catalog.materials["12"]!, craftIntoId: 11 },
    },
  };

  it("keeps an id that is already displayed", () => {
    assert.equal(displayedMaterialId("11", { "11": 2 }, chainCatalog), "11");
  });

  it("walks craft-up onto a displayed higher rank", () => {
    assert.equal(displayedMaterialId("12", { "11": 2 }, chainCatalog), "11");
  });

  it("walks craft-down onto a displayed lower rank", () => {
    assert.equal(displayedMaterialId("11", { "12": 2 }, chainCatalog), "12");
  });

  it("returns null when the chain never hits the displayed bag", () => {
    assert.equal(displayedMaterialId("12", { "21": 1 }, chainCatalog), null);
  });
});

describe("farmMaterialContributors", () => {
  it("maps collapsed materials onto character and weapon goals", () => {
    const promotes = [
      {
        promoteLevel: 0,
        mora: 0,
        unlockMaxLevel: 20,
        items: [] as { id: number; count: number }[],
      },
      {
        promoteLevel: 1,
        mora: 1000,
        unlockMaxLevel: 40,
        items: [{ id: 12, count: 2 }],
      },
    ];
    const contribCatalog: UpgradeCostsCatalog = {
      ...catalog,
      materials: {
        ...catalog.materials,
        "12": { ...catalog.materials["12"]!, craftIntoId: 11 },
      },
      characters: [
        {
          name_id: "Hutao",
          game_id: 1,
          name: "Hu Tao",
          element: "Pyro",
          avatarPromoteId: 1,
          promotes,
          talents: {
            normal: { proudSkillGroupId: 1, levels: [] },
            skill: { proudSkillGroupId: 1, levels: [] },
            burst: { proudSkillGroupId: 1, levels: [] },
          },
        },
      ],
      weapons: [
        {
          id: 14501,
          name: "Staff of Homa",
          rankLevel: 5,
          weaponPromoteId: 1,
          icon: "UI_EquipIcon_Pole_Homa",
          promotes: [
            {
              promoteLevel: 0,
              mora: 0,
              unlockMaxLevel: 20,
              items: [],
            },
            {
              promoteLevel: 1,
              mora: 500,
              unlockMaxLevel: 40,
              items: [{ id: 11, count: 1 }],
            },
          ],
        },
      ],
    };
    const goals = [
      createCharacterGoal("Hutao", {
        id: "c1",
        start: {
          level: 1,
          ascension: 0,
          talents: { normal: 1, skill: 1, burst: 1 },
        },
        target: {
          level: 40,
          ascension: 1,
          talents: { normal: 1, skill: 1, burst: 1 },
        },
      }),
      createWeaponGoal(14501, {
        id: "w1",
        start: { level: 1, ascension: 0 },
        target: { level: 40, ascension: 1 },
      }),
    ];
    // Collapsed bag shows only the higher book rank (11); char costs 12.
    const displayed = { "11": 3 };
    const byMat = farmMaterialContributors(goals, contribCatalog, displayed);
    assert.deepEqual((byMat.get("11") ?? []).map((g) => g.id).sort(), [
      "c1",
      "w1",
    ]);
  });
});

describe("farmGoalRef", () => {
  it("keeps name_id on character goals and omits it on weapons", () => {
    const hu = farmGoalRef(
      createCharacterGoal("hu_tao", { id: "c1" }),
      catalog,
    );
    assert.equal(hu.name_id, "hu_tao");
    const weapon = farmGoalRef(createWeaponGoal(1, { id: "w1" }), catalog);
    assert.equal(weapon.name_id, undefined);
    assert.equal(weapon.weapon_id, 1);
  });

  it("uses tall gacha splash art for weapons, with the square icon as fallback", () => {
    const withWeapon: UpgradeCostsCatalog = {
      ...catalog,
      weapons: [
        {
          id: 14501,
          name: "Lost Prayer to the Sacred Winds",
          rankLevel: 5,
          weaponPromoteId: 1,
          icon: "UI_EquipIcon_Catalyst_Fourwinds",
          promotes: [],
        },
      ],
    };
    const ref = farmGoalRef(createWeaponGoal(14501, { id: "w1" }), withWeapon);
    assert.match(ref.icon ?? "", /UI_Gacha_EquipIcon_Catalyst_Fourwinds/);
    assert.match(ref.fallbackIcon ?? "", /UI_EquipIcon_Catalyst_Fourwinds/);
    assert.ok(!ref.fallbackIcon?.includes("UI_Gacha_EquipIcon"));
  });
});

describe("todayWeekday", () => {
  it("maps JavaScript getDay() indices to Sun through Sat", () => {
    const dates = [
      "2026-08-09T12:00:00", // Sun
      "2026-08-10T12:00:00", // Mon
      "2026-08-11T12:00:00", // Tue
      "2026-08-12T12:00:00", // Wed
      "2026-08-13T12:00:00", // Thu
      "2026-08-14T12:00:00", // Fri
      "2026-08-15T12:00:00", // Sat
    ];
    assert.deepEqual(
      dates.map((iso) => todayWeekday(new Date(iso))),
      ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    );
  });
});
