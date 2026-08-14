import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { liveCharacterSummary } from "./character-summary.ts";
import type { CharacterIndex } from "../types/investment.ts";

function summary(partial: Partial<CharacterIndex> = {}): CharacterIndex {
  return {
    key: "Furina",
    weapons: [],
    sets: [],
    main_stats: { sands: [], goblet: [], circlet: [] },
    substat_rolls_liquid: { teams: 0, configs: 0, mean: {}, ranked: [] },
    ...partial,
  };
}

describe("liveCharacterSummary", () => {
  it("passes through current summaries", () => {
    const live = summary();
    assert.equal(liveCharacterSummary(live), live);
    const flagged = summary({ upToDate: true });
    assert.equal(liveCharacterSummary(flagged), flagged);
  });

  it("treats tombstones as missing", () => {
    assert.equal(
      liveCharacterSummary({ key: "Aloy", upToDate: false } as CharacterIndex),
      null,
    );
  });

  it("returns stale summaries that still have a body", () => {
    const stale = summary({
      upToDate: false,
      weapons: [{ key: "KagurasVerity", teams: 1 }],
    });
    assert.equal(liveCharacterSummary(stale), stale);
  });

  it("treats null and undefined as missing", () => {
    assert.equal(liveCharacterSummary(null), null);
    assert.equal(liveCharacterSummary(undefined), null);
  });
});
