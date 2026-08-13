/**
 * Unit tests for the greedy Abyss/Stygian solver.
 *
 * Run: pnpm exec tsx --test src/lib/solver.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AbyssTeam, StygianCheapClearRow, StygianTeam } from "./definitions.ts";
import {
  optimizeStygianSlotAssignments,
  scoreAssignments,
  slotAffinityRate,
  solveAbyss,
  solveAbyssWithFallback,
  solveStygian,
  solveStygianCheapClears,
  solveStygianHybrid,
} from "./solver.ts";

function abyssTeam(
  partial: Partial<AbyssTeam> & {
    team_key: string;
    members: string[];
  },
): AbyssTeam {
  return {
    team_key: partial.team_key,
    members: partial.members,
    members_names: partial.members_names ?? partial.members,
    usage_rate: partial.usage_rate ?? 50,
    usage_total: partial.usage_total ?? 1,
    field_1_rate: partial.field_1_rate ?? 50,
    field_2_rate: partial.field_2_rate ?? 50,
    has_total: partial.has_total ?? 1,
    version_number: partial.version_number ?? 1,
  };
}

function stygianTeam(
  partial: Partial<StygianTeam> & {
    team_key: string;
    members: string[];
  },
): StygianTeam {
  return {
    team_key: partial.team_key,
    members: partial.members,
    members_names: partial.members_names ?? partial.members,
    usage_rate: partial.usage_rate ?? 50,
    usage_total: partial.usage_total ?? 1,
    avg_usage_rate: partial.avg_usage_rate ?? 50,
    field_1_rate: partial.field_1_rate ?? 40,
    field_2_rate: partial.field_2_rate ?? 30,
    field_3_rate: partial.field_3_rate ?? 30,
    has_total: partial.has_total ?? 1,
    version_number: partial.version_number ?? 1,
  };
}

describe("scoreAssignments", () => {
  it("uses slot affinity so the same teams score differently by slot", () => {
    const topHeavy = abyssTeam({
      team_key: "a",
      members: ["a1", "a2", "a3", "a4"],
      usage_rate: 100,
      field_1_rate: 90,
      field_2_rate: 10,
    });
    const bottomHeavy = abyssTeam({
      team_key: "b",
      members: ["b1", "b2", "b3", "b4"],
      usage_rate: 100,
      field_1_rate: 10,
      field_2_rate: 90,
    });

    const matched = scoreAssignments([
      { team: topHeavy, slot: "top" },
      { team: bottomHeavy, slot: "bottom" },
    ]);
    const mismatched = scoreAssignments([
      { team: topHeavy, slot: "bottom" },
      { team: bottomHeavy, slot: "top" },
    ]);

    assert.ok(matched > mismatched);
  });
});

describe("slotAffinityRate", () => {
  it("normalizes field rates for the given slot", () => {
    const team = abyssTeam({
      team_key: "t",
      members: ["a", "b", "c", "d"],
      field_1_rate: 75,
      field_2_rate: 25,
    });
    assert.equal(slotAffinityRate(team, "top"), 0.75);
    assert.equal(slotAffinityRate(team, "bottom"), 0.25);
  });
});

describe("solveAbyss", () => {
  it("fills both halves without character overlap", () => {
    const teams = [
      abyssTeam({
        team_key: "top-pref",
        members: ["a", "b", "c", "d"],
        usage_rate: 80,
        field_1_rate: 90,
        field_2_rate: 10,
      }),
      abyssTeam({
        team_key: "bot-pref",
        members: ["e", "f", "g", "h"],
        usage_rate: 70,
        field_1_rate: 10,
        field_2_rate: 90,
      }),
      abyssTeam({
        team_key: "overlap",
        members: ["a", "e", "i", "j"],
        usage_rate: 99,
        field_1_rate: 50,
        field_2_rate: 50,
      }),
    ];

    const [best] = solveAbyss(teams, 1);
    assert.ok(best);
    assert.equal(best.unfilled.length, 0);
    assert.equal(best.assignments.length, 2);
    const used = best.assignments.flatMap((a) => a.team.members ?? []);
    assert.equal(new Set(used).size, used.length);
  });

  it("recomputes score after pairwise slot swaps", () => {
    // Higher usage picks first and may land on the wrong half; optimizeSlots
    // should swap so each team sits on its preferred slot.
    const bottomPref = abyssTeam({
      team_key: "wants-bottom",
      members: ["a", "b", "c", "d"],
      usage_rate: 100,
      field_1_rate: 10,
      field_2_rate: 90,
    });
    const topPref = abyssTeam({
      team_key: "wants-top",
      members: ["e", "f", "g", "h"],
      usage_rate: 50,
      field_1_rate: 90,
      field_2_rate: 10,
    });

    const [sol] = solveAbyss([bottomPref, topPref], 1);
    assert.ok(sol);
    const bySlot = Object.fromEntries(
      sol.assignments.map((a) => [a.slot, a.team.team_key]),
    );
    assert.equal(bySlot.top, "wants-top");
    assert.equal(bySlot.bottom, "wants-bottom");
    assert.equal(
      sol.score,
      scoreAssignments(sol.assignments),
      "stored score must match post-swap affinity score",
    );
  });

  it("prefers slot specialists over a high-usage flex that steals a half", () => {
    // Old fill walked by usage and parked the flex on top first, locking out
    // the top specialist. Slot-aware placement score should seat both specialists.
    const flex = abyssTeam({
      team_key: "flex",
      members: ["a", "b", "c", "d"],
      usage_rate: 100,
      field_1_rate: 50,
      field_2_rate: 50,
    });
    const bottomSpec = abyssTeam({
      team_key: "bottom-spec",
      members: ["e", "f", "g", "h"],
      usage_rate: 60,
      field_1_rate: 5,
      field_2_rate: 95,
    });
    const topSpec = abyssTeam({
      team_key: "top-spec",
      members: ["i", "j", "k", "l"],
      usage_rate: 55,
      field_1_rate: 95,
      field_2_rate: 5,
    });

    const [sol] = solveAbyss([flex, bottomSpec, topSpec], 1);
    assert.ok(sol);
    const keys = new Set(sol.assignments.map((a) => a.team.team_key));
    assert.ok(keys.has("top-spec"));
    assert.ok(keys.has("bottom-spec"));
    assert.equal(keys.has("flex"), false);
  });
});

describe("solveStygian", () => {
  it("fills three fields without overlap", () => {
    const teams = [
      stygianTeam({
        team_key: "t",
        members: ["a", "b", "c", "d"],
        usage_rate: 80,
        field_1_rate: 80,
        field_2_rate: 10,
        field_3_rate: 10,
      }),
      stygianTeam({
        team_key: "m",
        members: ["e", "f", "g", "h"],
        usage_rate: 70,
        field_1_rate: 10,
        field_2_rate: 10,
        field_3_rate: 80,
      }),
      stygianTeam({
        team_key: "b",
        members: ["i", "j", "k", "l"],
        usage_rate: 60,
        field_1_rate: 10,
        field_2_rate: 80,
        field_3_rate: 10,
      }),
    ];

    const [best] = solveStygian(teams, 1);
    assert.ok(best);
    assert.equal(best.unfilled.length, 0);
    assert.equal(best.assignments.length, 3);
  });

  it("recomputes score after pairwise slot swaps (three-way affinity)", () => {
    // Prefer each of top / middle / bottom. A cyclic seating (each team one
    // slot past its preferred) cannot be fixed by mutual pairwise swap —
    // optimizeSlots must rotate. Rates on the wrong seats stay ≥ MIN_SLOT_RATE
    // so a floor-enforcing optimizer could sit there, but score favors home seats.
    const bottomPref = stygianTeam({
      team_key: "wants-bottom",
      members: ["a", "b", "c", "d"],
      usage_rate: 100,
      field_1_rate: 15,
      field_2_rate: 90,
      field_3_rate: 15,
    });
    const topPref = stygianTeam({
      team_key: "wants-top",
      members: ["e", "f", "g", "h"],
      usage_rate: 100,
      field_1_rate: 90,
      field_2_rate: 15,
      field_3_rate: 15,
    });
    const middlePref = stygianTeam({
      team_key: "wants-middle",
      members: ["i", "j", "k", "l"],
      usage_rate: 100,
      field_1_rate: 15,
      field_2_rate: 15,
      field_3_rate: 90,
    });

    // top→middle→bottom→top: no pair mutually prefers each other's seat.
    const cyclic = [
      { team: topPref, slot: "middle" as const },
      { team: middlePref, slot: "bottom" as const },
      { team: bottomPref, slot: "top" as const },
    ];
    assert.notEqual(
      scoreAssignments(cyclic),
      scoreAssignments([
        { team: topPref, slot: "top" },
        { team: middlePref, slot: "middle" },
        { team: bottomPref, slot: "bottom" },
      ]),
      "fixture must start away from the preferred seating score",
    );

    const rotated = optimizeStygianSlotAssignments(cyclic);
    const bySlot = Object.fromEntries(
      rotated.map((a) => [a.slot, a.team.team_key]),
    );
    assert.equal(bySlot.top, "wants-top");
    assert.equal(bySlot.middle, "wants-middle");
    assert.equal(bySlot.bottom, "wants-bottom");

    const [sol] = solveStygian([bottomPref, topPref, middlePref], 1);
    assert.ok(sol);
    const solvedBySlot = Object.fromEntries(
      sol.assignments.map((a) => [a.slot, a.team.team_key]),
    );
    assert.equal(solvedBySlot.top, "wants-top");
    assert.equal(solvedBySlot.middle, "wants-middle");
    assert.equal(solvedBySlot.bottom, "wants-bottom");
    assert.equal(
      sol.score,
      scoreAssignments(sol.assignments),
      "stored score must match post-swap affinity score",
    );
  });

  it("never seats a team below MIN_SLOT_RATE (10%)", () => {
    // All teams clear top/bottom but sit under 10% on middle — leave middle empty.
    const teams = [
      stygianTeam({
        team_key: "a",
        members: ["a1", "a2", "a3", "a4"],
        usage_rate: 90,
        field_1_rate: 50,
        field_2_rate: 50,
        field_3_rate: 9,
      }),
      stygianTeam({
        team_key: "b",
        members: ["b1", "b2", "b3", "b4"],
        usage_rate: 80,
        field_1_rate: 50,
        field_2_rate: 50,
        field_3_rate: 5,
      }),
      stygianTeam({
        team_key: "c",
        members: ["c1", "c2", "c3", "c4"],
        usage_rate: 70,
        field_1_rate: 50,
        field_2_rate: 50,
        field_3_rate: 0,
      }),
    ];

    const [sol] = solveStygian(teams, 1);
    assert.ok(sol);
    assert.ok(sol.unfilled.includes("middle"));
    assert.ok(!sol.assignments.some((a) => a.slot === "middle"));
    for (const a of sol.assignments) {
      const rate =
        a.slot === "top"
          ? a.team.field_1_rate
          : a.slot === "bottom"
            ? a.team.field_2_rate
            : a.team.field_3_rate;
      assert.ok(
        (rate ?? 0) >= 10,
        `${a.team.team_key} seated below 10% on ${a.slot}`,
      );
    }
  });

  it("leaves the board incomplete when every seat is below MIN_SLOT_RATE", () => {
    const teams = [
      stygianTeam({
        team_key: "soft-a",
        members: ["a", "b", "c", "d"],
        usage_rate: 90,
        field_1_rate: 9,
        field_2_rate: 8,
        field_3_rate: 7,
      }),
      stygianTeam({
        team_key: "soft-b",
        members: ["e", "f", "g", "h"],
        usage_rate: 80,
        field_1_rate: 8,
        field_2_rate: 9,
        field_3_rate: 7,
      }),
      stygianTeam({
        team_key: "soft-c",
        members: ["i", "j", "k", "l"],
        usage_rate: 70,
        field_1_rate: 7,
        field_2_rate: 8,
        field_3_rate: 9,
      }),
    ];

    const [sol] = solveStygian(teams, 1);
    assert.ok(sol);
    assert.equal(sol.assignments.length, 0);
    assert.equal(sol.unfilled.length, 3);
  });

  it("skips a forced-first team that is below MIN_SLOT_RATE on every field", () => {
    const forcedSoft = stygianTeam({
      team_key: "forced-soft",
      members: ["a", "b", "c", "d"],
      usage_rate: 100,
      field_1_rate: 9,
      field_2_rate: 8.9,
      field_3_rate: 8,
    });
    const topPref = stygianTeam({
      team_key: "top-pref",
      members: ["e", "f", "g", "h"],
      usage_rate: 90,
      field_1_rate: 90,
      field_2_rate: 10,
      field_3_rate: 10,
    });
    const middlePref = stygianTeam({
      team_key: "middle-pref",
      members: ["i", "j", "k", "l"],
      usage_rate: 80,
      field_1_rate: 10,
      field_2_rate: 10,
      field_3_rate: 90,
    });
    const bottomPref = stygianTeam({
      team_key: "bottom-pref",
      members: ["m", "n", "o", "p"],
      usage_rate: 70,
      field_1_rate: 10,
      field_2_rate: 90,
      field_3_rate: 10,
    });

    const [sol] = solveStygian(
      [forcedSoft, topPref, middlePref, bottomPref],
      1,
    );
    assert.ok(sol);
    const bySlot = Object.fromEntries(
      sol.assignments.map((a) => [a.slot, a.team.team_key]),
    );
    assert.equal(bySlot.top, "top-pref");
    assert.equal(bySlot.middle, "middle-pref");
    assert.equal(bySlot.bottom, "bottom-pref");
    assert.ok(!sol.assignments.some((a) => a.team.team_key === "forced-soft"));
    assert.equal(sol.unfilled.length, 0);
  });

  it("excludes teams below the 0.1% usage floor", () => {
    const dust = stygianTeam({
      team_key: "dust",
      members: ["a", "b", "c", "d"],
      usage_rate: 0.09,
      field_1_rate: 100,
      field_2_rate: 100,
      field_3_rate: 100,
    });
    const real = stygianTeam({
      team_key: "real",
      members: ["e", "f", "g", "h"],
      usage_rate: 0.1,
      field_1_rate: 100,
      field_2_rate: 10,
      field_3_rate: 10,
    });
    const real2 = stygianTeam({
      team_key: "real2",
      members: ["i", "j", "k", "l"],
      usage_rate: 12,
      field_1_rate: 10,
      field_2_rate: 10,
      field_3_rate: 100,
    });
    const real3 = stygianTeam({
      team_key: "real3",
      members: ["m", "n", "o", "p"],
      usage_rate: 11,
      field_1_rate: 10,
      field_2_rate: 100,
      field_3_rate: 10,
    });

    const [sol] = solveStygian([dust, real, real2, real3], 1);
    assert.ok(sol);
    assert.ok(!sol.assignments.some((a) => a.team.team_key === "dust"));
    assert.ok(sol.assignments.some((a) => a.team.team_key === "real"));
  });

  it("explores high-usage candidates even when they are not first in array order", () => {
    // Owned RPC order is not usage-sorted. Without an explicit sort, CANDIDATE_DEPTH
    // would only force the first 20 (here: dust) and miss the meta peak.
    const dust = Array.from({ length: 20 }, (_, i) =>
      stygianTeam({
        team_key: `dust-${i}`,
        members: [`d${i}a`, `d${i}b`, `d${i}c`, `d${i}d`],
        usage_rate: 0.2,
        field_1_rate: 40,
        field_2_rate: 30,
        field_3_rate: 30,
      }),
    );
    const top = stygianTeam({
      team_key: "peak-top",
      members: ["t1", "t2", "t3", "t4"],
      usage_rate: 80,
      field_1_rate: 90,
      field_2_rate: 10,
      field_3_rate: 10,
    });
    const middle = stygianTeam({
      team_key: "peak-middle",
      members: ["m1", "m2", "m3", "m4"],
      usage_rate: 70,
      field_1_rate: 10,
      field_2_rate: 10,
      field_3_rate: 90,
    });
    const bottom = stygianTeam({
      team_key: "peak-bottom",
      members: ["b1", "b2", "b3", "b4"],
      usage_rate: 60,
      field_1_rate: 10,
      field_2_rate: 90,
      field_3_rate: 10,
    });

    const [sol] = solveStygian([...dust, top, middle, bottom], 1);
    assert.ok(sol);
    const keys = new Set(sol.assignments.map((a) => a.team.team_key));
    assert.ok(keys.has("peak-top"));
    assert.ok(keys.has("peak-middle"));
    assert.ok(keys.has("peak-bottom"));
  });
});

describe("solveAbyssWithFallback", () => {
  it("returns owned solutions when the roster already covers both halves", () => {
    const owned = [
      abyssTeam({
        team_key: "o1",
        members: ["a", "b", "c", "d"],
        usage_rate: 80,
        field_1_rate: 90,
        field_2_rate: 10,
      }),
      abyssTeam({
        team_key: "o2",
        members: ["e", "f", "g", "h"],
        usage_rate: 70,
        field_1_rate: 10,
        field_2_rate: 90,
      }),
    ];
    const ownedNames = new Set(["a", "b", "c", "d", "e", "f", "g", "h"]);
    const solutions = solveAbyssWithFallback(owned, owned, ownedNames, 1);
    assert.equal(solutions.length, 1);
    assert.equal(solutions[0].isFallback, false);
    assert.equal(solutions[0].unfilled.length, 0);
  });

  it("falls back when owned teams cannot fill both slots", () => {
    const owned = [
      abyssTeam({
        team_key: "only-one",
        members: ["a", "b", "c", "d"],
        usage_rate: 80,
        field_1_rate: 50,
        field_2_rate: 50,
      }),
    ];
    const all = [
      ...owned,
      abyssTeam({
        team_key: "needs-x",
        members: ["e", "f", "g", "x"],
        usage_rate: 70,
        field_1_rate: 10,
        field_2_rate: 90,
      }),
    ];
    const ownedNames = new Set(["a", "b", "c", "d", "e", "f", "g"]);
    const solutions = solveAbyssWithFallback(owned, all, ownedNames, 1);
    assert.ok(solutions.length >= 1);
    assert.equal(solutions[0].isFallback, true);
    assert.ok(solutions[0].neededCharacters.includes("x"));
  });
});

describe("solveStygianCheapClears", () => {
  /** Frontier with a single point at `fromCost` / `time`. */
  function cheapRow(
    team: StygianTeam,
    enemy_id: number,
    fromCost: number,
    time: number,
  ): StygianCheapClearRow {
    return {
      ...team,
      enemy_id,
      min_cost: fromCost,
      frontier: [{ c: fromCost, t: time }],
    };
  }

  const slotEnemies = { top: 1, middle: 2, bottom: 3 } as const;

  it("minimizes total clear time across three seats", () => {
    const fastTop = stygianTeam({
      team_key: "fast-top",
      members: ["a", "b", "c", "d"],
      usage_rate: 20,
      field_1_rate: 80,
      field_2_rate: 10,
      field_3_rate: 10,
    });
    const fastMid = stygianTeam({
      team_key: "fast-mid",
      members: ["e", "f", "g", "h"],
      usage_rate: 20,
      field_1_rate: 10,
      field_2_rate: 10,
      field_3_rate: 80,
    });
    const fastBot = stygianTeam({
      team_key: "fast-bot",
      members: ["i", "j", "k", "l"],
      usage_rate: 20,
      field_1_rate: 10,
      field_2_rate: 80,
      field_3_rate: 10,
    });
    const slowTop = stygianTeam({
      team_key: "slow-top",
      members: ["m", "n", "o", "p"],
      usage_rate: 90,
      field_1_rate: 90,
      field_2_rate: 10,
      field_3_rate: 10,
    });

    const rows = [
      cheapRow(fastTop, 1, 0, 40),
      cheapRow(fastMid, 2, 0, 50),
      cheapRow(fastBot, 3, 0, 60),
      cheapRow(slowTop, 1, 0, 200),
      cheapRow(slowTop, 2, 0, 200),
      cheapRow(slowTop, 3, 0, 200),
    ];

    const [best] = solveStygianCheapClears(rows, slotEnemies, 1);
    assert.ok(best);
    assert.equal(best.unfilled.length, 0);
    assert.equal(best.score, 40 + 50 + 60);
    const bySlot = Object.fromEntries(
      best.assignments.map((a) => [a.slot, a.team.team_key]),
    );
    assert.equal(bySlot.top, "fast-top");
    assert.equal(bySlot.middle, "fast-mid");
    assert.equal(bySlot.bottom, "fast-bot");
  });

  it("returns empty when no complete cost board exists", () => {
    const onlyTop = stygianTeam({
      team_key: "only",
      members: ["a", "b", "c", "d"],
      usage_rate: 50,
      field_1_rate: 80,
      field_2_rate: 10,
      field_3_rate: 10,
    });
    const rows = [cheapRow(onlyTop, 1, 0, 30)];
    assert.deepEqual(solveStygianCheapClears(rows, slotEnemies, 1), []);
  });

  it("uses the C0R0 floor + 0.5 even when a faster higher-cost clear exists", () => {
    const characterByNameId = new Map([
      [
        "Mavuika",
        {
          game_id: 1,
          name_id: "Mavuika",
          name: "Mavuika",
          rarity: 5,
        },
      ],
      [
        "Iansan",
        {
          game_id: 2,
          name_id: "Iansan",
          name: "Iansan",
          rarity: 4,
        },
      ],
      [
        "Chevreuse",
        {
          game_id: 3,
          name_id: "Chevreuse",
          name: "Chevreuse",
          rarity: 4,
        },
      ],
      [
        "Ororon",
        {
          game_id: 4,
          name_id: "Ororon",
          name: "Ororon",
          rarity: 4,
        },
      ],
    ]);

    // Floor 1 → scrape ≤ 1.5. Faster cost-2 clear must not win.
    const overload = stygianTeam({
      team_key: "mavuika-ol",
      members: ["Mavuika", "Iansan", "Chevreuse", "Ororon"],
      usage_rate: 50,
      field_1_rate: 40,
      field_2_rate: 30,
      field_3_rate: 30,
    });
    const mid = stygianTeam({
      team_key: "mid",
      members: ["e", "f", "g", "h"],
      usage_rate: 40,
      field_1_rate: 10,
      field_2_rate: 80,
      field_3_rate: 10,
    });
    const bot = stygianTeam({
      team_key: "bot",
      members: ["i", "j", "k", "l"],
      usage_rate: 40,
      field_1_rate: 10,
      field_2_rate: 10,
      field_3_rate: 80,
    });

    const maskedOnly = {
      ...overload,
      enemy_id: 1,
      min_cost: 2,
      frontier: [{ c: 2, t: 20 }],
    } satisfies StygianCheapClearRow;

    assert.deepEqual(
      solveStygianCheapClears(
        [
          maskedOnly,
          { ...maskedOnly, enemy_id: 2 },
          { ...maskedOnly, enemy_id: 3 },
          cheapRow(mid, 2, 0, 50),
          cheapRow(bot, 3, 0, 60),
        ],
        slotEnemies,
        1,
        characterByNameId,
        true,
        0,
      ),
      [],
    );

    const withC0r0 = {
      ...overload,
      enemy_id: 1,
      min_cost: 1,
      frontier: [
        { c: 1, t: 90 },
        { c: 2, t: 20 },
      ],
    } satisfies StygianCheapClearRow;

    const [best] = solveStygianCheapClears(
      [withC0r0, cheapRow(mid, 2, 0, 50), cheapRow(bot, 3, 0, 60)],
      slotEnemies,
      1,
      characterByNameId,
      true,
      0,
    );
    assert.ok(best);
    assert.equal(best.unfilled.length, 0);
    assert.equal(
      best.assignments.find((a) => a.slot === "top")?.team.team_key,
      "mavuika-ol",
    );
    assert.equal(best.score, 90 + 50 + 60);
  });

  it("uses high-cost frontier points when maxCost is above baseline", () => {
    const top = stygianTeam({
      team_key: "whale-top",
      members: ["a", "b", "c", "d"],
      usage_rate: 40,
      field_1_rate: 80,
      field_2_rate: 10,
      field_3_rate: 10,
    });
    const mid = stygianTeam({
      team_key: "whale-mid",
      members: ["e", "f", "g", "h"],
      usage_rate: 40,
      field_1_rate: 10,
      field_2_rate: 80,
      field_3_rate: 10,
    });
    const bot = stygianTeam({
      team_key: "whale-bot",
      members: ["i", "j", "k", "l"],
      usage_rate: 40,
      field_1_rate: 10,
      field_2_rate: 10,
      field_3_rate: 80,
    });

    const row = (
      team: StygianTeam,
      enemy_id: number,
      time: number,
    ): StygianCheapClearRow => ({
      ...team,
      enemy_id,
      min_cost: 6,
      frontier: [{ c: 6, t: time }],
    });

    const [best] = solveStygianCheapClears(
      [row(top, 1, 33), row(mid, 2, 44), row(bot, 3, 55)],
      slotEnemies,
      1,
      new Map(),
      false,
      8,
    );
    assert.ok(best);
    assert.equal(best.score, 33 + 44 + 55);
  });
});

