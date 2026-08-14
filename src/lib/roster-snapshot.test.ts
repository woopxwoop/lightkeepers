import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  captureRoster,
  diffRostersForSync,
  rosterDiffersFromSnapshot,
  rostersDifferForSync,
  toRosterSyncEntries,
} from "./roster-snapshot.ts";
import type { CharacterOwned } from "./definitions.ts";

function char(name_id: string, isOwned: boolean): CharacterOwned {
  return {
    name_id,
    name: name_id,
    isOwned,
  } as CharacterOwned;
}

describe("roster snapshot", () => {
  it("captureRoster freezes a clone independent of later edits", () => {
    const editor = [char("a", true), char("b", false)];
    const pending = captureRoster(editor);

    editor[0]!.isOwned = false;
    editor.push(char("c", true));

    assert.equal(pending.roster.length, 2);
    assert.equal(pending.roster[0]!.isOwned, true);
    assert.equal(pending.differsFrom(editor), true);
    assert.equal(pending.differsFrom(pending.roster), false);
  });

  it("captureRoster deep-clones progress so later edits stay unsaved", () => {
    const editor = [
      {
        ...char("a", true),
        progress: {
          level: 90,
          ascension: 6,
          constellation: 1,
          talents: { normal: 8, skill: 8, burst: 8 },
          weapon: null,
        },
      },
    ];
    const pending = captureRoster(editor);
    editor[0]!.progress!.constellation = 6;
    assert.equal(pending.roster[0]!.progress?.constellation, 1);
    assert.equal(pending.differsFrom(editor), true);
  });

  it("rosterDiffersFromSnapshot compares against saved JSON", () => {
    const roster = [char("a", true)];
    const saved = JSON.stringify(roster);
    assert.equal(rosterDiffersFromSnapshot(roster, saved), false);
    assert.equal(rosterDiffersFromSnapshot([char("a", false)], saved), true);
  });

  it("rostersDifferForSync ignores catalog-only differences", () => {
    const local = [{ ...char("a", true), rarity: 5 }] as CharacterOwned[];
    const cloud = [{ ...char("a", true), rarity: 4 }] as CharacterOwned[];
    assert.equal(rostersDifferForSync(local, cloud), false);
  });

  it("rostersDifferForSync detects owned and progress changes", () => {
    const base = [char("b", true), char("a", false)];
    assert.equal(
      rostersDifferForSync(base, [char("a", false), char("b", true)]),
      false,
    );
    assert.equal(
      rostersDifferForSync(base, [char("a", true), char("b", true)]),
      true,
    );

    const withProgress: CharacterOwned[] = [
      {
        ...char("a", true),
        progress: {
          level: 90,
          ascension: 6,
          constellation: 0,
          talents: { normal: 1, skill: 1, burst: 1 },
          weapon: null,
        },
      },
    ];
    const withoutProgress = [char("a", true)];
    assert.equal(rostersDifferForSync(withProgress, withoutProgress), true);
  });

  it("toRosterSyncEntries sorts by name_id and normalizes null progress", () => {
    const entries = toRosterSyncEntries([
      char("b", false),
      { ...char("a", true), progress: undefined },
    ]);
    assert.deepEqual(entries, [
      { name_id: "a", isOwned: true, progress: null },
      { name_id: "b", isOwned: false, progress: null },
    ]);
  });

  it("diffRostersForSync lists owned and progress deltas only", () => {
    const local: CharacterOwned[] = [
      char("same", true),
      char("owned-local", true),
      {
        ...char("progress", true),
        progress: {
          level: 90,
          ascension: 6,
          constellation: 0,
          talents: { normal: 1, skill: 1, burst: 1 },
          weapon: null,
        },
      },
    ];
    const cloud: CharacterOwned[] = [
      char("same", true),
      char("owned-local", false),
      {
        ...char("progress", true),
        progress: {
          level: 80,
          ascension: 5,
          constellation: 2,
          talents: { normal: 6, skill: 6, burst: 6 },
          weapon: null,
        },
      },
    ];
    const diffs = diffRostersForSync(local, cloud);
    assert.equal(diffs.length, 2);
    assert.equal(diffs[0]!.name_id, "owned-local");
    assert.equal(diffs[0]!.ownedChanged, true);
    assert.equal(diffs[0]!.progressChanged, false);
    assert.equal(diffs[1]!.name_id, "progress");
    assert.equal(diffs[1]!.ownedChanged, false);
    assert.equal(diffs[1]!.progressChanged, true);
    assert.equal(diffs[1]!.localProgress?.level, 90);
    assert.equal(diffs[1]!.cloudProgress?.constellation, 2);
  });
});
