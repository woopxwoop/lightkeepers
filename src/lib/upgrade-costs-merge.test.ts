import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeUpgradeCostCatalogs } from "./upgrade-costs-merge.ts";
import type { UpgradeCostsCatalog } from "./types/upgrade-costs.ts";

function emptyCurves(): UpgradeCostsCatalog["curves"] {
  return {
    avatarLevelExp: [0],
    weaponLevelExpByRarity: {},
    avatarExpItems: [],
    weaponExpItems: [],
  };
}

describe("mergeUpgradeCostCatalogs", () => {
  it("returns live when beta is null", () => {
    const live: UpgradeCostsCatalog = {
      curves: emptyCurves(),
      materials: { "1": { id: 1, name: "A", icon: "UI_ItemIcon_1", rankLevel: 1 } },
      characters: [
        {
          name_id: "Hutao",
          game_id: 1,
          name: "Hu Tao",
          avatarPromoteId: 1,
          promotes: [],
          talents: {
            normal: { proudSkillGroupId: 1, levels: [] },
            skill: { proudSkillGroupId: 2, levels: [] },
            burst: { proudSkillGroupId: 3, levels: [] },
          },
        },
      ],
      weapons: [],
    };
    assert.equal(mergeUpgradeCostCatalogs(live, null), live);
  });

  it("adds beta-only characters and materials; live wins on collision", () => {
    const live: UpgradeCostsCatalog = {
      curves: emptyCurves(),
      materials: {
        "1": { id: 1, name: "Live Mora", icon: "UI_ItemIcon_1", rankLevel: 3 },
      },
      characters: [
        {
          name_id: "Hutao",
          game_id: 1,
          name: "Hu Tao",
          avatarPromoteId: 1,
          promotes: [],
          talents: {
            normal: { proudSkillGroupId: 1, levels: [] },
            skill: { proudSkillGroupId: 2, levels: [] },
            burst: { proudSkillGroupId: 3, levels: [] },
          },
        },
      ],
      weapons: [{ id: 1, name: "Live Spear", rankLevel: 5, weaponPromoteId: 1, icon: "x", promotes: [] }],
    };
    const beta: UpgradeCostsCatalog = {
      curves: emptyCurves(),
      materials: {
        "1": { id: 1, name: "Beta Mora", icon: "UI_ItemIcon_1", rankLevel: 1 },
        "9": { id: 9, name: "CB Mat", icon: "UI_ItemIcon_9", rankLevel: 4 },
      },
      characters: [
        {
          name_id: "Hutao",
          game_id: 1,
          name: "Hu Tao BETA",
          avatarPromoteId: 1,
          promotes: [],
          talents: {
            normal: { proudSkillGroupId: 1, levels: [] },
            skill: { proudSkillGroupId: 2, levels: [] },
            burst: { proudSkillGroupId: 3, levels: [] },
          },
        },
        {
          name_id: "Odette",
          game_id: 2,
          name: "Odette",
          avatarPromoteId: 2,
          promotes: [],
          talents: {
            normal: { proudSkillGroupId: 4, levels: [] },
            skill: { proudSkillGroupId: 5, levels: [] },
            burst: { proudSkillGroupId: 6, levels: [] },
          },
        },
      ],
      weapons: [
        { id: 1, name: "Beta Spear", rankLevel: 5, weaponPromoteId: 1, icon: "y", promotes: [] },
        { id: 99, name: "CB Weapon", rankLevel: 5, weaponPromoteId: 2, icon: "z", promotes: [] },
      ],
    };

    const merged = mergeUpgradeCostCatalogs(live, beta);
    assert.equal(merged.characters.length, 2);
    assert.equal(
      merged.characters.find((c) => c.name_id === "Hutao")?.name,
      "Hu Tao",
    );
    assert.ok(merged.characters.some((c) => c.name_id === "Odette"));
    assert.equal(merged.materials["1"]?.name, "Live Mora");
    assert.equal(merged.materials["9"]?.name, "CB Mat");
    assert.equal(merged.weapons.find((w) => w.id === 1)?.name, "Live Spear");
    assert.ok(merged.weapons.some((w) => w.id === 99));
  });
});
