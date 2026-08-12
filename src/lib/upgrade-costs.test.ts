import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  CharacterUpgradeCosts,
  UpgradeCurves,
  WeaponUpgradeCosts,
} from "./types/upgrade-costs.ts";
import {
  diffCharacterUpgrade,
  diffWeaponUpgrade,
  expItemsNeeded,
  gateCharacterConfig,
  gateWeaponConfig,
  maxTalentForAscension,
  minAscensionForTalent,
  minLevelForAscension,
  sumLevelExp,
  UPGRADE_DEFAULTS,
} from "./upgrade-costs.ts";

const ROOT = resolve(process.cwd(), "scripts/data/output/upgrade-costs");

function loadCatalog() {
  const curves = JSON.parse(
    readFileSync(resolve(ROOT, "curves.json"), "utf8"),
  ) as UpgradeCurves;
  const characters = JSON.parse(
    readFileSync(resolve(ROOT, "characters.json"), "utf8"),
  ) as CharacterUpgradeCosts[];
  const weapons = JSON.parse(
    readFileSync(resolve(ROOT, "weapons.json"), "utf8"),
  ) as WeaponUpgradeCosts[];
  return { curves, characters, weapons };
}

describe("upgrade-costs math", () => {
  it("sums avatar EXP 1→90 as known total", () => {
    const { curves } = loadCatalog();
    const total = sumLevelExp(curves.avatarLevelExp, 1, 90);
    assert.equal(total, 8_362_650);
  });

  it("Hu Tao 1/0 + 1/1/1 → 90/6 + 9/9/9 has mora, exp, and materials", () => {
    const { curves, characters } = loadCatalog();
    const hutao = characters.find((c) => c.name_id === "Hutao");
    assert.ok(hutao, "Hutao costs missing — run extract-upgrade-costs");

    const result = diffCharacterUpgrade(
      hutao,
      curves,
      UPGRADE_DEFAULTS.characterStart,
      {
        level: 90,
        ascension: 6,
        talents: { normal: 9, skill: 9, burst: 9 },
      },
    );

    assert.ok(result.exp === 8_362_650);
    assert.ok(result.mora > 0);
    // Agate / silk flower / recruit's insignia appear in Hutao ascension.
    assert.ok((result.materials["104111"] ?? 0) >= 1);
    assert.ok((result.materials["100029"] ?? 0) >= 1);
    // Crown for talent 10 not needed for 9/9/9 — but books should appear.
    const matCount = Object.values(result.materials).reduce((a, b) => a + b, 0);
    assert.ok(matCount > 20);
  });

  it("identical start/target yields zero", () => {
    const { curves, characters } = loadCatalog();
    const hutao = characters.find((c) => c.name_id === "Hutao")!;
    const cfg = {
      level: 70,
      ascension: 4,
      talents: { normal: 6, skill: 6, burst: 6 },
    };
    const result = diffCharacterUpgrade(hutao, curves, cfg, cfg);
    assert.deepEqual(result, { mora: 0, exp: 0, materials: {} });
  });

  it("diffs a 5★ weapon 1→90", () => {
    const { curves, weapons } = loadCatalog();
    const weapon =
      weapons.find((w) => w.name === "Staff of Homa") ??
      weapons.find((w) => w.rankLevel === 5);
    assert.ok(weapon);
    const result = diffWeaponUpgrade(
      weapon,
      curves,
      UPGRADE_DEFAULTS.weaponStart,
      UPGRADE_DEFAULTS.weaponTarget,
    );
    assert.ok(result.exp > 0);
    assert.ok(result.mora > 0);
    assert.ok(Object.keys(result.materials).length > 0);
  });

  it("greedy EXP books cover the total", () => {
    const books = [
      { id: 104003, exp: 20_000 },
      { id: 104002, exp: 5_000 },
      { id: 104001, exp: 1_000 },
    ];
    const needed = expItemsNeeded(53_000, books);
    const covered = needed.reduce((sum, n) => {
      const book = books.find((b) => b.id === n.id)!;
      return sum + book.exp * n.count;
    }, 0);
    assert.ok(covered >= 53_000);
  });

  it("gates talent caps by ascension", () => {
    assert.equal(maxTalentForAscension(0), 1);
    assert.equal(maxTalentForAscension(2), 2);
    assert.equal(maxTalentForAscension(4), 6);
    assert.equal(maxTalentForAscension(6), 10);
    assert.equal(minAscensionForTalent(9), 6);
    assert.equal(minAscensionForTalent(2), 2);
  });

  it("gates level floors by ascension", () => {
    const { characters } = loadCatalog();
    const hutao = characters.find((c) => c.name_id === "Hutao")!;
    assert.equal(minLevelForAscension(hutao.promotes, 0), 1);
    assert.equal(minLevelForAscension(hutao.promotes, 1), 20);
    assert.equal(minLevelForAscension(hutao.promotes, 2), 40);
    assert.equal(minLevelForAscension(hutao.promotes, 6), 80);
  });

  it("gateCharacterConfig clamps level/talents and raises ascension", () => {
    const { characters } = loadCatalog();
    const hutao = characters.find((c) => c.name_id === "Hutao")!;
    const clamped = gateCharacterConfig(
      {
        level: 90,
        ascension: 0,
        talents: { normal: 9, skill: 1, burst: 1 },
      },
      hutao.promotes,
    );
    assert.equal(clamped.ascension, 6);
    assert.equal(clamped.level, 90);
    assert.equal(clamped.talents.normal, 9);

    const lowered = gateCharacterConfig(
      {
        level: 90,
        ascension: 2,
        talents: { normal: 10, skill: 10, burst: 10 },
      },
      hutao.promotes,
    );
    // Ascension rises to satisfy talent 10 (and level 90).
    assert.equal(lowered.ascension, 6);
    assert.equal(lowered.talents.normal, 10);

    const ascOnly = gateCharacterConfig(
      {
        level: 50,
        ascension: 2,
        talents: { normal: 10, skill: 1, burst: 1 },
      },
      hutao.promotes,
    );
    assert.equal(ascOnly.ascension, 6);
    // Asc 6 requires at least Lv 80.
    assert.equal(ascOnly.level, 80);
    assert.equal(ascOnly.talents.normal, 10);

    const downAsc = gateCharacterConfig(
      {
        level: 80,
        ascension: 2,
        talents: { normal: 6, skill: 1, burst: 1 },
      },
      hutao.promotes,
      { preferAscension: true },
    );
    assert.equal(downAsc.ascension, 2);
    assert.equal(downAsc.level, 50);
    assert.equal(downAsc.talents.normal, 2);

    const upAscFloor = gateCharacterConfig(
      {
        level: 1,
        ascension: 6,
        talents: { normal: 1, skill: 1, burst: 1 },
      },
      hutao.promotes,
      { preferAscension: true },
    );
    assert.equal(upAscFloor.ascension, 6);
    assert.equal(upAscFloor.level, 80);
  });

  it("gateWeaponConfig clamps level to ascension", () => {
    const { weapons } = loadCatalog();
    const weapon = weapons.find((w) => w.rankLevel === 5)!;
    const gated = gateWeaponConfig(
      { level: 90, ascension: 1 },
      weapon.promotes,
    );
    assert.equal(gated.ascension, 6);
    assert.equal(gated.level, 90);

    const low = gateWeaponConfig({ level: 45, ascension: 1 }, weapon.promotes);
    assert.equal(low.ascension, 2);
    assert.equal(low.level, 45);

    const forceDown = gateWeaponConfig(
      { level: 90, ascension: 1 },
      weapon.promotes,
      { preferAscension: true },
    );
    assert.equal(forceDown.ascension, 1);
    assert.equal(forceDown.level, 40);
  });
});
