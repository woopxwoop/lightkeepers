import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  goodKeysForRosterName,
  parseRosterProgress,
  progressToCharacterStart,
  rosterProgressForNameId,
} from "./roster-progress.ts";
import type { RosterProgress } from "./definitions.ts";

const hutao: RosterProgress = {
  level: 90,
  ascension: 6,
  constellation: 2,
  talents: { normal: 6, skill: 9, burst: 8 },
  weapon: {
    key: "StaffOfHoma",
    level: 90,
    ascension: 6,
    refinement: 1,
  },
};

describe("parseRosterProgress", () => {
  it("accepts a full snapshot and rejects broken shapes", () => {
    assert.deepEqual(parseRosterProgress(hutao), hutao);
    assert.equal(parseRosterProgress(null), null);
    assert.equal(parseRosterProgress({ level: 90 }), null);
    assert.equal(
      parseRosterProgress({ ...hutao, weapon: { key: "StaffOfHoma" } }),
      null,
    );
  });
});

describe("progressToCharacterStart", () => {
  it("copies level, ascension, and talents for the planner", () => {
    assert.deepEqual(progressToCharacterStart(hutao), {
      level: 90,
      ascension: 6,
      talents: { normal: 6, skill: 9, burst: 8 },
    });
  });
});

describe("goodKeysForRosterName", () => {
  it("fans Traveler out to element keys used in GOOD files", () => {
    assert.deepEqual(goodKeysForRosterName("Hu Tao"), ["HuTao"]);
    assert.ok(goodKeysForRosterName("Traveler").includes("Traveler"));
    assert.ok(goodKeysForRosterName("Traveler").includes("TravelerPyro"));
  });
});

describe("rosterProgressForNameId", () => {
  it("maps Traveler kits to the Traveler roster row", () => {
    const roster = [
      { name_id: "Hutao", isOwned: true, progress: hutao },
      {
        name_id: "PlayerBoy",
        isOwned: true,
        progress: { ...hutao, level: 70, weapon: null },
      },
    ];
    assert.equal(rosterProgressForNameId(roster, "Hutao")?.constellation, 2);
    assert.equal(rosterProgressForNameId(roster, "PlayerBoy-Pyro")?.level, 70);
    assert.equal(rosterProgressForNameId(roster, "Beidou"), null);
  });

  it("overlays an equipped inventory weapon and keeps stored weapon otherwise", () => {
    const roster = [
      {
        name: "Hu Tao",
        name_id: "Hutao",
        isOwned: true,
        progress: hutao,
      },
    ];
    const equipped = rosterProgressForNameId(roster, "Hutao", [
      {
        key: "StaffOfTheScarletSands",
        level: 80,
        ascension: 5,
        refinement: 1,
        location: "HuTao",
        lock: false,
      },
    ]);
    assert.equal(equipped?.weapon?.key, "StaffOfTheScarletSands");
    const unequippedOnly = rosterProgressForNameId(roster, "Hutao", [
      {
        key: "DragonBane",
        level: 70,
        ascension: 5,
        refinement: 3,
        location: "",
        lock: true,
      },
    ]);
    assert.deepEqual(unequippedOnly?.weapon, hutao.weapon);
  });
});
