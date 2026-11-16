import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { ensureBaseStatData } from "./equipment-data.ts";
import type { SheetStatBag } from "./build-stats.ts";
import type { WeaponData } from "./equipment-data.ts";
import {
  artifactMainStatText,
  sheetStatRows,
  starCount,
  weaponBaseAtk,
  weaponSubstatDisplay,
} from "./build-stat-display.ts";

before(async () => {
  await ensureBaseStatData();
});

function sheet(partial: Partial<SheetStatBag>): SheetStatBag {
  return {
    flatHp: 0,
    flatAtk: 0,
    flatDef: 0,
    hpPct: 0,
    atkPct: 0,
    defPct: 0,
    eleMas: 0,
    enerRech: 1,
    critRate: 0.05,
    critDMG: 0.5,
    dmgBonus: {},
    heal: 0,
    hpBase: 0,
    atkBase: 0,
    defBase: 0,
    hp: 0,
    atk: 0,
    def: 0,
    ...partial,
  };
}

describe("starCount", () => {
  it("clamps to 0–5 and treats missing as 0", () => {
    assert.equal(starCount(undefined), 0);
    assert.equal(starCount(4), 4);
    assert.equal(starCount(7), 5);
    assert.equal(starCount(-1), 0);
  });
});

describe("sheetStatRows", () => {
  it("lists the seven core rows with null values before the sheet resolves", () => {
    const rows = sheetStatRows(null);
    assert.deepEqual(
      rows.map((r) => [r.key, r.label, r.icon, r.value]),
      [
        ["hp", "HP", "hp", null],
        ["atk", "ATK", "atk", null],
        ["def", "DEF", "def", null],
        ["eleMas", "Elemental Mastery", "eleMas", null],
        ["critRate", "CRIT Rate", "critRate_", null],
        ["critDMG", "CRIT DMG", "critDMG_", null],
        ["enerRech", "Energy Recharge", "enerRech_", null],
      ],
    );
  });

  it("appends positive DMG bonuses highest first", () => {
    const rows = sheetStatRows(
      sheet({
        hp: 30000,
        dmgBonus: { pyro_dmg_: 0.466, hydro_dmg_: 0, physical_dmg_: 0.6 },
      }),
    );
    assert.equal(rows.length, 9);
    assert.equal(rows[0].value, 30000);
    assert.deepEqual(rows.slice(7), [
      {
        key: "physical_dmg_",
        label: "Physical DMG Bonus",
        icon: "physical_dmg_",
        value: 0.6,
      },
      {
        key: "pyro_dmg_",
        label: "Pyro DMG Bonus",
        icon: "pyro_dmg_",
        value: 0.466,
      },
    ]);
  });
});

describe("artifactMainStatText", () => {
  it("rounds flat mains and formats percents to one decimal", () => {
    assert.equal(
      artifactMainStatText({ mainStatKey: "hp", rarity: 5, level: 20 }),
      "4780",
    );
    assert.equal(
      artifactMainStatText({ mainStatKey: "critRate_", rarity: 5, level: 20 }),
      "31.1%",
    );
  });

  it("falls back to the stat label for unknown keys", () => {
    assert.equal(
      artifactMainStatText({ mainStatKey: "mystery", rarity: 5, level: 20 }),
      "mystery",
    );
  });
});

describe("weapon display", () => {
  const resolved = {
    baseAtk: 608.07,
    subStat: {
      propType: "FIGHT_PROP_CRITICAL_HURT",
      value: 0.662,
      isPercent: true,
    },
  };

  it("rounds base ATK", () => {
    assert.equal(weaponBaseAtk(resolved), 608);
    assert.equal(weaponBaseAtk(null), null);
  });

  it("formats the substat and maps its GOOD icon key", () => {
    assert.deepEqual(weaponSubstatDisplay(resolved, null), {
      label: "CRIT DMG",
      text: "66.2%",
      iconKey: "critDMG_",
    });
  });

  it("prefers the baked label and rounds flat substats", () => {
    const baked = {
      subStat: { label: "Elemental Mastery (baked)" },
    } as WeaponData;
    assert.deepEqual(
      weaponSubstatDisplay(
        {
          baseAtk: 510,
          subStat: {
            propType: "FIGHT_PROP_ELEMENT_MASTERY",
            value: 165.4,
            isPercent: false,
          },
        },
        baked,
      ),
      {
        label: "Elemental Mastery (baked)",
        text: "165",
        iconKey: "eleMas",
      },
    );
  });

  it("returns null without a substat", () => {
    assert.equal(
      weaponSubstatDisplay({ baseAtk: 1, subStat: null }, null),
      null,
    );
    assert.equal(weaponSubstatDisplay(null, null), null);
  });
});
