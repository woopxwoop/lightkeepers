import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { diffRostersForSync } from "./roster-sync-diff.ts";
import type { CharacterOwned } from "./definitions.ts";

function char(name_id: string, isOwned: boolean): CharacterOwned {
  return {
    name_id,
    name: name_id,
    isOwned,
  } as CharacterOwned;
}

/** True when diffRostersForSync reports any owned/progress delta. */
function differ(a: CharacterOwned[], b: CharacterOwned[]): boolean {
  return diffRostersForSync(a, b).length > 0;
}

describe("diffRostersForSync", () => {
  it("ignores catalog-only differences", () => {
    const local = [{ ...char("a", true), rarity: 5 }] as CharacterOwned[];
    const cloud = [{ ...char("a", true), rarity: 4 }] as CharacterOwned[];
    assert.equal(differ(local, cloud), false);
  });

  it("detects owned and progress changes", () => {
    const base = [char("b", true), char("a", false)];
    assert.equal(differ(base, [char("a", false), char("b", true)]), false);
    assert.equal(differ(base, [char("a", true), char("b", true)]), true);

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
    assert.equal(differ(withProgress, withoutProgress), true);
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

  it("diffRostersForSync orders ownership, mixed, then progress with name ties", () => {
    const progress = (
      level: number,
    ): NonNullable<CharacterOwned["progress"]> => ({
      level,
      ascension: 6,
      constellation: 0,
      talents: { normal: 1, skill: 1, burst: 1 },
      weapon: null,
    });
    const local: CharacterOwned[] = [
      { ...char("zeta", true), progress: progress(90) },
      char("beta", true),
      {
        ...char("alpha", true),
        name: "Alpha",
        element: "Pyro",
        progress: progress(90),
      } as CharacterOwned,
      char("gamma", false),
    ];
    const cloud: CharacterOwned[] = [
      { ...char("zeta", true), progress: progress(80) },
      char("beta", false),
      {
        ...char("alpha", false),
        name: "Alpha",
        element: "Pyro",
        progress: progress(70),
      } as CharacterOwned,
      // cloud-only row — local missing
      {
        ...char("cloud-only", true),
        name: "Cloud Only",
        element: "Cryo",
        progress: progress(60),
      } as CharacterOwned,
      char("gamma", true),
    ];
    // local-only ownership change for gamma already; add local-only char
    local.push({
      ...char("local-only", true),
      name: "Local Only",
      element: "Anemo",
    } as CharacterOwned);

    const diffs = diffRostersForSync(local, cloud);
    assert.deepEqual(
      diffs.map((d) => d.name_id),
      ["beta", "gamma", "local-only", "alpha", "cloud-only", "zeta"],
    );

    const mixed = diffs.find((d) => d.name_id === "alpha")!;
    assert.equal(mixed.ownedChanged, true);
    assert.equal(mixed.progressChanged, true);

    const cloudOnly = diffs.find((d) => d.name_id === "cloud-only")!;
    assert.equal(cloudOnly.name, "Cloud Only");
    assert.equal(cloudOnly.portrait.element, "Cryo");
    assert.equal(cloudOnly.localOwned, false);
    assert.equal(cloudOnly.cloudOwned, true);
    assert.equal(cloudOnly.localProgress, null);
    assert.equal(cloudOnly.cloudProgress?.level, 60);

    const localOnly = diffs.find((d) => d.name_id === "local-only")!;
    assert.equal(localOnly.name, "Local Only");
    assert.equal(localOnly.portrait.element, "Anemo");
    assert.equal(localOnly.localOwned, true);
    assert.equal(localOnly.cloudOwned, false);
    assert.equal(localOnly.localProgress, null);
    assert.equal(localOnly.cloudProgress, null);
  });

  it("detects weapon level changes", () => {
    const baseProgress = {
      level: 90,
      ascension: 6,
      constellation: 0,
      talents: { normal: 1, skill: 1, burst: 1 },
      weapon: {
        key: "Deathmatch",
        level: 90,
        ascension: 6,
        refinement: 1,
      },
    };
    const a: CharacterOwned[] = [
      { ...char("a", true), progress: baseProgress },
    ];
    const b: CharacterOwned[] = [
      {
        ...char("a", true),
        progress: {
          ...baseProgress,
          weapon: { ...baseProgress.weapon, level: 80 },
        },
      },
    ];
    assert.equal(differ(a, b), true);
    assert.equal(diffRostersForSync(a, b).length, 1);
  });

  it("detects weapon ascension changes", () => {
    const baseProgress = {
      level: 90,
      ascension: 6,
      constellation: 0,
      talents: { normal: 1, skill: 1, burst: 1 },
      weapon: {
        key: "Deathmatch",
        level: 90,
        ascension: 6,
        refinement: 1,
      },
    };
    const a: CharacterOwned[] = [
      { ...char("a", true), progress: baseProgress },
    ];
    const b: CharacterOwned[] = [
      {
        ...char("a", true),
        progress: {
          ...baseProgress,
          weapon: { ...baseProgress.weapon, ascension: 5 },
        },
      },
    ];
    assert.equal(differ(a, b), true);
    assert.equal(diffRostersForSync(a, b).length, 1);
  });

  it("detects talent-only changes", () => {
    const baseProgress = {
      level: 90,
      ascension: 6,
      constellation: 0,
      talents: { normal: 1, skill: 1, burst: 1 },
      weapon: {
        key: "Deathmatch",
        level: 90,
        ascension: 6,
        refinement: 1,
      },
    };
    const a: CharacterOwned[] = [
      { ...char("a", true), progress: baseProgress },
    ];
    const b: CharacterOwned[] = [
      {
        ...char("a", true),
        progress: {
          ...baseProgress,
          talents: { normal: 9, skill: 9, burst: 9 },
        },
      },
    ];
    assert.equal(differ(a, b), true);
    assert.equal(diffRostersForSync(a, b).length, 1);
  });

  it("detects weapon key and refinement changes", () => {
    const baseProgress = {
      level: 90,
      ascension: 6,
      constellation: 0,
      talents: { normal: 1, skill: 1, burst: 1 },
      weapon: {
        key: "Deathmatch",
        level: 90,
        ascension: 6,
        refinement: 1,
      },
    };
    const local: CharacterOwned[] = [
      { ...char("a", true), progress: baseProgress },
    ];
    const keyChanged: CharacterOwned[] = [
      {
        ...char("a", true),
        progress: {
          ...baseProgress,
          weapon: { ...baseProgress.weapon, key: "StaffOfHoma" },
        },
      },
    ];
    const refinementChanged: CharacterOwned[] = [
      {
        ...char("a", true),
        progress: {
          ...baseProgress,
          weapon: { ...baseProgress.weapon, refinement: 5 },
        },
      },
    ];
    assert.equal(differ(local, keyChanged), true);
    assert.equal(diffRostersForSync(local, keyChanged).length, 1);
    assert.equal(differ(local, refinementChanged), true);
    assert.equal(diffRostersForSync(local, refinementChanged).length, 1);
  });
});
