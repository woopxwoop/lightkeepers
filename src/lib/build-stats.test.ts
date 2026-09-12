import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import type { InventoryArtifact } from "./definitions.ts";
import { ensureEquipmentData, weaponByKey } from "./equipment-data.ts";
import type { CharacterBuild } from "./types/investment.ts";
import {
  ARTIFACT_MAIN_STAT_VALUE,
  SUBSTAT_ROLL_VALUE,
  artifactMainValue,
  clampSubstatRolls,
  computeBuildSheetStats,
  computeRosterSheetStats,
  formatSheetStat,
  goodInventoryStatToSheet,
  resolveCharacterBaseStats,
  resolveWeaponStats,
  characterBaseByKey,
} from "./build-stats.ts";

function piece(
  partial: Pick<InventoryArtifact, "slotKey" | "mainStatKey"> &
    Partial<InventoryArtifact>,
): InventoryArtifact {
  return {
    setKey: "CrimsonWitchOfFlames",
    level: 20,
    rarity: 5,
    location: "HuTao",
    lock: false,
    substats: [],
    ...partial,
  };
}

describe("goodInventoryStatToSheet", () => {
  it("divides percent keys by 100", () => {
    assert.equal(goodInventoryStatToSheet("critRate_", 10.5), 0.105);
    assert.equal(goodInventoryStatToSheet("atk_", 46.6), 0.466);
  });

  it("leaves flat keys alone", () => {
    assert.equal(goodInventoryStatToSheet("eleMas", 187), 187);
    assert.equal(goodInventoryStatToSheet("hp", 4780), 4780);
  });
});

