import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  activeBuildExample,
  alternateBuildExamples,
  exampleCardTier,
  kitConstellation,
  kitSkillIcon,
  substatUsageLabel,
} from "./character-builds-panel.ts";
import type { CharacterKit } from "#lib/types/character-kit.js";
import type { CharacterBuildExample } from "#lib/types/investment.js";

function example(
  stateKey: string,
  overrides: Partial<CharacterBuildExample> = {},
): CharacterBuildExample {
  return {
    team_key: `team-${stateKey}`,
    team_name: `Team ${stateKey}`,
    characters: ["Xilonen", "A", "B", "C"],
    state_key: stateKey,
    reactions: {} as CharacterBuildExample["reactions"],
    invest: "mid",
    artifact_pct_gain: 0,
    key: "Xilonen",
    cons: 0,
    level: 90,
    talents: { auto: 1, skill: 9, burst: 9 },
    weapon: { key: "FavoniusSword", level: 90, refinement: 5 },
    set: "ScrollOfTheHeroOfCinderCity",
    main_stats: { sands: "enerRech_", goblet: "def_", circlet: "def_" },
    substat_rolls: {},
    substat_rolls_liquid: {},
    ...overrides,
  } as CharacterBuildExample;
}

const kit = {
  skills: [
    { id: 1, type: "normal", name: "N", description: "", icon: "Skill_A_01" },
    { id: 2, type: "skill", name: "E", description: "", icon: "Skill_S_X_01" },
  ],
  constellations: [
    {
      id: 11,
      index: 1,
      name: "First",
      description: "",
      icon: "UI_Talent_S_X_01",
    },
  ],
} as Pick<CharacterKit, "skills" | "constellations">;

describe("activeBuildExample", () => {
  const list = [example("a"), example("b"), example("c")];

  it("returns null for an empty list", () => {
    assert.equal(activeBuildExample([], "a"), null);
  });

  it("defaults to the first example when nothing matches", () => {
    assert.equal(activeBuildExample(list, "")?.state_key, "a");
    assert.equal(activeBuildExample(list, "missing")?.state_key, "a");
  });

  it("returns the picked example", () => {
    assert.equal(activeBuildExample(list, "b")?.state_key, "b");
  });
});

describe("alternateBuildExamples", () => {
  it("drops the active example and keeps order", () => {
    const list = [example("a"), example("b"), example("c")];
    assert.deepEqual(
      alternateBuildExamples(list, list[1] ?? null).map((e) => e.state_key),
      ["a", "c"],
    );
  });

  it("keeps everything when nothing is active", () => {
    const list = [example("a"), example("b")];
    assert.equal(alternateBuildExamples(list, null).length, 2);
  });
});

describe("exampleCardTier", () => {
  it("uses high only for high-invest examples with high rolls", () => {
    assert.equal(exampleCardTier(example("a")), "mid");
    assert.equal(exampleCardTier(example("a", { invest: "high" })), "mid");
    assert.equal(
      exampleCardTier(
        example("a", { invest: "high", high_substat_rolls: { critRate_: 10 } }),
      ),
      "high",
    );
  });
});

describe("kitSkillIcon", () => {
  it("resolves the skill icon for a slot", () => {
    assert.match(kitSkillIcon(kit, "skill") ?? "", /Skill_S_X_01/);
  });

  it("returns null when the slot has no skill", () => {
    assert.equal(kitSkillIcon(kit, "burst"), null);
  });
});

describe("kitConstellation", () => {
  it("resolves name and icon for a known constellation", () => {
    const c = kitConstellation(kit, 1);
    assert.equal(c.name, "First");
    assert.match(c.icon ?? "", /UI_Talent_S_X_01/);
  });

  it("falls back to C{n} without an icon", () => {
    assert.deepEqual(kitConstellation(kit, 4), { name: "C4", icon: null });
  });
});

describe("substatUsageLabel", () => {
  it("formats mean, source phrase, and plural teams", () => {
    assert.equal(
      substatUsageLabel({ mean: 4.26, source: "high", teams: 3 }),
      "4.3 avg high liquid · 3 teams",
    );
  });

  it("uses singular for one team", () => {
    assert.equal(
      substatUsageLabel({ mean: 2, source: "guide", teams: 1 }),
      "2.0 avg liquid rolls · 1 team",
    );
  });
});
