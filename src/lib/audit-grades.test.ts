import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AccountBuildGrade } from "./account-build-grade.ts";
import {
  auditEmptyQueueMessage,
  auditRosterFingerprint,
  auditStepLabel,
  auditUngradedNote,
  buildNextRows,
  gradeAuditRoster,
  type AuditRow,
} from "./audit-grades.ts";
import type { CharacterOwned, RosterProgress } from "./definitions.ts";

const progress: RosterProgress = {
  level: 90,
  ascension: 6,
  constellation: 0,
  talents: { normal: 10, skill: 9, burst: 9 },
  weapon: null,
};

function grade(
  bucket: AccountBuildGrade["bucket"],
  priority = 0,
  ungradedReason: AccountBuildGrade["ungradedReason"] = null,
): AccountBuildGrade {
  return {
    bucket,
    complete: true,
    axes: null,
    gaps: [],
    adviceSteps: [],
    advice: [],
    aside: [],
    priority,
    ungradedReason,
  };
}

function row(
  nameId: string,
  bucket: AccountBuildGrade["bucket"],
  opts: {
    priority?: number;
    reason?: AccountBuildGrade["ungradedReason"];
  } = {},
): AuditRow {
  return {
    character: {
      name_id: nameId,
      name: nameId,
      isOwned: true,
    } as CharacterOwned,
    nameId,
    sortName: nameId,
    grade: grade(bucket, opts.priority, opts.reason),
    progress,
    weaponKey: null,
    builds: null,
  };
}

describe("audit-grades", () => {
  it("keeps only characters below their targets", () => {
    const rows = [
      row("A", "needs_work"),
      row("B", "built_well"),
      row("C", "ungraded", { reason: "missing" }),
      row("D", "needs_work"),
    ];
    assert.deepEqual(
      buildNextRows(rows, new Map()).map((r) => r.nameId),
      ["A", "D"],
    );
  });

  it("orders build next by usage, then Builds priority, then name", () => {
    const rows = [
      row("Low", "needs_work", { priority: 50 }),
      row("High", "needs_work", { priority: 1 }),
      row("TieB", "needs_work", { priority: 5 }),
      row("TieA", "needs_work", { priority: 9 }),
    ];
    const usage = new Map([
      ["High", 60],
      ["Low", 5],
      ["TieA", 20],
      ["TieB", 20],
    ]);
    assert.deepEqual(
      buildNextRows(rows, usage).map((r) => r.nameId),
      ["High", "TieA", "TieB", "Low"],
    );
  });

  it("regrades when the same characters change progress", () => {
    const yae = {
      name_id: "Yae",
      name: "Yae",
      isOwned: true,
      progress: { ...progress, level: 80 },
    } as CharacterOwned;
    const beidou = {
      name_id: "Beidou",
      name: "Beidou",
      isOwned: true,
      progress: { ...progress, level: 70 },
    } as CharacterOwned;
    const sameIds = auditRosterFingerprint([
      { ...yae, progress: { ...progress, level: 90 } },
    ]);
    assert.notEqual(auditRosterFingerprint([yae]), sameIds);
    assert.equal(
      auditRosterFingerprint([yae, beidou]),
      auditRosterFingerprint([beidou, yae]),
    );
    assert.equal(
      auditRosterFingerprint([yae]),
      auditRosterFingerprint([{ ...yae }]),
    );
    const armed = {
      ...yae,
      progress: {
        ...progress,
        level: 80,
        weapon: {
          key: "StaffOfHoma",
          level: 80,
          ascension: 6,
          refinement: 1,
        },
      },
    } as CharacterOwned;
    assert.notEqual(
      auditRosterFingerprint([yae]),
      auditRosterFingerprint([armed]),
    );
  });

  it("does not treat an ungraded roster as finished", () => {
    const staleOnly = [
      row("Yae", "ungraded", { reason: "stale" }),
      row("Beidou", "ungraded", { reason: "stale" }),
    ];
    assert.deepEqual(
      buildNextRows(staleOnly, new Map()).map((r) => r.nameId),
      [],
    );
    assert.equal(
      auditEmptyQueueMessage(staleOnly),
      "Couldn’t grade 2 characters — Builds data is out of date.",
    );

    const mixed = [
      row("A", "built_well"),
      row("B", "ungraded", { reason: "missing" }),
    ];
    assert.equal(
      auditEmptyQueueMessage(mixed),
      "1 character meets their Builds targets. Couldn’t grade 1 character — Builds data is missing.",
    );
    assert.equal(
      auditEmptyQueueMessage([row("A", "built_well"), row("B", "built_well")]),
      "Nothing to build here — everyone meets their Builds targets.",
    );
    assert.equal(
      auditUngradedNote([
        row("A", "needs_work"),
        row("Yae", "ungraded", { reason: "stale" }),
        row("C", "ungraded", { reason: "missing" }),
      ]),
      "Couldn’t grade 2 characters — Builds data is missing or out of date.",
    );
    assert.equal(
      auditEmptyQueueMessage([row("A", "ungraded", { reason: "error" })]),
      "Couldn’t grade 1 character — Builds didn’t load.",
    );
  });

  it("labels weapon steps so they can't read as character level", () => {
    assert.equal(
      auditStepLabel({ kind: "level", current: 80, target: 90 }),
      "Lv 80 → Lv 90",
    );
    assert.equal(
      auditStepLabel({ kind: "weapon_level", current: 80, target: 90 }),
      "Weapon Lv 80 → Lv 90",
    );
  });

  it("grades only owned characters and marks summary errors ungraded", () => {
    const roster = [
      {
        name_id: "Hutao",
        name: "Hu Tao",
        isOwned: true,
        progress,
      },
      { name_id: "Amber", name: "Amber", isOwned: false },
    ] as CharacterOwned[];
    const rows = gradeAuditRoster({
      roster,
      weapons: [],
      artifacts: [],
      summaryFor: () => null,
      summaryError: true,
      resolvers: {},
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.nameId, "Hutao");
    assert.equal(rows[0]?.grade.bucket, "ungraded");
    assert.equal(rows[0]?.grade.ungradedReason, "error");
    assert.equal(rows[0]?.progress.level, 90);
  });
});
