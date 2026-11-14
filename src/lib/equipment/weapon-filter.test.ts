import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultWeaponRarityFilter,
  filterWeapons,
  weaponFilterTypeLabel,
  weaponFiltersActive,
} from "./weapon-filter.ts";

describe("weapon-filter", () => {
  const rows = [
    { id: 1, name: "A", rarity: 5, typeLabel: "Polearm" },
    { id: 2, name: "B", rarity: 4, typeLabel: "Sword" },
    { id: 3, name: "C", rarity: 3, typeLabel: "Bow" },
    { id: 4, name: "D", rarity: 4, typeLabel: null },
  ];

  it("defaults to 4★ and 5★", () => {
    const rarity = defaultWeaponRarityFilter();
    assert.deepEqual([...rarity].sort(), ["4", "5"]);
    assert.equal(weaponFiltersActive({ rarity }), true);
  });

  it("filters by rarity and type", () => {
    const rarity = defaultWeaponRarityFilter();
    assert.deepEqual(
      filterWeapons(rows, { rarity }).map((w) => w.id),
      [1, 2, 4],
    );
    assert.deepEqual(
      filterWeapons(rows, {
        rarity,
        types: new Set(["Sword"]),
      }).map((w) => w.id),
      [2],
    );
  });

  it("empty sets mean no constraint", () => {
    assert.equal(filterWeapons(rows, {}).length, 4);
  });

  it("maps weapon type enums to chip labels", () => {
    assert.equal(weaponFilterTypeLabel("WEAPON_POLE"), "Polearm");
    assert.equal(weaponFilterTypeLabel("Sword"), "Sword");
    assert.equal(weaponFilterTypeLabel("nope"), null);
  });
});