describe("solveStygianHybrid", () => {
  const slotEnemies = { top: 1, middle: 2, bottom: 3 } as const;

  it("prefers boards with more C0R0-covered seats over higher usage", () => {
    const highTop = stygianTeam({
      team_key: "high-top",
      members: ["a", "b", "c", "d"],
      usage_rate: 90,
      field_1_rate: 80,
      field_2_rate: 10,
      field_3_rate: 10,
    });
    const highMid = stygianTeam({
      team_key: "high-mid",
      members: ["e", "f", "g", "h"],
      usage_rate: 90,
      field_1_rate: 10,
      field_2_rate: 80,
      field_3_rate: 10,
    });
    const highBot = stygianTeam({
      team_key: "high-bot",
      members: ["i", "j", "k", "l"],
      usage_rate: 90,
      field_1_rate: 10,
      field_2_rate: 10,
      field_3_rate: 80,
    });
    const covTop = stygianTeam({
      team_key: "cov-top",
      members: ["m", "n", "o", "p"],
      usage_rate: 40,
      field_1_rate: 80,
      field_2_rate: 10,
      field_3_rate: 10,
    });
    const covMid = stygianTeam({
      team_key: "cov-mid",
      members: ["q", "r", "s", "t"],
      usage_rate: 40,
      field_1_rate: 10,
      field_2_rate: 80,
      field_3_rate: 10,
    });
    const covBot = stygianTeam({
      team_key: "cov-bot",
      members: ["u", "v", "w", "x"],
      usage_rate: 40,
      field_1_rate: 10,
      field_2_rate: 10,
      field_3_rate: 80,
    });

    const owned = [highTop, highMid, highBot, covTop, covMid, covBot];
    const ownedNames = new Set(owned.flatMap((t) => t.members ?? []));
    const c0r0Pairs = new Set([
      "cov-top|1",
      "cov-mid|2",
      "cov-bot|3",
    ]);

    const [best] = solveStygianHybrid(
      owned,
      owned,
      ownedNames,
      slotEnemies,
      c0r0Pairs,
      1,
    );
    assert.ok(best);
    const keys = best.assignments.map((a) => a.team.team_key).sort();
    assert.deepEqual(keys, ["cov-bot", "cov-mid", "cov-top"]);
  });
});
