/**
 * Unit tests for the greedy Abyss/Stygian solver.
 *
 * Run: pnpm exec tsx --test src/lib/solver.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AbyssTeam, StygianTeam } from "./definitions.ts";
import {
  scoreAssignments,
  slotAffinityRate,
  solveAbyss,
  solveAbyssWithFallback,
  solveStygian,
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
    // Higher usage may land on the wrong field; optimizeSlots + preferredStygianSlot
    // should seat each team on its preferred of top / middle / bottom.
    const bottomPref = stygianTeam({
      team_key: "wants-bottom",
      members: ["a", "b", "c", "d"],
      usage_rate: 100,
      field_1_rate: 5,
      field_2_rate: 90,
      field_3_rate: 5,
    });
    const topPref = stygianTeam({
      team_key: "wants-top",
      members: ["e", "f", "g", "h"],
      usage_rate: 50,
      field_1_rate: 90,
      field_2_rate: 5,
      field_3_rate: 5,
    });
    const middlePref = stygianTeam({
      team_key: "wants-middle",
      members: ["i", "j", "k", "l"],
      usage_rate: 40,
      field_1_rate: 5,
      field_2_rate: 5,
      field_3_rate: 90,
    });

    const [sol] = solveStygian([bottomPref, topPref, middlePref], 1);
    assert.ok(sol);
    const bySlot = Object.fromEntries(
      sol.assignments.map((a) => [a.slot, a.team.team_key]),
    );
    assert.equal(bySlot.top, "wants-top");
    assert.equal(bySlot.middle, "wants-middle");
    assert.equal(bySlot.bottom, "wants-bottom");
    assert.equal(
      sol.score,
      scoreAssignments(sol.assignments),
      "stored score must match post-swap affinity score",
    );
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
