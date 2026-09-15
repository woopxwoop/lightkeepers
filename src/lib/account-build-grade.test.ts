import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adviceStepIconSrc,
  compareGradeRows,
  formatAdviceStep,
  gradeOwnedBuild,
  isBuildComplete,
  mainsAxisOk,
  progressAxisOk,
  setAxisOk,
  weaponAxisOk,
} from "./account-build-grade.ts";
import { rosterBuildViewFromOwned } from "./roster-build-card.ts";
import type {
  CharacterOwned,
  InventoryArtifact,
  InventoryWeapon,
} from "./definitions.ts";
import type { CharacterIndex } from "./types/investment.ts";

const baseChar = {
  name_id: "Hutao",
  name: "Hu Tao",
  element: "Pyro",
  rarity: 5,
  weapon_type: "WEAPON_POLE",
  isOwned: true,
  progress: {
    level: 90,
    ascension: 6,
    constellation: 1,
    talents: { normal: 6, skill: 10, burst: 10 },
    weapon: {
      key: "StaffOfHoma",
      level: 90,
      ascension: 6,
      refinement: 1,
    },
  },
} as CharacterOwned;

function piece(
  slotKey: InventoryArtifact["slotKey"],
  setKey: string,
  mainStatKey: string,
): InventoryArtifact {
  return {
    setKey,
    slotKey,
    level: 20,
    rarity: 5,
    mainStatKey,
    location: "HuTao",
    lock: false,
    substats: [],
  };
}

const fullArtifacts: InventoryArtifact[] = [
  piece("flower", "CrimsonWitchOfFlames", "hp"),
  piece("plume", "CrimsonWitchOfFlames", "atk"),
  piece("sands", "CrimsonWitchOfFlames", "hp_"),
  piece("goblet", "CrimsonWitchOfFlames", "pyro_dmg_"),
  piece("circlet", "CrimsonWitchOfFlames", "critRate_"),
];

const homa: InventoryWeapon = {
  key: "StaffOfHoma",
  level: 90,
  ascension: 6,
  refinement: 1,
  location: "HuTao",
  lock: false,
};

function builds(partial: Partial<CharacterIndex> = {}): CharacterIndex {
  return {
    key: "HuTao",
    weapons: [
      { key: "StaffOfHoma", teams: 10, strength: 3 },
      { key: "StaffOfTheScarletSands", teams: 4, strength: 2 },
      { key: "Deathmatch", teams: 3, strength: 1.5 },
      { key: "DragonBane", teams: 2, strength: 1 },
    ],
    sets: [{ key: "CrimsonWitchOfFlames", count: 4, teams: 8 }],
    main_stats: {
      sands: [
        { key: "hp_", teams: 8 },
        { key: "em", teams: 2 },
      ],
      goblet: [
        { key: "pyro_dmg_", teams: 9 },
        { key: "em", teams: 1 },
      ],
      circlet: [
        { key: "critRate_", teams: 5 },
        { key: "critDMG_", teams: 4 },
      ],
    },
    talent_importance: {
      teams: 3,
      auto: {
        mean_pct_drop: 1,
        median_pct_drop: 1,
        min_pct_drop: 1,
        max_pct_drop: 1,
        tier: "negligible",
      },
      skill: {
        mean_pct_drop: 20,
        median_pct_drop: 20,
        min_pct_drop: 20,
        max_pct_drop: 20,
        tier: "high",
      },
      burst: {
        mean_pct_drop: 15,
        median_pct_drop: 15,
        min_pct_drop: 15,
        max_pct_drop: 15,
        tier: "high",
      },
      priority: ["skill", "burst", "auto"],
    },
    level_importance: {
      teams: 3,
      mean_pct_drop: 5,
      median_pct_drop: 5,
      min_pct_drop: 5,
      max_pct_drop: 5,
      tier: "solid",
    },
    ascension_importance: {
      teams: 3,
      mean_pct_drop: 5,
      median_pct_drop: 5,
      min_pct_drop: 5,
      max_pct_drop: 5,
      tier: "solid",
    },
    ...partial,
  };
}

function fullView(
  weapons: InventoryWeapon[] = [homa],
  artifacts: InventoryArtifact[] = fullArtifacts,
  character: CharacterOwned = baseChar,
) {
  return rosterBuildViewFromOwned(character, weapons, artifacts);
}

describe("isBuildComplete", () => {
  it("requires weapon and all five slots", () => {
    assert.equal(isBuildComplete(fullView()), true);
    assert.equal(
      isBuildComplete(fullView([homa], fullArtifacts.slice(0, 4))),
      false,
    );
  });
});

