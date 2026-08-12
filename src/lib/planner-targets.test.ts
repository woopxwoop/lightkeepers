/**
 * Unit tests for planner target autofill from Builds impact tiers.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ascensionFromImportanceTier,
  CHARACTER_LEVEL_BY_TIER,
  characterLevelFromTier,
  plannerTargetFromBuilds,
  TALENT_LEVEL_BY_TIER,
  talentLevelFromTier,
} from "./planner-targets.ts";
import type {
  CharacterIndex,
  ImportanceImpactTier,
} from "./types/investment.ts";
import type { UpgradePromoteStep } from "./types/upgrade-costs.ts";

const PROMOTES: UpgradePromoteStep[] = [
  { promoteLevel: 0, mora: 0, unlockMaxLevel: 20, items: [] },
  { promoteLevel: 1, mora: 0, unlockMaxLevel: 40, items: [] },
  { promoteLevel: 2, mora: 0, unlockMaxLevel: 50, items: [] },
  { promoteLevel: 3, mora: 0, unlockMaxLevel: 60, items: [] },
  { promoteLevel: 4, mora: 0, unlockMaxLevel: 70, items: [] },
  { promoteLevel: 5, mora: 0, unlockMaxLevel: 80, items: [] },
  { promoteLevel: 6, mora: 0, unlockMaxLevel: 90, items: [] },
];

function slot(tier: ImportanceImpactTier | null, mean = 10) {
  return {
    mean_pct_drop: mean,
    median_pct_drop: mean,
    min_pct_drop: mean,
    max_pct_drop: mean,
    tier,
  };
}

function importance(
  tier: ImportanceImpactTier,
): NonNullable<CharacterIndex["level_importance"]> {
  return {
    teams: 3,
    mean_pct_drop: 5,
    median_pct_drop: 5,
    min_pct_drop: 5,
    max_pct_drop: 5,
    tier,
  };
}

function builds(partial: {
  talent?: Partial<NonNullable<CharacterIndex["talent_importance"]>>;
  level?: Partial<NonNullable<CharacterIndex["level_importance"]>> | null;
  ascension?: Partial<
    NonNullable<CharacterIndex["ascension_importance"]>
  > | null;
}): CharacterIndex {
  return {
    key: "Test",
    weapons: [],
    sets: [],
    main_stats: { sands: [], goblet: [], circlet: [] },
    substat_rolls_liquid: { teams: 0, configs: 0, mean: {}, ranked: [] },
    talent_importance: {
      teams: 3,
      auto: slot("high"),
      skill: slot("solid"),
      burst: slot("negligible"),
      priority: ["auto", "skill", "burst"],
      ...partial.talent,
    },
    level_importance:
      partial.level === null
        ? undefined
        : {
            ...importance("solid"),
            ...partial.level,
          },
    ascension_importance:
      partial.ascension == null
        ? undefined
        : {
            ...importance("solid"),
            ...partial.ascension,
          },
  };
}

describe("planner tier → number maps", () => {
  it("maps talent and level tiers to the agreed stops", () => {
    assert.equal(talentLevelFromTier("exceptional"), 10);
    assert.equal(talentLevelFromTier("high"), 10);
    assert.equal(talentLevelFromTier("solid"), 9);
    assert.equal(talentLevelFromTier("modest"), 8);
    assert.equal(talentLevelFromTier("negligible"), 1);
    assert.equal(characterLevelFromTier("exceptional"), 90);
    assert.equal(characterLevelFromTier("high"), 90);
    assert.equal(characterLevelFromTier("solid"), 90);
    assert.equal(characterLevelFromTier("modest"), 80);
    assert.equal(characterLevelFromTier("negligible"), 70);
    assert.equal(TALENT_LEVEL_BY_TIER.high, 10);
    assert.equal(CHARACTER_LEVEL_BY_TIER.negligible, 70);
  });

  it("maps ascension importance to A6 only for exceptional/high/solid", () => {
    assert.equal(ascensionFromImportanceTier("exceptional"), 6);
    assert.equal(ascensionFromImportanceTier("high"), 6);
    assert.equal(ascensionFromImportanceTier("solid"), 6);
    assert.equal(ascensionFromImportanceTier("modest"), 0);
    assert.equal(ascensionFromImportanceTier("negligible"), 0);
    assert.equal(ascensionFromImportanceTier(null), 0);
  });
});

describe("plannerTargetFromBuilds", () => {
  it("maps stamped talent + level tiers", () => {
    const target = plannerTargetFromBuilds(
      builds({
        talent: {
          auto: slot("exceptional"),
          skill: slot("modest"),
          burst: slot("negligible"),
        },
        level: { tier: "high" },
      }),
      PROMOTES,
    );
    assert.equal(target.talents.normal, 10);
    assert.equal(target.talents.skill, 8);
    assert.equal(target.talents.burst, 1);
    assert.equal(target.level, 90);
    assert.equal(target.ascension, 6);
  });

  it("floors modest level to A6 / 80 when a talent needs crowns, not 90", () => {
    const target = plannerTargetFromBuilds(
      builds({
        talent: {
          auto: slot("high"),
          skill: slot("solid"),
          burst: slot("solid"),
        },
        level: { tier: "modest" },
      }),
      PROMOTES,
    );
    assert.equal(target.talents.normal, 10);
    assert.equal(target.level, 80);
    assert.equal(target.ascension, 6);
  });

  it("keeps negligible level at 70 when talents stay low", () => {
    const target = plannerTargetFromBuilds(
      builds({
        talent: {
          auto: slot("negligible"),
          skill: slot("negligible"),
          burst: slot("negligible"),
        },
        level: { tier: "negligible" },
      }),
      PROMOTES,
    );
    assert.equal(target.talents.normal, 1);
    assert.equal(target.level, 70);
    assert.equal(target.ascension, 4);
  });

  it("forces A6 when ascension importance is solid even with low talents", () => {
    const target = plannerTargetFromBuilds(
      builds({
        talent: {
          auto: slot("negligible"),
          skill: slot("negligible"),
          burst: slot("negligible"),
        },
        level: { tier: "modest" },
        ascension: { tier: "solid" },
      }),
      PROMOTES,
    );
    assert.equal(target.level, 80);
    assert.equal(target.ascension, 6);
  });

  it("does not force A6 when ascension importance is modest", () => {
    const target = plannerTargetFromBuilds(
      builds({
        talent: {
          auto: slot("negligible"),
          skill: slot("negligible"),
          burst: slot("negligible"),
        },
        level: { tier: "modest" },
        ascension: { tier: "modest" },
      }),
      PROMOTES,
    );
    assert.equal(target.level, 80);
    assert.equal(target.ascension, 5);
  });

  it("falls back to 70/70 with 1/1/1 when Builds importance is missing", () => {
    const target = plannerTargetFromBuilds(
      {
        key: "Empty",
        weapons: [],
        sets: [],
        main_stats: { sands: [], goblet: [], circlet: [] },
        substat_rolls_liquid: { teams: 0, configs: 0, mean: {}, ranked: [] },
      },
      PROMOTES,
    );
    assert.equal(target.talents.normal, 1);
    assert.equal(target.talents.skill, 1);
    assert.equal(target.talents.burst, 1);
    assert.equal(target.level, 70);
    assert.equal(target.ascension, 4);
  });
});
