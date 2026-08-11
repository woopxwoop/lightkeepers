/**
 * Unit tests for character Builds-tab helpers.
 *
 * Run: pnpm test:unit
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  constellationImpactRows,
  constellationPrioritySection,
  formatReactionFingerprint,
  formatReactionName,
  levelImportanceFromBuilds,
  ascensionImportanceFromBuilds,
  levelPrioritySection,
  rankSigWeaponsByGain,
  rankWeaponsByRarityAndTeams,
  recommendedSubstatsFromBuilds,
  sigWeaponPrioritySection,
  talentImportanceRows,
  talentPrioritySection,
  useGuideSection,
} from "./character-builds.ts";
import type {
  CharacterIndex,
  CharacterTalentImportance,
} from "./types/investment.ts";

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

  it("keeps guide-authored ranks when there are no measured teams", () => {
    const result = recommendedSubstatsFromBuilds(
      builds({
        main_stats: {
          sands: [{ key: "def_", teams: 0 }],
          goblet: [{ key: "def_", teams: 0 }],
          circlet: [
            { key: "critRate_", teams: 0 },
            { key: "critDMG_", teams: 0 },
          ],
        },
        substat_rolls_liquid: {
          teams: 0,
          configs: 0,
          mean: { enerRech_: 0, eleMas: 0 },
          ranked: [
            { key: "enerRech_", mean: 0 },
            { key: "eleMas", mean: 0 },
          ],
        },
      }),
    );
    assert.deepEqual(
      result.map((r) => r.key),
      ["critDMG_", "critRate_", "def_", "eleMas", "enerRech_"],
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

  it("prefers measured sigs when rarity and teams tie", () => {
    const ranked = rankWeaponsByRarityAndTeams(
      [
        { key: "SurfsUp", teams: 5 },
        { key: "TomeOfTheEternalFlow", teams: 5 },
        { key: "PrototypeAmber", teams: 5 },
      ],
      () => 5,
      ["TomeOfTheEternalFlow"],
    );
    assert.deepEqual(
      ranked.map((w) => w.key),
      ["TomeOfTheEternalFlow", "PrototypeAmber", "SurfsUp"],
    );
  });

  it("sorts by Bradley-Terry strength before team count", () => {
    const ranked = rankWeaponsByRarityAndTeams(
      [
        { key: "SurfsUp", teams: 5, strength: 0.9 },
        { key: "TomeOfTheEternalFlow", teams: 5, strength: 1.2 },
        { key: "PrototypeAmber", teams: 8, strength: 0.7 },
      ],
      () => 5,
    );
    assert.deepEqual(
      ranked.map((w) => w.key),
      ["TomeOfTheEternalFlow", "SurfsUp", "PrototypeAmber"],
    );
  });
});

describe("rankSigWeaponsByGain", () => {
  it("sorts and classifies by the stronger mean/median gain", () => {
    const ranked = rankSigWeaponsByGain([
      {
        key: "B",
        teams: 1,
        mean_pct_gain: 10,
        median_pct_gain: 10,
        min_pct_gain: 10,
        max_pct_gain: 10,
      },
      {
        key: "A",
        teams: 1,
        mean_pct_gain: 10,
        median_pct_gain: 10,
        min_pct_gain: 10,
        max_pct_gain: 10,
      },
      {
        key: "C",
        teams: 1,
        mean_pct_gain: 20,
        median_pct_gain: 8,
        min_pct_gain: 8,
        max_pct_gain: 20,
      },
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

  it("sorts non-finite gains last", () => {
    const ranked = rankSigWeaponsByGain([
      {
        key: "nan",
        teams: 1,
        mean_pct_gain: Number.NaN,
        median_pct_gain: Number.NaN,
        min_pct_gain: 0,
        max_pct_gain: 0,
      },
      {
        key: "small",
        teams: 1,
        mean_pct_gain: 1,
        median_pct_gain: 1,
        min_pct_gain: 1,
        max_pct_gain: 1,
      },
      {
        key: "infinite",
        teams: 1,
        mean_pct_gain: Number.POSITIVE_INFINITY,
        median_pct_gain: 0,
        min_pct_gain: 0,
        max_pct_gain: 0,
      },
      {
        key: "big",
        teams: 1,
        mean_pct_gain: 24,
        median_pct_gain: 24,
        min_pct_gain: 24,
        max_pct_gain: 24,
      },
    ]);
    assert.deepEqual(
      ranked.map((w) => w.key),
      ["big", "small", "infinite", "nan"],
    );
  });

  it("prefers merge-stamped tiers over the fixed ladder", () => {
    const ranked = rankSigWeaponsByGain(
      [
        {
          key: "small_but_stamped",
          teams: 1,
          mean_pct_gain: 1,
          median_pct_gain: 1,
          min_pct_gain: 1,
          max_pct_gain: 1,
          tier: "exceptional",
        },
        {
          key: "big_unstamped",
          teams: 1,
          mean_pct_gain: 24,
          median_pct_gain: 24,
          min_pct_gain: 24,
          max_pct_gain: 24,
        },
      ],
      {
        floors: {
          exceptional: 7.83,
          high: 4.11,
          solid: 0.79,
          negligible: 0,
        },
        labels: {
          exceptional: "Exceptional impact",
          high: "High impact",
          solid: "Solid impact",
          modest: "Modest impact",
          negligible: "Negligible impact",
        },
      },
    );
    assert.deepEqual(
      ranked.map((w) => [w.key, w.priority, w.priorityLabel]),
      [
        ["big_unstamped", "exceptional", "Exceptional impact"],
        ["small_but_stamped", "exceptional", "Exceptional impact"],
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

  it("classifies measured constellation gains on the five-band ladder", () => {
    const rows = constellationImpactRows([
      {
        cons: 1,
        teams: 2,
        mean_pct_gain: 30,
        median_pct_gain: 30,
        min_pct_gain: 30,
        max_pct_gain: 30,
      },
    ]);
    assert.deepEqual(
      rows.map((row) => [row.priority, row.priorityLabel]),
      [["exceptional", "Exceptional impact"]],
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

    const ascension = ascensionImportanceFromBuilds(
      builds({
        main_stats: { sands: [], goblet: [], circlet: [] },
        substat_rolls_liquid: { teams: 0, configs: 0, mean: {}, ranked: [] },
        ascension_importance: {
          teams: 1,
          mean_pct_drop: 3,
          median_pct_drop: 3,
          min_pct_drop: 3,
          max_pct_drop: 3,
        },
      }),
    );
    assert.equal(ascension?.priority, "modest");
    assert.equal(ascension?.mean, 3);
  });

  it("hides talent/level rows when teams are zero", () => {
    assert.equal(
      talentImportanceRows(
        {
          teams: 0,
          auto: {
            mean_pct_drop: 0,
            median_pct_drop: 0,
            min_pct_drop: 0,
            max_pct_drop: 0,
          },
          skill: {
            mean_pct_drop: 0,
            median_pct_drop: 0,
            min_pct_drop: 0,
            max_pct_drop: 0,
          },
          burst: {
            mean_pct_drop: 0,
            median_pct_drop: 0,
            min_pct_drop: 0,
            max_pct_drop: 0,
          },
          priority: ["auto", "skill", "burst"],
        },
        () => null,
      ).length,
      0,
    );
    assert.equal(
      levelImportanceFromBuilds(
        builds({
          main_stats: { sands: [], goblet: [], circlet: [] },
          substat_rolls_liquid: { teams: 0, configs: 0, mean: {}, ranked: [] },
          level_importance: {
            teams: 0,
            mean_pct_drop: 0,
            median_pct_drop: 0,
            min_pct_drop: 0,
            max_pct_drop: 0,
          },
        }),
      ),
      null,
    );
  });
});

describe("guide vs sim section selection", () => {
  const emptyShell = {
    main_stats: {
      sands: [],
      goblet: [],
      circlet: [],
    } as CharacterIndex["main_stats"],
    substat_rolls_liquid: {
      teams: 0,
      configs: 0,
      mean: {},
      ranked: [],
    },
  };

  const simTalent: CharacterTalentImportance = {
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
  };

  it("fills missing sim sections from guide_priority by default", () => {
    assert.equal(useGuideSection({ override: false }, true, false), true);
    assert.equal(useGuideSection({ override: false }, true, true), false);
    assert.equal(useGuideSection({ override: true }, true, true), true);
    assert.equal(useGuideSection({ override: true }, false, true), false);

    const section = talentPrioritySection(
      builds({
        ...emptyShell,
        guide_priority: {
          override: false,
          talent_priority: ["burst", "skill", "auto"],
        },
      }),
      (kitType) => `icon:${kitType}`,
    );
    assert.equal(section?.source, "guide");
    assert.deepEqual(
      section?.source === "guide"
        ? section.rows.map((r) => [r.slot, r.icon])
        : null,
      [
        ["burst", "icon:burst"],
        ["skill", "icon:skill"],
        ["auto", "icon:normal"],
      ],
    );

    assert.deepEqual(
      levelPrioritySection(
        builds({
          ...emptyShell,
          guide_priority: { override: false, level_90: true },
        }),
      ),
      {
        source: "guide",
        simMissing: true,
        priority: "solid",
        priorityLabel: "Recommended",
      },
    );

    const cons = constellationPrioritySection(
      builds({
        ...emptyShell,
        guide_priority: { override: false, constellations: [2, 1] },
      }),
    );
    assert.equal(cons?.source, "guide");
    assert.deepEqual(
      cons?.source === "guide"
        ? cons.rows.map((r) => [r.cons, r.priority, r.priorityLabel])
        : null,
      [
        [1, "high", "High impact"],
        [2, "high", "High impact"],
      ],
    );

    const sigs = sigWeaponPrioritySection(
      builds({
        ...emptyShell,
        guide_priority: {
          override: false,
          sig_weapons: ["Elegy", "Skyward"],
        },
      }),
    );
    assert.equal(sigs?.source, "guide");
    assert.deepEqual(
      sigs?.source === "guide"
        ? sigs.rows.map((r) => [r.key, r.priority, r.priorityLabel])
        : null,
      [
        ["Elegy", "high", "High impact"],
        ["Skyward", "high", "High impact"],
      ],
    );
  });

  it("marks guide sections that replace existing sim data as measured", () => {
    const section = constellationPrioritySection(
      builds({
        ...emptyShell,
        vertical_importance: {
          constellations: [
            {
              cons: 1,
              teams: 2,
              mean_pct_gain: 20,
              median_pct_gain: 20,
              min_pct_gain: 20,
              max_pct_gain: 20,
            },
          ],
          sig_weapons: [],
        },
        guide_priority: { override: true, constellations: [2] },
      }),
    );
    assert.equal(section?.source, "guide");
    assert.equal(
      section?.source === "guide" ? section.simMissing : null,
      false,
    );
  });

  it("keeps measured five-band rows when sim data exists and override is off", () => {
    const section = talentPrioritySection(
      builds({
        ...emptyShell,
        talent_importance: simTalent,
        guide_priority: {
          override: false,
          talent_priority: ["burst", "auto", "skill"],
        },
      }),
      () => null,
    );
    assert.equal(section?.source, "sim");
    assert.deepEqual(
      section?.source === "sim"
        ? section.rows.map((r) => [r.slot, r.priority])
        : null,
      [
        ["skill", "exceptional"],
        ["burst", "solid"],
        ["auto", "modest"],
      ],
    );
  });

  it("replaces authored sections when override is true, leaving omitted sections on sim", () => {
    const talent = talentPrioritySection(
      builds({
        ...emptyShell,
        talent_importance: simTalent,
        level_importance: {
          teams: 2,
          mean_pct_drop: 6,
          median_pct_drop: 6,
          min_pct_drop: 6,
          max_pct_drop: 6,
        },
        guide_priority: {
          override: true,
          talent_priority: ["burst", "skill", "auto"],
          // level_90 omitted → keep sim level
        },
      }),
      () => null,
    );
    assert.equal(talent?.source, "guide");
    assert.deepEqual(
      talent?.source === "guide" ? talent.rows.map((r) => r.slot) : null,
      ["burst", "skill", "auto"],
    );

    const level = levelPrioritySection(
      builds({
        ...emptyShell,
        level_importance: {
          teams: 2,
          mean_pct_drop: 6,
          median_pct_drop: 6,
          min_pct_drop: 6,
          max_pct_drop: 6,
        },
        guide_priority: {
          override: true,
          talent_priority: ["burst", "skill", "auto"],
        },
      }),
    );
    assert.equal(level?.source, "sim");
    assert.equal(level?.source === "sim" ? level.row.priority : null, "high");
  });
});

describe("reaction helpers", () => {
  it("formats reaction names and fingerprints", () => {
    assert.equal(formatReactionName("lunarcharged"), "Lunar-Charged");
    assert.equal(formatReactionName("swirl-electro"), "Swirl (Electro)");
    assert.equal(formatReactionName("mystery-reaction"), "Mystery Reaction");
    assert.equal(formatReactionFingerprint(null), "No reactions");
    assert.equal(
      formatReactionFingerprint("bloom+swirl-hydro"),
      "Bloom + Swirl (Hydro)",
    );
  });
});
