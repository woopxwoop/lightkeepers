import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bestInventoryWeaponByKey,
  equippedWeaponForLocation,
  equipInventoryWeapon,
} from "./roster-inventory.ts";
import { rosterProgressForNameId } from "./roster-progress.ts";
import type { InventoryWeapon } from "./definitions.ts";

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
  lock: true,
};

describe("inventory weapons", () => {
  it("finds equipped and best-by-key copies", () => {
    assert.equal(
      equippedWeaponForLocation([homa, spare], "HuTao")?.key,
      "StaffOfHoma",
    );
    assert.equal(equippedWeaponForLocation([homa, spare], "Beidou"), null);
    assert.equal(
      bestInventoryWeaponByKey([homa, spare], "DragonBane")?.level,
      70,
    );
  });

  it("moves location when equipping", () => {
    const next = equipInventoryWeapon([homa, spare], "HuTao", {
      key: "DragonBane",
      level: 70,
      ascension: 5,
      refinement: 3,
    });
    assert.equal(next.find((w) => w.key === "StaffOfHoma")?.location, "");
    assert.equal(next.find((w) => w.key === "DragonBane")?.location, "HuTao");
  });
});

describe("rosterProgressForNameId + weapons slice", () => {
  it("overlays equipped weapon from location", () => {
    const roster = [
      {
        name: "Hu Tao",
        name_id: "Hutao",
        isOwned: true,
        progress: {
          level: 90,
          ascension: 6,
          constellation: 1,
          talents: { normal: 6, skill: 8, burst: 8 },
          weapon: null,
        },
      },
    ];
    const progress = rosterProgressForNameId(roster, "Hutao", [homa]);
    assert.equal(progress?.weapon?.key, "StaffOfHoma");
    assert.equal(progress?.constellation, 1);
  });
});
