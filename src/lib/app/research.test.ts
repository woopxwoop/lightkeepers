import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildResearchPersonalization } from "./research.ts";
import type { InventoryWeapon } from "$lib/definitions";

describe("buildResearchPersonalization", () => {
  it("returns personalize false for empty / unowned roster", () => {
    assert.deepEqual(buildResearchPersonalization({ characters: [] }), {
      personalize: false,
    });
    assert.deepEqual(
      buildResearchPersonalization({
        characters: [{ isOwned: false, name_id: "HuTao" }],
      }),
      { personalize: false },
    );
  });

  it("maps owned characters with progress and equipped weapon", () => {
    const fields = buildResearchPersonalization({
      characters: [
        {
          isOwned: true,
          name_id: "HuTao",
          progress: {
            level: 90,
            ascension: 6,
            constellation: 1,
            talents: { normal: 6, skill: 9, burst: 9 },
            weapon: {
              key: "StaffOfHoma",
              level: 90,
              ascension: 6,
              refinement: 1,
            },
          },
        },
        { isOwned: false, name_id: "Xingqiu" },
      ],
    });
    assert.equal(fields.personalize, true);
    assert.deepEqual(fields.roster_name_ids, ["HuTao"]);
    assert.deepEqual(fields.owned_characters, [
      {
        name_id: "HuTao",
        constellation: 1,
        level: 90,
        ascension: 6,
        talents: { normal: 6, skill: 9, burst: 9 },
        weapon: {
          key: "StaffOfHoma",
          refinement: 1,
          level: 90,
          ascension: 6,
        },
      },
    ]);
    assert.equal(fields.owned_weapons, undefined);
  });

  it("includes inventory weapons not already equipped", () => {
    const inventory: InventoryWeapon[] = [
      {
        key: "StaffOfHoma",
        level: 90,
        ascension: 6,
        refinement: 1,
        location: "HuTao",
        lock: false,
      },
      {
        key: "Deathmatch",
        level: 80,
        ascension: 5,
        refinement: 3,
        location: "",
        lock: false,
      },
    ];
    const fields = buildResearchPersonalization({
      characters: [
        {
          isOwned: true,
          name_id: "HuTao",
          progress: {
            level: 90,
            ascension: 6,
            constellation: 0,
            talents: { normal: 1, skill: 8, burst: 8 },
            weapon: {
              key: "StaffOfHoma",
              level: 90,
              ascension: 6,
              refinement: 1,
            },
          },
        },
      ],
      inventoryWeapons: inventory,
    });
    assert.deepEqual(fields.owned_weapons, [
      {
        key: "Deathmatch",
        refinement: 3,
        level: 80,
        ascension: 5,
      },
    ]);
  });

  it("dedupes inventory weapons by key keeping highest refinement and copy count", () => {
    const inventory: InventoryWeapon[] = [
      {
        key: "TheWidsith",
        level: 70,
        ascension: 4,
        refinement: 1,
        location: "",
        lock: false,
      },
      {
        key: "TheWidsith",
        level: 90,
        ascension: 6,
        refinement: 5,
        location: "",
        lock: false,
      },
      {
        key: "TheWidsith",
        level: 1,
        ascension: 0,
        refinement: 1,
        location: "",
        lock: false,
      },
    ];
    const fields = buildResearchPersonalization({
      characters: [{ isOwned: true, name_id: "Yae" }],
      inventoryWeapons: inventory,
    });
    assert.deepEqual(fields.owned_weapons, [
      {
        key: "TheWidsith",
        refinement: 5,
        level: 90,
        ascension: 6,
        copies: 3,
      },
    ]);
  });

  it("attaches total copies to equipped weapon when bag has duplicates", () => {
    const inventory: InventoryWeapon[] = [
      {
        key: "StaffOfHoma",
        level: 90,
        ascension: 6,
        refinement: 1,
        location: "HuTao",
        lock: false,
      },
      {
        key: "StaffOfHoma",
        level: 1,
        ascension: 0,
        refinement: 1,
        location: "",
        lock: false,
      },
    ];
    const fields = buildResearchPersonalization({
      characters: [
        {
          isOwned: true,
          name_id: "HuTao",
          progress: {
            level: 90,
            ascension: 6,
            constellation: 0,
            talents: { normal: 1, skill: 8, burst: 8 },
            weapon: {
              key: "StaffOfHoma",
              level: 90,
              ascension: 6,
              refinement: 1,
            },
          },
        },
      ],
      inventoryWeapons: inventory,
    });
    assert.equal(fields.owned_weapons, undefined);
    assert.equal(fields.owned_characters?.[0]?.weapon?.copies, 2);
  });

  it("omits owned_weapons when inventory is empty or null", () => {
    const base = {
      characters: [{ isOwned: true, name_id: "Xingqiu" }],
    };
    assert.equal(
      buildResearchPersonalization(base).owned_weapons,
      undefined,
    );
    assert.equal(
      buildResearchPersonalization({ ...base, inventoryWeapons: null })
        .owned_weapons,
      undefined,
    );
    assert.equal(
      buildResearchPersonalization({ ...base, inventoryWeapons: [] })
        .owned_weapons,
      undefined,
    );
  });
});