describe("axis helpers", () => {
  it("weaponAxisOk accepts top-3 ranked keys", () => {
    const view = fullView();
    const b = builds();
    assert.equal(weaponAxisOk(view, b), true);
    const low = fullView([{ ...homa, key: "DragonBane" }]);
    assert.equal(weaponAxisOk(low, b), false);
  });

  it("setAxisOk matches recommended piece count", () => {
    assert.equal(setAxisOk(fullView(), builds()), true);
  });

  it("mainsAxisOk requires top-2 mains per slot", () => {
    assert.equal(mainsAxisOk(fullView(), builds()), true);
  });

  it("progressAxisOk uses planner targets from Builds", () => {
    assert.equal(progressAxisOk(fullView(), builds()), true);
    const low = fullView([homa], fullArtifacts, {
      ...baseChar,
      progress: {
        ...baseChar.progress!,
        level: 70,
        ascension: 4,
        talents: { normal: 1, skill: 6, burst: 6 },
      },
    });
    assert.equal(progressAxisOk(low, builds()), false);
  });
});

describe("gradeOwnedBuild", () => {
  it("Built well when progress meets targets (gear does not block)", () => {
    const grade = gradeOwnedBuild({
      view: fullView([{ ...homa, key: "DragonBane" }]),
      builds: builds(),
      nameId: "Hutao",
      getWeaponName: (key) =>
        key === "StaffOfHoma" ? "Staff of Homa" : key,
    });
    assert.equal(grade.bucket, "built_well");
    assert.deepEqual(grade.gaps, []);
    assert.deepEqual(grade.advice, []);
    assert.deepEqual(grade.aside, []);
    assert.equal(grade.priority, 0);
  });

  it("Needs work when talents/level lag; sorted by impact priority", () => {
    const lowImpact = gradeOwnedBuild({
      view: fullView([homa], fullArtifacts, {
        ...baseChar,
        progress: {
          ...baseChar.progress!,
          // Skill only one below high-tier target (10).
          talents: { normal: 6, skill: 9, burst: 10 },
        },
      }),
      builds: builds(),
      nameId: "Hutao",
    });
    const highImpact = gradeOwnedBuild({
      view: fullView([homa], fullArtifacts, {
        ...baseChar,
        progress: {
          ...baseChar.progress!,
          talents: { normal: 6, skill: 6, burst: 6 },
        },
      }),
      builds: builds(),
      nameId: "Hutao",
    });
    assert.equal(lowImpact.bucket, "needs_work");
    assert.equal(highImpact.bucket, "needs_work");
    // Skill+burst lag outranks a single skill point.
    assert.ok(highImpact.priority > lowImpact.priority);
    assert.deepEqual(lowImpact.adviceSteps, [
      { kind: "skill", current: 9, target: 10 },
    ]);
    assert.deepEqual(lowImpact.advice, ["Skill 9 → 10"]);
    assert.equal(formatAdviceStep(lowImpact.adviceSteps[0]!), "Skill 9 → 10");
  });

  it("advice shows current → target for level and talents", () => {
    const grade = gradeOwnedBuild({
      view: fullView([homa], fullArtifacts, {
        ...baseChar,
        progress: {
          ...baseChar.progress!,
          level: 81,
          ascension: 5,
          talents: { normal: 6, skill: 8, burst: 10 },
        },
      }),
      builds: builds(),
      nameId: "Hutao",
    });
    assert.equal(grade.bucket, "needs_work");
    assert.deepEqual(grade.adviceSteps, [
      { kind: "level", current: 81, target: 90 },
      { kind: "ascension", current: 5, target: 6 },
      { kind: "skill", current: 8, target: 10 },
    ]);
    assert.deepEqual(grade.advice, [
      "Lv 81 → Lv 90",
      "A5 → A6",
      "Skill 8 → 10",
    ]);
  });

  it("Liked underleveled weapon is hard Needs work; wrong weapon stays silent", () => {
    const likedLow = gradeOwnedBuild({
      view: fullView([{ ...homa, level: 70, ascension: 4 }]),
      builds: builds(),
      nameId: "Hutao",
      getWeaponStars: (key) => (key === "StaffOfHoma" ? 5 : 4),
    });
    assert.equal(likedLow.bucket, "needs_work");
    assert.deepEqual(likedLow.gaps, ["weapon"]);
    assert.deepEqual(likedLow.adviceSteps, [
      { kind: "weapon_level", current: 70, target: 90 },
      { kind: "weapon_ascension", current: 4, target: 6 },
    ]);
    assert.deepEqual(likedLow.advice, ["Lv 70 → Lv 90", "A4 → A6"]);
    assert.ok(!likedLow.aside.some((line) => /Weapon:/.test(line)));

    const wrong = gradeOwnedBuild({
      view: fullView([{ ...homa, key: "DragonBane", level: 1, ascension: 0 }]),
      builds: builds(),
      nameId: "Hutao",
      getWeaponStars: (key) => (key === "StaffOfHoma" ? 5 : 4),
      getWeaponName: (key) =>
        key === "StaffOfHoma" ? "Staff of Homa" : key,
    });
    assert.equal(wrong.bucket, "built_well");
    assert.deepEqual(wrong.gaps, []);
    assert.deepEqual(wrong.adviceSteps, []);
    assert.ok(!wrong.aside.some((line) => /Weapon:/.test(line)));

    const likedMaxed = gradeOwnedBuild({
      view: fullView([homa]),
      builds: builds(),
      nameId: "Hutao",
      getWeaponStars: (key) => (key === "StaffOfHoma" ? 5 : 4),
    });
    assert.equal(likedMaxed.bucket, "built_well");
    assert.deepEqual(likedMaxed.adviceSteps, []);
  });

  it("Missing gear still grades on progress; gear aside only when Needs work", () => {
    const ok = gradeOwnedBuild({
      view: fullView([homa], fullArtifacts.slice(0, 2)),
      builds: builds(),
      nameId: "Hutao",
      getSetName: (key) =>
        key === "CrimsonWitchOfFlames" ? "Crimson Witch of Flames" : key,
    });
    assert.equal(ok.bucket, "built_well");
    assert.equal(ok.complete, false);
    assert.deepEqual(ok.aside, []);

    const needs = gradeOwnedBuild({
      view: fullView([homa], fullArtifacts.slice(0, 2), {
        ...baseChar,
        progress: {
          ...baseChar.progress!,
          talents: { normal: 1, skill: 6, burst: 6 },
        },
      }),
      builds: builds(),
      nameId: "Hutao",
      getSetName: (key) =>
        key === "CrimsonWitchOfFlames" ? "Crimson Witch of Flames" : key,
    });
    assert.equal(needs.bucket, "needs_work");
    assert.ok(needs.aside.some((line) => /Set:/.test(line)));
  });

  it("Ungraded when summary missing", () => {
    const grade = gradeOwnedBuild({
      view: fullView(),
      builds: null,
      nameId: "Hutao",
    });
    assert.equal(grade.bucket, "ungraded");
    assert.equal(grade.ungradedReason, "missing");
    assert.ok(grade.advice.length > 0);
  });

  it("Ungraded when upToDate false or stale name_id", () => {
    const staleFlag = gradeOwnedBuild({
      view: fullView(),
      builds: builds({ upToDate: false }),
      nameId: "Hutao",
    });
    assert.equal(staleFlag.bucket, "ungraded");
    assert.equal(staleFlag.ungradedReason, "stale");

    const staleId = gradeOwnedBuild({
      view: fullView(),
      builds: builds(),
      nameId: "Yae",
    });
    assert.equal(staleId.bucket, "ungraded");
    assert.equal(staleId.ungradedReason, "stale");
  });

  it("Ungraded on summaryError", () => {
    const grade = gradeOwnedBuild({
      view: fullView(),
      builds: builds(),
      nameId: "Hutao",
      summaryError: true,
    });
    assert.equal(grade.bucket, "ungraded");
    assert.equal(grade.ungradedReason, "error");
  });
});

