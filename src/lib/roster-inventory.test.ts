import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bestInventoryWeaponByKey,
  equippedWeaponForLocation,
  equipInventoryWeapon,
  lowestInventoryWeaponByKey,
  plannerStartFromOwnedWeapon,
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
    const spareR5: InventoryWeapon = {
      ...spare,
      level: 90,
      ascension: 6,
      refinement: 5,
    };
    assert.equal(
      bestInventoryWeaponByKey([homa, spare, spareR5], "DragonBane")
        ?.refinement,
      5,
    );
    assert.equal(
      lowestInventoryWeaponByKey([homa, spare, spareR5], "DragonBane")?.level,
      70,
    );
    const spareLowAsc: InventoryWeapon = {
      ...spare,
      ascension: 3,
    };
    assert.equal(
      lowestInventoryWeaponByKey([spare, spareLowAsc], "DragonBane")
        ?.ascension,
      3,
    );
    assert.equal(plannerStartFromOwnedWeapon(spare)?.level, 70);
    assert.equal(plannerStartFromOwnedWeapon(homa), undefined);
  });

  it("moves location when equipping", () => {
    const next = equipInventoryWeapon([homa, spare], "HuTao", {
      key: "DragonBane",
      level: 70,
      ascension: 5,
      refinement: 3,
    });
    assert.equal(next.find((w) => w.key === "StaffOfHoma")?.location, "");
    const equipped = next.find((w) => w.key === "DragonBane");
    assert.equal(equipped?.location, "HuTao");
    assert.equal(equipped?.level, 70);
    assert.equal(equipped?.lock, true);
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
