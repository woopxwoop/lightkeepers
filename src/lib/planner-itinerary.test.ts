import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCharacterGoal, createWeaponGoal } from "./calculator-goals.ts";
import {
  farmPlacesFromMaterials,
  groupFarmPlaces,
  resolveItineraryFocus,
  todayWeekday,
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
  },
};

describe("resolveItineraryFocus", () => {
  const goals = [
    createCharacterGoal("Hutao", { id: "a" }),
    createWeaponGoal(1, { id: "b" }),
  ];

  it("defaults to every goal when nothing is stored", () => {
    assert.deepEqual([...resolveItineraryFocus(goals, null)].sort(), [
      "a",
      "b",
    ]);
  });

  it("keeps an explicit subset and drops stale ids", () => {
    assert.deepEqual([...resolveItineraryFocus(goals, ["a", "gone"])], ["a"]);
  });

  it("allows an empty explicit subset", () => {
    assert.equal(resolveItineraryFocus(goals, []).size, 0);
  });
});

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
      ["Guide to Freedom", "Philosophies of Freedom"],
    );
    assert.deepEqual(places[0]?.days, ["Mon", "Thu", "Sun"]);
    assert.equal(places[0]?.icon, "UI_ItemIcon_12");
    assert.equal(places[1]?.icon, "UI_ItemIcon_21");
    assert.equal(places[2]?.icon, "UI_Monster_1");
  });
});

describe("groupFarmPlaces", () => {
  it("splits domains by weekday and puts today's rotation first", () => {
    const places = farmPlacesFromMaterials(
      { "11": 1, "13": 1, "21": 1, "31": 1 },
      catalog,
    );
    const thu = groupFarmPlaces(places, "Thu");
    assert.deepEqual(
      thu.map((s) => s.label),
      ["Domains", "Weekly bosses", "World bosses"],
    );
    assert.deepEqual(
      thu[0]?.groups.map((g) => [g.daysLabel, g.openToday, g.places[0]?.name]),
      [
        ["Mon/Thu/Sun", true, "Forsaken Rift"],
        ["Tue/Fri/Sun", false, "Taishan Mansion"],
      ],
    );

    const tue = groupFarmPlaces(places, "Tue");
    assert.deepEqual(
      tue[0]?.groups.map((g) => [g.daysLabel, g.openToday, g.places[0]?.name]),
      [
        ["Tue/Fri/Sun", true, "Taishan Mansion"],
        ["Mon/Thu/Sun", false, "Forsaken Rift"],
      ],
    );
  });

  it("marks every domain family open on Sunday", () => {
    const places = farmPlacesFromMaterials({ "11": 1, "13": 1 }, catalog);
    const sun = groupFarmPlaces(places, "Sun");
    assert.equal(
      sun[0]?.groups.every((g) => g.openToday),
      true,
    );
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
