import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { captureRoster, rosterDiffersFromSnapshot } from "./roster-snapshot.ts";
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
});
