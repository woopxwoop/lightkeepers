import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatGoodStatValue,
  rosterBuildViewFromOwned,
  setCountsFromPieces,
} from "./roster-build-card.ts";
import type {
  CharacterOwned,
  InventoryArtifact,
  InventoryWeapon,
} from "./definitions.ts";

const baseChar = {
  name_id: "Hutao",
  name: "Hu Tao",
  element: "Pyro",
  rarity: 5,
  weapon_type: "WEAPON_POLE",
  isOwned: true,
  progress: {
    level: 90,
    ascension: 6,
    constellation: 1,
    talents: { normal: 6, skill: 9, burst: 8 },
    weapon: {
      key: "StaffOfHoma",
      level: 90,
      ascension: 6,
      refinement: 1,
    },
  },
} as CharacterOwned;

const homa: InventoryWeapon = {
  key: "StaffOfHoma",
  level: 90,
  ascension: 6,
  refinement: 1,
  location: "HuTao",
  lock: false,
};
const spare: InventoryWeapon = {
  key: "DragonBane",
  level: 70,
  ascension: 5,
  refinement: 3,
  location: "",
  lock: false,
};

const flower: InventoryArtifact = {
  setKey: "CrimsonWitchOfFlames",
  slotKey: "flower",
  level: 20,
  rarity: 5,
  mainStatKey: "hp",
  location: "HuTao",
  lock: false,
  substats: [{ key: "critRate_", value: 10.5 }],
};
const plume: InventoryArtifact = {
  setKey: "CrimsonWitchOfFlames",
  slotKey: "plume",
  level: 20,
  rarity: 5,
  mainStatKey: "atk",
  location: "HuTao",
  lock: false,
  substats: [],
};
const sands: InventoryArtifact = {
  setKey: "GladiatorsFinale",
  slotKey: "sands",
  level: 16,
  rarity: 5,
  mainStatKey: "hp_",
  location: "HuTao",
  lock: false,
  substats: [],
};

describe("setCountsFromPieces", () => {
  it("keeps sets with 2+ pieces, sorted by count", () => {
    const counts = setCountsFromPieces([flower, plume, sands, null, null]);
    assert.deepEqual(counts, [{ setKey: "CrimsonWitchOfFlames", count: 2 }]);
  });
});

describe("rosterBuildViewFromOwned", () => {
  it("prefers inventory weapon and fills slots by location", () => {
    const view = rosterBuildViewFromOwned(
      baseChar,
      [homa, spare],
      [flower, plume, sands],
    );
    assert.equal(view.locationKey, "HuTao");
    assert.equal(view.weapon?.key, "StaffOfHoma");
    assert.equal(view.piecesBySlot.flower?.setKey, "CrimsonWitchOfFlames");
    assert.equal(view.piecesBySlot.goblet, null);
    assert.equal(view.setCounts[0]?.setKey, "CrimsonWitchOfFlames");
  });

  it("falls back to progress.weapon when bag has no location match", () => {
    const view = rosterBuildViewFromOwned(baseChar, [spare], []);
    assert.equal(view.weapon?.key, "StaffOfHoma");
    assert.equal(view.weapon?.refinement, 1);
  });
});

describe("formatGoodStatValue", () => {
  it("formats percent and flat keys", () => {
    assert.equal(formatGoodStatValue("critRate_", 10.5), "10.5%");
    assert.equal(formatGoodStatValue("hp", 4780), "4780");
  });
});