describe("adviceStepIconSrc", () => {
  it("uses UI items for level/ascension and kit URLs for talents", () => {
    assert.equal(
      adviceStepIconSrc("level", null, (n) => `ui:${n}`),
      "ui:UI_ItemIcon_104003",
    );
    assert.equal(
      adviceStepIconSrc("ascension", null, (n) => `ui:${n}`),
      "ui:UI_ItemIcon_104104",
    );
    assert.equal(
      adviceStepIconSrc(
        "skill",
        { auto: "a.webp", skill: "s.webp", burst: "b.webp" },
        (n) => `ui:${n}`,
      ),
      "s.webp",
    );
    assert.equal(
      adviceStepIconSrc(
        "weapon_level",
        null,
        (n) => `ui:${n}`,
        "homa.webp",
      ),
      "homa.webp",
    );
    assert.equal(adviceStepIconSrc("burst", null, (n) => `ui:${n}`), null);
  });
});

describe("compareGradeRows", () => {
  it("sorts by Stygian cream, then avg usage, then name", () => {
    const low = gradeOwnedBuild({
      view: fullView([homa], fullArtifacts, {
        ...baseChar,
        progress: {
          ...baseChar.progress!,
          talents: { normal: 6, skill: 9, burst: 10 },
        },
      }),
      builds: builds(),
      nameId: "Hutao",
    });
    const high = gradeOwnedBuild({
      view: fullView([homa], fullArtifacts, {
        ...baseChar,
        progress: {
          ...baseChar.progress!,
          talents: { normal: 6, skill: 6, burst: 6 },
        },
      }),
      builds: builds(),
      nameId: "Hutao",
    });
    // Without cream, higher usage wins regardless of Builds impact.
    const usage = new Map([
      ["Zhongli", 40],
      ["Amber", 90],
    ]);
    assert.ok(
      compareGradeRows(
        { sortName: "Amber", nameId: "Amber", grade: low },
        { sortName: "Zhongli", nameId: "Zhongli", grade: high },
        null,
        usage,
      ) < 0,
    );
    // Cream membership beats higher usage.
    const cream = new Set(["Zhongli"]);
    assert.ok(
      compareGradeRows(
        { sortName: "Zhongli", nameId: "Zhongli", grade: high },
        { sortName: "Amber", nameId: "Amber", grade: low },
        cream,
        usage,
      ) < 0,
    );
  });
});
