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
  displayDps,
  displaySim,
  nearestCostDps,
  ownsInvestmentTeam,
  simAtExactCost,
  sortTeamsForDisplay,
  teamsMatchingTags,
  teamsWithExactCost,
} from "./investment-teams.ts";
import type { InvestmentSim, InvestmentTeam } from "./types/investment.ts";

function sim(
  partial: Partial<InvestmentSim> & Pick<InvestmentSim, "cost" | "dps">,
): InvestmentSim {
  return {
    state_key: `c${partial.cost}-d${partial.dps}`,
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

describe("nearestCostDps", () => {
  it("returns 0 for an empty results list", () => {
    assert.equal(nearestCostDps(team(["A"], []), 4), 0);
  });

  it("prefers the closer cost, then the lower cost on a tie", () => {
    const t = team(
      ["A"],
      [
        sim({ cost: 2, dps: 100 }),
        sim({ cost: 6, dps: 300 }),
        sim({ cost: 8, dps: 400 }),
      ],
    );
    // Target 5: dist(6)=1, dist(2)=3, dist(8)=3 → 6
    assert.equal(nearestCostDps(t, 5), 300);
    // Target 4: dist(2)=2, dist(6)=2 → prefer lower cost 2
    assert.equal(nearestCostDps(t, 4), 100);
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

  it("uses exact / nearest cost when a cost is selected", () => {
    const t = team(
      ["A"],
      [
        sim({ cost: 2, dps: 100, kind: "f2p" }),
        sim({ cost: 4, dps: 200, kind: "baseline" }),
      ],
    );
    assert.equal(displayDps(t, 4), 200);
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
    assert.deepEqual(allTeamCharacterKeys([a, b, c]).sort(), ["A", "B", "C"]);
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
  const owned = team(["A", "B"], [sim({ cost: 4, dps: 100, kind: "baseline" })]);
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
