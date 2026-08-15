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

  it("normalizes missing main_stats and liquid for legacy payloads", () => {
    const legacy = {
      key: "Legacy",
      weapons: [],
      sets: [],
    } as unknown as CharacterIndex;
    const live = liveCharacterSummary(legacy);
    assert.ok(live);
    assert.deepEqual(live.main_stats, {
      sands: [],
      goblet: [],
      circlet: [],
    });
    assert.deepEqual(live.substat_rolls_liquid, {
      teams: 0,
      configs: 0,
      mean: {},
      ranked: [],
    });
  });

  it("fills partial main_stats slots without dropping present ranks", () => {
    const partial = summary({
      main_stats: {
        sands: [{ key: "hp_", teams: 2 }],
      } as CharacterIndex["main_stats"],
    });
    const live = liveCharacterSummary(partial);
    assert.ok(live);
    assert.deepEqual(live.main_stats.sands, [{ key: "hp_", teams: 2 }]);
    assert.deepEqual(live.main_stats.goblet, []);
    assert.deepEqual(live.main_stats.circlet, []);
  });
});
