/**
 * Unit tests for cream-of-the-crop relative-gap cutoff.
 *
 * Run: pnpm exec tsx --test src/lib/tierlist.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  creamCutoff,
  computeTierList,
  type CharacterMeta,
  type CharacterUsageRow,
} from "./tierlist.ts";

describe("creamCutoff", () => {
  it("returns all scores when the board is at or below the floor", () => {
    assert.equal(creamCutoff([90, 80, 70]), 3);
    assert.equal(creamCutoff([90, 80, 70, 60, 50, 40, 30, 20]), 8);
  });

  it("cuts after the largest relative gap in the search window", () => {
    // ranks 1..20 — big cliff after 10 (50 → 20)
    const scores = [
      90, 88, 85, 82, 80, 78, 75, 72, 70, 50, // 1..10
      20, 19, 18, 17, 16, 15, 14, 13, 12, 11, // 11..20
    ];
    assert.equal(creamCutoff(scores), 10);
  });

  it("prefers the larger relative gap when absolute gaps compete", () => {
    // After 8: 40→30 (rel 0.25). After 12: 20→5 (rel 0.75) — pick 12.
    const scores = [
      50, 48, 46, 44, 42, 41, 40.5, 40, // 1..8
      30, 28, 25, 20, // 9..12
      5, 4, 3, 2, 1, // 13..
    ];
    assert.equal(creamCutoff(scores), 12);
  });

  it("clamps to the max cream size", () => {
    const scores = Array.from({ length: 30 }, (_, i) => 100 - i);
    // Even with a late cliff, searchHi is 16
    const k = creamCutoff(scores);
    assert.ok(k >= 8 && k <= 16);
  });
});

describe("computeTierList", () => {
  it("splits limited 5★ vs non-limited (4★ + standard 5★)", () => {
    const characters: CharacterMeta[] = [];
    const usage: CharacterUsageRow[] = [];

    for (let i = 0; i < 20; i++) {
      characters.push({
        game_id: 100 + i,
        name_id: `Five${i}`,
        name: `Five ${i}`,
        rarity: 5,
      });
      // Cliff after rank 10
      usage.push({
        character_id: 100 + i,
        avg_usage_rate: i < 10 ? 80 - i : 20 - (i - 10),
        cycles: 5,
      });
    }
    for (let i = 0; i < 12; i++) {
      characters.push({
        game_id: 200 + i,
        name_id: `Four${i}`,
        name: `Four ${i}`,
        rarity: 4,
      });
      usage.push({
        character_id: 200 + i,
        avg_usage_rate: i < 9 ? 70 - i : 10,
        cycles: 5,
      });
    }
    // Standard-banner 5★ should land on the non-limited board
    characters.push({
      game_id: 301,
      name_id: "Mona",
      name: "Mona",
      rarity: 5,
    });
    usage.push({
      character_id: 301,
      avg_usage_rate: 95,
      cycles: 5,
    });

    const result = computeTierList(usage, characters);
    assert.equal(result.cutoffMethod, "relative-gap");
    assert.equal(result.fiveStarCutoff, 10);
    assert.equal(result.fiveStar.length, 10);
    assert.equal(result.fiveStar[0]?.nameId, "Five0");
    assert.equal(result.fiveStar[0]?.rank, 1);
    assert.equal(
      result.fiveStar.every((e) => e.nameId.startsWith("Five")),
      true,
    );
    assert.equal(result.fourStar[0]?.nameId, "Mona");
    assert.ok(result.fourStar.some((e) => e.nameId.startsWith("Four")));
    assert.equal(
      result.fourStar.some((e) => e.nameId.startsWith("Five")),
      false,
    );
  });
});
