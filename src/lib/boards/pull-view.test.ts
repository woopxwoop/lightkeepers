/**
 * Run: pnpm exec tsx --test src/lib/boards/pull-view.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NearMissStygianTeam, StygianTeam } from "#lib/definitions.js";
import type { PairSuggestion, PullSuggestion } from "./pullSuggestions.ts";
import type { TierListEntry } from "./tierlist.ts";
import {
  cycledTeamIndex,
  nextRevealed,
  pairKey,
  pairLedgerRow,
  pairRowId,
  remainingMembers,
  resolvePullView,
  safeTeamIndex,
  singleLedgerRow,
  singleRowId,
  usagePct,
  type PullViewInputs,
} from "./pull-view.ts";

const team = (members: string[]): StygianTeam =>
  ({ members, avg_usage_rate: 20 }) as unknown as StygianTeam;

const nearMiss = (
  missing: string,
  members: string[],
  avgUsage: number,
): NearMissStygianTeam =>
  ({
    team_key: members.join(","),
    missing_character: missing,
    missing_character_name: missing,
    members,
    members_names: members,
    avg_usage_rate: avgUsage,
    usage_total: 0,
    usage_rate: 0,
    field_1_rate: 0,
    field_2_rate: 0,
    field_3_rate: 0,
  }) as unknown as NearMissStygianTeam;

const ready = (overrides: Partial<PullViewInputs> = {}): PullViewInputs => ({
  hydrated: true,
  ownedCount: 4,
  teamsOwnedStatus: "ready",
  nearMissStatus: "ready",
  tierSettled: true,
  nearMissTeams: [],
  nearMissPairs: [],
  creamPullIds: undefined,
  ...overrides,
});

describe("resolvePullView", () => {
  it("waits until the roster hydrates", () => {
    const view = resolvePullView(ready({ hydrated: false, ownedCount: 0 }));
    assert.equal(view.pageState, "waiting");
    assert.deepEqual(view.suggestions, []);
    assert.deepEqual(view.pairSuggestions, []);
  });

  it("is empty with no owned characters", () => {
    assert.equal(resolvePullView(ready({ ownedCount: 0 })).pageState, "empty");
  });

  it("stays an error when either fetch failed, even if the other is ready", () => {
    assert.equal(
      resolvePullView(ready({ teamsOwnedStatus: "error" })).pageState,
      "error",
    );
    assert.equal(
      resolvePullView(
        ready({ nearMissStatus: "error", teamsOwnedStatus: "loading" }),
      ).pageState,
      "error",
    );
  });

  it("waits while a fetch is pending or the tier list is unsettled", () => {
    assert.equal(
      resolvePullView(ready({ teamsOwnedStatus: "loading" })).pageState,
      "waiting",
    );
    assert.equal(
      resolvePullView(ready({ nearMissStatus: "idle" })).pageState,
      "waiting",
    );
    assert.equal(
      resolvePullView(ready({ tierSettled: false })).pageState,
      "waiting",
    );
  });

  it("is empty when nothing ranks", () => {
    assert.equal(resolvePullView(ready()).pageState, "empty");
  });

  it("ranks singles, honouring the cream filter", () => {
    const nearMissTeams = [
      nearMiss("a", ["a", "x", "y", "z"], 30),
      nearMiss("b", ["b", "x", "y", "z"], 40),
    ];
    const all = resolvePullView(ready({ nearMissTeams }));
    assert.equal(all.pageState, "done");
    assert.deepEqual(
      all.suggestions.map((s) => s.character),
      ["b", "a"],
    );

    const cream = resolvePullView(
      ready({ nearMissTeams, creamPullIds: new Set(["a"]) }),
    );
    assert.deepEqual(
      cream.suggestions.map((s) => s.character),
      ["a"],
    );
  });
});

describe("nextRevealed", () => {
  it("returns the same set when every id is still live", () => {
    const revealed = new Set(["a", "b"]);
    assert.equal(nextRevealed(revealed, ["a", "b", "c"]), revealed);
  });

  it("drops ids that no longer exist", () => {
    const revealed = new Set(["a", "b"]);
    const next = nextRevealed(revealed, ["b"]);
    assert.notEqual(next, revealed);
    assert.deepEqual([...next], ["b"]);
  });
});

describe("row ids", () => {
  it("builds pair keys and row ids", () => {
    const pair = { charA: "a", charB: "b" } as PairSuggestion;
    assert.equal(pairKey(pair), "a|b");
    assert.equal(singleRowId("a"), "pull-single-a");
    assert.equal(pairRowId("a|b"), "pull-pair-a|b");
  });
});

describe("remainingMembers", () => {
  it("drops the pull targets and keeps order", () => {
    assert.deepEqual(remainingMembers(team(["a", "b", "c", "d"]), ["c"]), [
      "a",
      "b",
      "d",
    ]);
  });

  it("is empty without a team", () => {
    assert.deepEqual(remainingMembers(undefined, ["a"]), []);
  });
});

describe("safeTeamIndex", () => {
  it("defaults to 0 and clamps to the last team", () => {
    const teams = [team(["a"]), team(["b"])];
    assert.equal(safeTeamIndex({}, "x", teams), 0);
    assert.equal(safeTeamIndex({ x: 5 }, "x", teams), 1);
    assert.equal(safeTeamIndex({ x: 1 }, "x", teams), 1);
  });

  it("is 0 with no teams", () => {
    assert.equal(safeTeamIndex({ x: 3 }, "x", []), 0);
  });
});

describe("ledger rows", () => {
  const teams = [team(["a", "x", "y", "z"]), team(["a", "b", "w", "v"])];
  const mapping = new Map([
    ["a", { rarity: 4 }],
    ["b", { rarity: null }],
  ]);

  it("builds a single row from the active team", () => {
    const row = singleLedgerRow(
      {
        character: "a",
        characterName: "Alpha",
        topTeams: teams,
      } as PullSuggestion,
      mapping,
      { a: 1 },
    );
    assert.equal(row.indexKey, "a");
    assert.equal(row.rowId, "pull-single-a");
    assert.deepEqual(row.targets, [{ nameId: "a", name: "Alpha", rarity: 4 }]);
    assert.deepEqual(row.mates, ["b", "w", "v"]);
    assert.equal(row.mateCount, 3);
    assert.equal(row.teamIdx, 1);
    assert.equal(row.cycleTeam, teams[1]);
  });

  it("builds a pair row, falling back to name_id and rarity 5", () => {
    const row = pairLedgerRow(
      {
        charA: "a",
        charAName: undefined,
        charB: "b",
        charBName: "Beta",
        topTeams: [teams[1]!],
      } as PairSuggestion,
      mapping,
      { "a|b": 3 },
    );
    assert.equal(row.indexKey, "a|b");
    assert.equal(row.rowId, "pull-pair-a|b");
    assert.deepEqual(row.targets, [
      { nameId: "a", name: "a", rarity: 4 },
      { nameId: "b", name: "Beta", rarity: 5 },
    ]);
    assert.deepEqual(row.mates, ["w", "v"]);
    assert.equal(row.mateCount, 2);
    assert.equal(row.teamIdx, 0);
  });
});

describe("cycledTeamIndex", () => {
  it("wraps forward and backward", () => {
    assert.equal(cycledTeamIndex(undefined, 3, 1), 1);
    assert.equal(cycledTeamIndex(2, 3, 1), 0);
    assert.equal(cycledTeamIndex(0, 3, -1), 2);
  });

  it("clamps a stale index before stepping", () => {
    assert.equal(cycledTeamIndex(9, 3, -1), 1);
  });
});

describe("usagePct", () => {
  const entry = (score: number) => ({ score }) as TierListEntry;

  it("drops decimals at 10% and above", () => {
    assert.equal(usagePct(entry(12.34)), "12%");
  });

  it("keeps one decimal below 10%", () => {
    assert.equal(usagePct(entry(4.56)), "4.6%");
  });
});
