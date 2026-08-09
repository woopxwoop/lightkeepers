/**
 * Unit tests for Teams-page investment list helpers.
 *
 * Run: pnpm test:unit
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allTeamCharacterKeys,
  availableInvestmentCosts,
  baselineSim,
  baselineVariants,
  displayDps,
  displaySim,
  exactCostDps,
  findInvestmentTeam,
  groupVerticalSimsByCost,
  ownsInvestmentTeam,
  simAtExactCost,
  sortTeamsForDisplay,
  teamsMatchingTags,
  teamsWithExactCost,
} from "./investment-teams.ts";
import type {
  InvestmentFile,
  InvestmentSim,
  InvestmentTeam,
} from "./types/investment.ts";

function sim(
  partial: Partial<InvestmentSim> & Pick<InvestmentSim, "cost" | "dps">,
): InvestmentSim {
  return {
    state_key: `c${partial.cost}-d${partial.dps}-${partial.kind ?? "baseline"}`,
    label: partial.label ?? `cost ${partial.cost}`,
    kind: partial.kind ?? "baseline",
    cost: partial.cost,
    dps: partial.dps,
    characters: [],
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

describe("baselineSim / simAtExactCost", () => {
  it("finds the baseline kind and first exact-cost sim", () => {
    const t = team(
      ["A"],
      [
        sim({ cost: 2, dps: 100, kind: "f2p" }),
        sim({ cost: 4, dps: 200, kind: "baseline" }),
        sim({ cost: 4, dps: 250, kind: "vertical" }),
      ],
    );
    assert.equal(baselineSim(t)?.dps, 200);
    assert.equal(simAtExactCost(t, 4)?.dps, 200);
    assert.equal(simAtExactCost(t, 3), null);
  });
});

describe("baselineVariants / groupVerticalSimsByCost", () => {
  it("lists floor + owned variants by DPS and groups verticals by cost", () => {
    const t = team(
      ["A"],
      [
        sim({ cost: 2, dps: 100, kind: "f2p" }),
        sim({ cost: 2, dps: 150, kind: "baseline" }),
        sim({ cost: 3, dps: 180, kind: "owned" }),
        sim({ cost: 4, dps: 200, kind: "vertical" }),
        sim({ cost: 4, dps: 250, kind: "vertical" }),
        sim({ cost: 6, dps: 300, kind: "vertical" }),
      ],
    );
    assert.deepEqual(
      baselineVariants(t).map((r) => r.dps),
      [180, 150, 100],
    );
    const groups = groupVerticalSimsByCost(t);
    assert.deepEqual(
      groups.map((g) => [g.cost, g.sims.map((s) => s.dps)]),
      [
        [4, [250, 200]],
        [6, [300]],
      ],
    );
  });

  it("finds a team by key in an investment file", () => {
    const a = team(["A"], [sim({ cost: 4, dps: 1 })]);
    const file: InvestmentFile = {
      teams: [a],
      available_costs: [4],
    };
    assert.equal(findInvestmentTeam(file, a.team_key), a);
    assert.equal(findInvestmentTeam(file, "missing"), null);
    assert.equal(findInvestmentTeam(null, a.team_key), null);
  });
});

describe("exactCostDps", () => {
  it("returns 0 for an empty results list", () => {
    assert.equal(exactCostDps(team(["A"], []), 4), 0);
  });

  it("skips owned sims so they do not win cost-filter peaks", () => {
    const t = team(
      ["A"],
      [
        sim({ cost: 2, dps: 100, kind: "baseline" }),
        sim({ cost: 3, dps: 400, kind: "owned" }),
        sim({ cost: 3, dps: 250, kind: "vertical" }),
      ],
    );
    assert.equal(exactCostDps(t, 3), 250);
    assert.equal(simAtExactCost(t, 3)?.kind, "vertical");
    assert.equal(simAtExactCost(t, 3)?.dps, 250);
  });

  it("returns the best exact-cost result and never falls back", () => {
    const t = team(
      ["A"],
      [
        sim({ cost: 2, dps: 100 }),
        sim({ cost: 6, dps: 300 }),
        sim({ cost: 6, dps: 350 }),
        sim({ cost: 8, dps: 400 }),
      ],
    );
    assert.equal(exactCostDps(t, 6), 350);
    assert.equal(exactCostDps(t, 5), 0);
  });
});

describe("displayDps / displaySim", () => {
  it("uses baseline when no cost is selected", () => {
    const t = team(
      ["A"],
      [
        sim({ cost: 2, dps: 100, kind: "f2p" }),
        sim({ cost: 4, dps: 200, kind: "baseline" }),
      ],
    );
    assert.equal(displayDps(t, null), 200);
    assert.equal(displaySim(t, null)?.kind, "baseline");
  });

  it("uses exact cost when a cost is selected", () => {
    const t = team(
      ["A"],
      [
        sim({ cost: 2, dps: 100, kind: "f2p" }),
        sim({ cost: 4, dps: 200, kind: "baseline" }),
      ],
    );
    assert.equal(displayDps(t, 4), 200);
    assert.equal(displayDps(t, 3), 0);
    assert.equal(displaySim(t, 4)?.dps, 200);
    assert.equal(displaySim(t, 3), null);
  });
});

describe("filter helpers", () => {
  const a = team(["A", "B"], [sim({ cost: 2, dps: 100 })]);
  const b = team(["A", "C"], [sim({ cost: 4, dps: 200 })]);
  const c = team(["B", "C"], [sim({ cost: 4, dps: 300 })]);

  it("matches character tags as an intersection", () => {
    assert.deepEqual(teamsMatchingTags([a, b, c], []), [a, b, c]);
    assert.deepEqual(teamsMatchingTags([a, b, c], ["A"]), [a, b]);
    assert.deepEqual(teamsMatchingTags([a, b, c], ["A", "C"]), [b]);
  });

  it("keeps teams with an exact cost sim", () => {
    assert.deepEqual(teamsWithExactCost([a, b, c], 4), [b, c]);
  });

  it("collects unique character keys and costs", () => {
    assert.deepEqual(allTeamCharacterKeys([c, b, a]), ["A", "B", "C"]);
    assert.deepEqual(
      availableInvestmentCosts({
        teams: [a, b, c],
        available_costs: [],
      }),
      [2, 4],
    );
    assert.deepEqual(
      availableInvestmentCosts({
        teams: [a, b, c],
        available_costs: [0, 2, 4],
      }),
      [0, 2, 4],
    );
  });
});

describe("sortTeamsForDisplay", () => {
  const owned = team(
    ["A", "B"],
    [sim({ cost: 4, dps: 100, kind: "baseline" })],
  );
  const mid = team(["A", "C"], [sim({ cost: 4, dps: 200, kind: "baseline" })]);
  const high = team(["X", "Y"], [sim({ cost: 4, dps: 300, kind: "baseline" })]);
  const noCost = team(
    ["A", "Z"],
    [sim({ cost: 2, dps: 999, kind: "baseline" })],
  );

  it("filters by exact cost and sorts DPS descending", () => {
    const sorted = sortTeamsForDisplay([owned, mid, high, noCost], {
      selectedCost: 4,
      sortBy: "dps-desc",
      sortOwnedFirst: false,
      ownedKeys: new Set(["A", "B"]),
    });
    assert.deepEqual(
      sorted.map((t) => t.team_key),
      ["X-Y", "A-C", "A-B"],
    );
  });

  it("puts fully owned teams first while preserving DPS order within groups", () => {
    const sorted = sortTeamsForDisplay([high, mid, owned], {
      selectedCost: null,
      sortBy: "dps-desc",
      sortOwnedFirst: true,
      ownedKeys: new Set(["A", "B", "C"]),
    });
    assert.deepEqual(
      sorted.map((t) => t.team_key),
      ["A-C", "A-B", "X-Y"],
    );
    assert.equal(ownsInvestmentTeam(owned, new Set(["A", "B"])), true);
    assert.equal(ownsInvestmentTeam(mid, new Set(["A", "B"])), false);
  });
});
