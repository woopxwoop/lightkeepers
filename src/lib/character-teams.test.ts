/**
 * Unit tests for character-page team ranking helpers.
 *
 * Run: pnpm test:unit
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bestSimAtCost,
  dimmedKeysFromGoodKeys,
  handBuilds,
  topSimTeamsForCharacter,
} from "./character-teams.ts";
import type { InvestmentSim, InvestmentTeam } from "./types/investment.ts";

function sim(cost: number, dps: number, keys: string[] = []): InvestmentSim {
  return {
    state_key: `c${cost}-d${dps}`,
    label: `cost ${cost}`,
    kind: "baseline",
    cost,
    dps,
    characters: keys.map((key) => ({
      key,
      cons: 0,
      weapon: { key: "w", refinement: 1, level: 90 },
      set: { key: "s", count: 4 },
      main_stats: { sands: "atk_", goblet: "ele", circlet: "critRate_" },
      level: 90,
      talents: { auto: 9, skill: 9, burst: 9 },
    })),
  };
}

function team(keys: string[], results: InvestmentSim[]): InvestmentTeam {
  return {
    version: 1,
    team_key: keys.join("-"),
    team_name: keys.join(" / "),
    baseline_cost: 4,
    characters: keys,
    results,
  };
}

describe("bestSimAtCost", () => {
  it("returns null when no sim matches the cost", () => {
    const t = team(["A"], [sim(2, 100), sim(4, 200)]);
    assert.equal(bestSimAtCost(t, 3), null);
  });

  it("picks the highest DPS among sims at the exact cost", () => {
    const t = team(["A"], [sim(4, 100), sim(4, 250), sim(4, 180), sim(2, 999)]);
    const best = bestSimAtCost(t, 4);
    assert.ok(best);
    assert.equal(best.dps, 250);
    assert.equal(best.cost, 4);
  });
});

describe("topSimTeamsForCharacter", () => {
  it("returns empty when no team features the key or cost", () => {
    const teams = [
      team(["B", "C"], [sim(4, 100)]),
      team(["A", "B"], [sim(2, 200)]),
    ];
    assert.deepEqual(topSimTeamsForCharacter(teams, "A", 4), []);
  });

  it("filters to the character, ranks by DPS, and respects the limit", () => {
    const low = team(["A", "X"], [sim(4, 100)]);
    const mid = team(["A", "Y"], [sim(4, 200)]);
    const high = team(["A", "Z"], [sim(4, 300)]);
    const other = team(["B", "C"], [sim(4, 999)]);

    const ranked = topSimTeamsForCharacter([low, other, high, mid], "A", 4, 2);
    assert.equal(ranked.length, 2);
    assert.equal(ranked[0]!.dps, 300);
    assert.equal(ranked[0]!.team.team_key, "A-Z");
    assert.equal(ranked[1]!.dps, 200);
  });
});

describe("dimmedKeysFromGoodKeys", () => {
  it("falls back from missing name_id to name and skips owned or unresolved keys", () => {
    const goodKeyMap = new Map([
      ["hutao", { name_id: "Hutao", name: "Hu Tao" }],
      ["yelan", { name: "Yelan" }],
      ["ghost", {}],
    ]);
    const owned = new Set(["hutao"]);

    const dimmed = dimmedKeysFromGoodKeys(
      ["hutao", "yelan", "ghost", "missing"],
      owned,
      goodKeyMap,
    );

    assert.deepEqual([...dimmed].sort(), ["Yelan"]);
  });
});

describe("handBuilds", () => {
  it("returns all-null slots when sim is null", () => {
    const t = team(["A", "B"], [sim(4, 100, ["A", "B"])]);
    assert.deepEqual(handBuilds(t, null), [null, null]);
  });

  it("maps cons/weapon for present keys and nulls absent ones", () => {
    const t = team(["A", "B"], []);
    const s = sim(4, 100, ["A"]);
    s.characters[0]!.cons = 2;
    s.characters[0]!.weapon = {
      key: "StaffOfHoma",
      refinement: 5,
      level: 90,
    };

    assert.deepEqual(handBuilds(t, s), [
      { cons: 2, weaponRefinement: 5, weaponKey: "StaffOfHoma" },
      null,
    ]);
  });
});
