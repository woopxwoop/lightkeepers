import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activateConstellation,
  ascensionForCapInput,
  constellationAfterActivate,
  levelFieldDraft,
  progressWithLevelInput,
  stepConstellation,
  stepTalent,
} from "./roster-progress-edit.ts";
import type { RosterProgress } from "../definitions.ts";

const base: RosterProgress = {
  level: 80,
  ascension: 5,
  constellation: 2,
  talents: { normal: 6, skill: 9, burst: 10 },
  weapon: {
    key: "StaffOfHoma",
    level: 90,
    ascension: 6,
    refinement: 1,
  },
};

describe("constellationAfterActivate", () => {
  it("unlocks through a locked index", () => {
    assert.equal(constellationAfterActivate(2, 5), 5);
  });

  it("drops to index − 1 when already unlocked", () => {
    assert.equal(constellationAfterActivate(4, 3), 2);
    assert.equal(constellationAfterActivate(1, 1), 0);
  });

  it("clamps to 0–6", () => {
    assert.equal(constellationAfterActivate(0, 9), 6);
    assert.equal(constellationAfterActivate(6, 9), 5);
    assert.equal(constellationAfterActivate(0, -3), 0);
  });
});

describe("activateConstellation / stepConstellation", () => {
  it("copies talents, keeps the weapon reference", () => {
    const next = activateConstellation(base, 6);
    assert.equal(next.constellation, 6);
    assert.deepEqual(next.talents, base.talents);
    assert.notEqual(next.talents, base.talents);
    assert.equal(next.weapon, base.weapon);
  });

  it("steps within 0–6 and always returns a fresh progress", () => {
    assert.equal(stepConstellation(base, 1).constellation, 3);
    assert.equal(stepConstellation(base, -5).constellation, 0);
    const capped = stepConstellation({ ...base, constellation: 6 }, 1);
    assert.equal(capped.constellation, 6);
    assert.notEqual(capped.talents, base.talents);
  });
});

describe("stepTalent", () => {
  it("bumps one slot", () => {
    const next = stepTalent(base, "normal", 1);
    assert.deepEqual(next?.talents, { normal: 7, skill: 9, burst: 10 });
    assert.equal(next?.weapon, base.weapon);
  });

  it("returns null at the 1 / 10 bounds", () => {
    assert.equal(stepTalent(base, "burst", 1), null);
    assert.equal(
      stepTalent(
        { ...base, talents: { ...base.talents, skill: 1 } },
        "skill",
        -1,
      ),
      null,
    );
  });
});

describe("ascensionForCapInput", () => {
  it("maps exact caps to their ascension", () => {
    assert.equal(ascensionForCapInput(20), 0);
    assert.equal(ascensionForCapInput(80), 5);
    assert.equal(ascensionForCapInput(90), 6);
  });

  it("picks the nearest cap, lower on ties", () => {
    assert.equal(ascensionForCapInput(84), 5);
    assert.equal(ascensionForCapInput(86), 6);
    assert.equal(ascensionForCapInput(30), 0);
    assert.equal(ascensionForCapInput(999), 6);
  });
});

describe("levelFieldDraft", () => {
  it("starts from the level or the ascension cap", () => {
    assert.equal(levelFieldDraft(base, "level"), "80");
    assert.equal(levelFieldDraft(base, "cap"), "80");
    assert.equal(levelFieldDraft({ ...base, ascension: 6 }, "cap"), "90");
  });
});

describe("progressWithLevelInput", () => {
  it("clamps a typed level to the current cap", () => {
    const next = progressWithLevelInput(base, "level", "95");
    assert.equal(next, null);
    const lower = progressWithLevelInput(base, "level", "72.4");
    assert.equal(lower?.level, 72);
    assert.equal(lower?.ascension, 5);
    assert.equal(lower?.weapon, base.weapon);
  });

  it("raises ascension from a typed cap, keeping level", () => {
    const next = progressWithLevelInput(base, "cap", "90");
    assert.equal(next?.ascension, 6);
    assert.equal(next?.level, 80);
  });

  it("lowers ascension and clamps level to the new cap", () => {
    const next = progressWithLevelInput(base, "cap", "60");
    assert.equal(next?.ascension, 3);
    assert.equal(next?.level, 60);
  });

  it("returns null for non-finite input or no change", () => {
    assert.equal(progressWithLevelInput(base, "level", "abc"), null);
    assert.equal(progressWithLevelInput(base, "level", "80"), null);
    assert.equal(progressWithLevelInput(base, "cap", "80"), null);
  });

  it("treats a cleared field as cancel, not level 1 or A0", () => {
    assert.equal(progressWithLevelInput(base, "level", ""), null);
    assert.equal(progressWithLevelInput(base, "level", "  "), null);
    assert.equal(progressWithLevelInput(base, "cap", ""), null);
  });
});
