/**
 * Unit tests for character-only team floor cost + clear frontiers.
 *
 * Run: pnpm exec tsx --test src/lib/team-cost.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CharacterMeta } from "./tierlist.ts";
import {
  baselineTeamCost,
  bestClearUnderLimit,
  c0r0ClearPairKeys,
  clearCostAtCap,
  clearTimeAtCap,
  clearTimeAtCostCeiling,
  floorTeamCost,
  labeledCostWithinFloor,
} from "./team-cost.ts";

function meta(name_id: string, rarity: number): CharacterMeta {
  return {
    game_id: 0,
    name_id,
    name: name_id,
    rarity,
  };
}

const byId = new Map<string, CharacterMeta>([
  ["Mavuika", meta("Mavuika", 5)],
  ["Iansan", meta("Iansan", 4)],
  ["Chevreuse", meta("Chevreuse", 4)],
  ["Ororon", meta("Ororon", 4)],
  ["Mualani", meta("Mualani", 5)],
  ["Mona", meta("Mona", 5)], // standard banner
  ["Qin", meta("Qin", 5)], // Jean
]);

describe("floorTeamCost", () => {
  it("counts limited 5★ only (Mavuika overload = 1)", () => {
    assert.equal(
      floorTeamCost(["Mavuika", "Iansan", "Chevreuse", "Ororon"], byId),
      1,
    );
  });

  it("sums multiple limited 5★s", () => {
    assert.equal(
      floorTeamCost(["Mavuika", "Mualani", "Iansan", "Ororon"], byId),
      2,
    );
  });

  it("ignores standard-banner 5★s", () => {
    assert.equal(floorTeamCost(["Mona", "Qin", "Iansan", "Ororon"], byId), 0);
  });

  it("skips unknown ids", () => {
    assert.equal(floorTeamCost(["Mavuika", "Unknown"], byId), 1);
  });
});

describe("baselineTeamCost", () => {
  it("is C0R0 floor + 0.5", () => {
    assert.equal(
      baselineTeamCost(["Mavuika", "Iansan", "Chevreuse", "Ororon"], byId),
      1.5,
    );
    assert.equal(
      baselineTeamCost(["Iansan", "Chevreuse", "Ororon", "Mona"], byId),
      0.5,
    );
  });
});

describe("labeledCostWithinFloor", () => {
  const members = ["Mavuika", "Iansan", "Chevreuse", "Ororon"] as const;

  it("allows scrape cost <= C0R0 + 0.5", () => {
    assert.equal(labeledCostWithinFloor(0, members, byId), true);
    assert.equal(labeledCostWithinFloor(1, members, byId), true);
    assert.equal(labeledCostWithinFloor(1.5, members, byId), true);
  });

  it("rejects a full extra limited copy (+1)", () => {
    assert.equal(labeledCostWithinFloor(2, members, byId), false);
  });
});

describe("bestClearUnderLimit / clearTimeAtCap", () => {
  const frontier = [
    { c: 1, t: 90 },
    { c: 1.5, t: 85 },
    { c: 2, t: 30 },
    { c: 6, t: 20 },
  ];

  it("picks the fastest point at or under the scrape limit", () => {
    assert.deepEqual(bestClearUnderLimit(frontier, 1.5), { c: 1.5, t: 85 });
    assert.deepEqual(bestClearUnderLimit(frontier, 8.5), { c: 6, t: 20 });
    assert.equal(bestClearUnderLimit(frontier, 0.5), null);
  });

  it("keeps the slower baseline time when a faster +1-cost clear exists", () => {
    const row = { frontier };
    assert.equal(clearTimeAtCostCeiling(row, 1), 85);
    assert.equal(clearCostAtCap(row, 1), 1.5);
    assert.equal(clearTimeAtCap(row, 2), 30);
    assert.equal(clearCostAtCap(row, 2), 2);
  });

  it("uses high-cap frontier points above 4", () => {
    const row = { frontier };
    assert.equal(clearTimeAtCap(row, 8), 20);
    assert.equal(clearCostAtCap(row, 8), 6);
  });
});

describe("c0r0ClearPairKeys", () => {
  it("keeps pairs with a clear under floor + 0.5 slack", () => {
    const keys = c0r0ClearPairKeys(
      [
        {
          team_key: "ol",
          enemy_id: 1,
          members: ["Mavuika", "Iansan", "Chevreuse", "Ororon"],
          frontier: [
            { c: 1.5, t: 90 },
            { c: 2, t: 30 },
          ],
        },
        {
          team_key: "ol",
          enemy_id: 2,
          members: ["Mavuika", "Iansan", "Chevreuse", "Ororon"],
          frontier: [{ c: 2, t: 25 }],
        },
        {
          team_key: "f2p",
          enemy_id: 3,
          members: ["Iansan", "Chevreuse", "Ororon", "Mona"],
          frontier: [{ c: 0.5, t: 60 }],
        },
      ],
      byId,
    );
    assert.deepEqual([...keys].sort(), ["f2p|3", "ol|1"]);
  });

  it("counts a 3.5-cost clear for a floor-3 team", () => {
    const threeLimited = ["Mavuika", "Mualani", "Skirk", "Iansan"] as const;
    const map = new Map(byId);
    map.set("Skirk", {
      game_id: 9,
      name_id: "Skirk",
      name: "Skirk",
      rarity: 5,
    });
    assert.equal(baselineTeamCost(threeLimited, map), 3.5);

    const keys = c0r0ClearPairKeys(
      [
        {
          team_key: "heavy",
          enemy_id: 1,
          members: [...threeLimited],
          frontier: [{ c: 3.5, t: 55 }],
        },
      ],
      map,
    );
    assert.deepEqual([...keys], ["heavy|1"]);
  });
});
