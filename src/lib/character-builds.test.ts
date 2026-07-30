/**
 * Unit tests for character Builds-tab helpers.
 *
 * Run: pnpm test:unit
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  constellationImpactRows,
  levelImportanceFromBuilds,
  rankSigWeaponsByGain,
  rankWeaponsByRarityAndTeams,
  recommendedSubstatsFromBuilds,
  talentImportanceRows,
} from "./character-builds.ts";
import type { CharacterIndex } from "./types/investment.ts";

function builds(
  partial: Partial<CharacterIndex> &
    Pick<CharacterIndex, "main_stats" | "substat_rolls_liquid">,
): CharacterIndex {
  return {
    key: "Test",
    weapons: [],
    sets: [],
    ...partial,
  };
}

describe("recommendedSubstatsFromBuilds", () => {
  it("keeps liquid ranks above 0.5 and mains that can roll as subs", () => {
    const result = recommendedSubstatsFromBuilds(
      builds({
        main_stats: {
          sands: [{ key: "eleMas", teams: 3 }],
          goblet: [{ key: "hydro_dmg_", teams: 3 }],
          circlet: [{ key: "critRate_", teams: 3 }],
        },
        substat_rolls_liquid: {
          teams: 1,
          configs: 1,
          mean: {},
          ranked: [
            { key: "critDMG_", mean: 2.1 },
            { key: "atk_", mean: 0.2 },
            { key: "eleMas", mean: 0.1 },
          ],
        },
      }),
    );
    assert.deepEqual(
      result.map((r) => [r.key, r.matchesMain, r.mean]),
      [
        ["eleMas", true, 0.1],
        ["critRate_", true, 0],
        ["critDMG_", false, 2.1],
      ],
    );
  });
});

describe("rankWeaponsByRarityAndTeams", () => {
  it("sorts by rarity then team count", () => {
    const ranked = rankWeaponsByRarityAndTeams(
      [
        { key: "fourA", teams: 9 },
        { key: "fiveB", teams: 2 },
        { key: "fiveA", teams: 5 },
      ],
      (key) => (key.startsWith("five") ? 5 : 4),
    );
    assert.deepEqual(
      ranked.map((w) => w.key),
      ["fiveA", "fiveB", "fourA"],
    );
  });
});

describe("rankSigWeaponsByGain", () => {
  it("sorts and classifies by the stronger mean/median gain", () => {
    const ranked = rankSigWeaponsByGain([
      { key: "B", teams: 1, mean_pct_gain: 10, median_pct_gain: 10, min_pct_gain: 10, max_pct_gain: 10 },
      { key: "A", teams: 1, mean_pct_gain: 10, median_pct_gain: 10, min_pct_gain: 10, max_pct_gain: 10 },
      { key: "C", teams: 1, mean_pct_gain: 20, median_pct_gain: 8, min_pct_gain: 8, max_pct_gain: 20 },
    ]);
    assert.deepEqual(
      ranked.map((w) => [w.key, w.priority]),
      [
        ["C", "exceptional"],
        ["A", "solid"],
        ["B", "solid"],
      ],
    );
  });
});

describe("constellationImpactRows", () => {
  it("preserves source order and classifies each gain", () => {
    const rows = constellationImpactRows([
      {
        cons: 1,
        teams: 2,
        mean_pct_gain: 4,
        median_pct_gain: 6,
        min_pct_gain: 2,
        max_pct_gain: 7,
      },
      {
        cons: 2,
        teams: 2,
        mean_pct_gain: 21,
        median_pct_gain: 18,
        min_pct_gain: 15,
        max_pct_gain: 25,
      },
    ]);
    assert.deepEqual(
      rows.map((row) => [row.cons, row.pct, row.priorityLabel]),
      [
        [1, 6, "Modest impact"],
        [2, 21, "Exceptional impact"],
      ],
    );
  });
});

describe("talentImportanceRows / levelImportanceFromBuilds", () => {
  it("orders talent rows by max mean/median and classifies level impact", () => {
    const rows = talentImportanceRows(
      {
        teams: 2,
        auto: {
          mean_pct_drop: 3,
          median_pct_drop: 3,
          min_pct_drop: 3,
          max_pct_drop: 3,
        },
        skill: {
          mean_pct_drop: 12,
          median_pct_drop: 12,
          min_pct_drop: 12,
          max_pct_drop: 12,
        },
        burst: {
          mean_pct_drop: 5,
          median_pct_drop: 5,
          min_pct_drop: 5,
          max_pct_drop: 5,
        },
        priority: ["skill", "burst", "auto"],
      },
      (kitType) => `icon:${kitType}`,
    );
    assert.deepEqual(
      rows.map((r) => [r.slot, r.icon, r.priority]),
      [
        ["skill", "icon:skill", "exceptional"],
        ["burst", "icon:burst", "solid"],
        ["auto", "icon:normal", "modest"],
      ],
    );

    const level = levelImportanceFromBuilds(
      builds({
        main_stats: { sands: [], goblet: [], circlet: [] },
        substat_rolls_liquid: { teams: 0, configs: 0, mean: {}, ranked: [] },
        level_importance: {
          teams: 2,
          mean_pct_drop: 6,
          median_pct_drop: 6,
          min_pct_drop: 6,
          max_pct_drop: 6,
        },
      }),
    );
    assert.equal(level?.priority, "high");
  });
});