describe("computeRosterSheetStats", () => {
  before(async () => {
    await ensureEquipmentData();
  });

  it("returns null for unknown characters", () => {
    assert.equal(
      computeRosterSheetStats({ characterKey: "NotACharacter", pieces: [] }),
      null,
    );
  });

  it("applies L90 bases + Homa ATK/sub without artifacts", () => {
    const base = resolveCharacterBaseStats("HuTao", 90, 6);
    const homa = weaponByKey.get("StaffOfHoma");
    assert.ok(base);
    assert.ok(homa);

    const sheet = computeRosterSheetStats({
      characterKey: "HuTao",
      level: 90,
      ascension: 6,
      weaponKey: "StaffOfHoma",
      pieces: [],
    });
    assert.ok(sheet);

    assert.equal(sheet.hp, base.hp);
    assert.equal(sheet.atk, base.atk + homa.baseAtk);
    assert.equal(sheet.def, base.def);
    assert.equal(sheet.critRate, base.baseCritRate);
    assert.equal(
      sheet.critDMG,
      base.baseCritDMG + (base.ascension.critDMG_ ?? 0) + homa.subStat!.value,
    );
    assert.equal(sheet.enerRech, 1);
    assert.equal(sheet.eleMas, 0);
  });

  it("scales character bases from the AvatarCurve at roster level", () => {
    const l90 = resolveCharacterBaseStats("HuTao", 90, 6);
    const l70 = resolveCharacterBaseStats("HuTao", 70, 5);
    const homa = weaponByKey.get("StaffOfHoma");
    assert.ok(l90);
    assert.ok(l70);
    assert.ok(homa?.subStat);
    assert.ok(l70.hp < l90.hp);
    assert.ok(l70.atk < l90.atk);
    assert.ok(l70.def < l90.def);
    // A5 crit DMG secondary is below A6.
    assert.ok((l70.ascension.critDMG_ ?? 0) < (l90.ascension.critDMG_ ?? 0));

    const sheet70 = computeRosterSheetStats({
      characterKey: "HuTao",
      level: 70,
      ascension: 5,
      weaponKey: "StaffOfHoma",
      pieces: [],
    });
    assert.ok(sheet70);
    assert.equal(sheet70.hp, l70.hp);
    assert.equal(
      sheet70.critDMG,
      l70.baseCritDMG + (l70.ascension.critDMG_ ?? 0) + homa.subStat.value,
    );
  });

  it("adds flower/plume flats only when those pieces are equipped", () => {
    const bare = computeRosterSheetStats({
      characterKey: "HuTao",
      weaponKey: "StaffOfHoma",
      pieces: [],
    });
    const flowerOnly = computeRosterSheetStats({
      characterKey: "HuTao",
      weaponKey: "StaffOfHoma",
      pieces: [piece({ slotKey: "flower", mainStatKey: "hp" })],
    });
    assert.ok(bare);
    assert.ok(flowerOnly);
    assert.equal(flowerOnly.flatHp, bare.flatHp + 4780);
    assert.equal(flowerOnly.flatAtk, bare.flatAtk);
  });

  it("converts GOOD percent subs and uses L90 mains", () => {
    const sheet = computeRosterSheetStats({
      characterKey: "HuTao",
      weaponKey: "StaffOfHoma",
      pieces: [
        piece({
          slotKey: "flower",
          mainStatKey: "hp",
          substats: [{ key: "critRate_", value: 10 }],
        }),
        piece({
          slotKey: "circlet",
          mainStatKey: "critRate_",
          substats: [{ key: "eleMas", value: 23 }],
        }),
        piece({
          slotKey: "goblet",
          mainStatKey: "pyro_dmg_",
        }),
      ],
    });
    assert.ok(sheet);

    const base = resolveCharacterBaseStats("HuTao", 90, 6)!;
    const homa = weaponByKey.get("StaffOfHoma")!;
    assert.equal(sheet.flatHp, 4780);
    assert.ok(Math.abs(sheet.critRate - (base.baseCritRate + 0.311 + 0.1)) < 1e-9);
    assert.equal(sheet.eleMas, 23);
    assert.equal(sheet.dmgBonus.pyro_dmg_, 0.466);
    assert.equal(sheet.hp, base.hp + 4780);
    assert.equal(sheet.atk, base.atk + homa.baseAtk);
  });

  it("scales weapon ATK/sub from WeaponCurve at inventory level", () => {
    const l90 = resolveWeaponStats("StaffOfHoma", 90, 6);
    const l70 = resolveWeaponStats("StaffOfHoma", 70, 5);
    const baked = weaponByKey.get("StaffOfHoma");
    assert.ok(l90);
    assert.ok(l70);
    assert.ok(baked);
    assert.ok(Math.abs(l90.baseAtk - baked.baseAtk) < 0.15);
    assert.ok(l70.baseAtk < l90.baseAtk);
    assert.ok((l70.subStat?.value ?? 0) < (l90.subStat?.value ?? 0));

    const sheet70 = computeRosterSheetStats({
      characterKey: "HuTao",
      level: 70,
      ascension: 5,
      weaponKey: "StaffOfHoma",
      weaponLevel: 70,
      weaponAscension: 5,
      pieces: [],
    });
    assert.ok(sheet70);
    const char70 = resolveCharacterBaseStats("HuTao", 70, 5)!;
    assert.ok(
      Math.abs(sheet70.atk - (char70.atk + l70.baseAtk)) < 1e-6,
    );
  });

  it("uses ReliquaryLevel mains for piece rarity/level", () => {
    const low = computeRosterSheetStats({
      characterKey: "HuTao",
      weaponKey: "StaffOfHoma",
      pieces: [
        piece({
          slotKey: "flower",
          mainStatKey: "hp",
          rarity: 4,
          level: 16,
        }),
      ],
    });
    const maxed = computeRosterSheetStats({
      characterKey: "HuTao",
      weaponKey: "StaffOfHoma",
      pieces: [
        piece({ slotKey: "flower", mainStatKey: "hp", rarity: 5, level: 20 }),
      ],
    });
    assert.ok(low);
    assert.ok(maxed);
    assert.equal(maxed.flatHp, 4780);
    assert.ok(low.flatHp < maxed.flatHp);
    assert.equal(low.flatHp, artifactMainValue("hp", 4, 16));
  });

  it("computeBuildSheetStats bakes flower/plume, mains, and clamped subs", () => {
    const base = characterBaseByKey.get("HuTao");
    const homa = weaponByKey.get("StaffOfHoma");
    assert.ok(base);
    assert.ok(homa);

    const build: CharacterBuild = {
      key: "HuTao",
      cons: 0,
      level: 90,
      talents: { auto: 9, skill: 9, burst: 9 },
      weapon: { key: "StaffOfHoma", refinement: 1, level: 90 },
      set: { key: "CrimsonWitchOfFlames", count: 4 },
      main_stats: {
        sands: "hp_",
        goblet: "pyro_dmg_",
        circlet: "critRate_",
      },
      // 20 CR rolls clamp to 12 (4 eligible pieces × 3).
      substat_rolls: { critRate_: 20, critDMG_: 4, eleMas: 2 },
    };

    const sheet = computeBuildSheetStats(build);
    assert.ok(sheet);

    const clamped = clampSubstatRolls(build.substat_rolls, build.main_stats);
    assert.equal(clamped.critRate_, 12);
    assert.equal(clamped.critDMG_, 4);
    assert.equal(clamped.eleMas, 2);

    assert.equal(sheet.flatHp, 4780);
    assert.equal(sheet.flatAtk, 311);
    assert.equal(sheet.hpPct, ARTIFACT_MAIN_STAT_VALUE.hp_);
    assert.equal(sheet.dmgBonus.pyro_dmg_, ARTIFACT_MAIN_STAT_VALUE.pyro_dmg_);
    assert.ok(
      Math.abs(
        sheet.critRate -
          (base.baseCritRate +
            ARTIFACT_MAIN_STAT_VALUE.critRate_! +
            SUBSTAT_ROLL_VALUE.critRate_! * 12),
      ) < 1e-9,
    );
    assert.ok(
      Math.abs(
        sheet.critDMG -
          (base.baseCritDMG +
            (base.ascension.critDMG_ ?? 0) +
            homa.subStat!.value +
            SUBSTAT_ROLL_VALUE.critDMG_! * 4),
      ) < 1e-9,
    );
    assert.ok(
      Math.abs(sheet.eleMas - SUBSTAT_ROLL_VALUE.eleMas! * 2) < 1e-9,
    );
    assert.equal(sheet.hp, base.hp * (1 + sheet.hpPct) + sheet.flatHp);
    assert.equal(
      sheet.atk,
      (base.atk + homa.baseAtk) * (1 + sheet.atkPct) + sheet.flatAtk,
    );
  });
});

describe("formatSheetStat", () => {
  it("formats flats and percents", () => {
    assert.match(formatSheetStat("hp", 20332.3), /20.?332/);
    assert.equal(formatSheetStat("critRate", 0.461), "46.1%");
    assert.equal(formatSheetStat("pyro_dmg_", 0.466), "46.6%");
  });
});
