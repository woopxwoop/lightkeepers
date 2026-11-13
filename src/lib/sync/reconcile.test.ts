/**
 * The reconcile decision table, one rule per case.
 *
 * Run: pnpm exec tsx --test src/lib/sync/reconcile.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideReconcile, type ReconcileInput } from "./reconcile.ts";
import { doc, makeSpec, type Doc } from "./synced-doc.fixtures.ts";
import type { SyncSlot } from "./synced-doc.ts";

const spec = makeSpec();

function slot(parts: Partial<SyncSlot<Doc>> = {}): SyncSlot<Doc> {
  return {
    v: 1,
    data: doc(),
    base: null,
    baseRev: null,
    dirty: false,
    ...parts,
  };
}

function decide(parts: Partial<ReconcileInput<Doc>>) {
  return decideReconcile(spec, {
    slot: slot(),
    guest: slot(),
    wire: null,
    rev: null,
    continueSave: null,
    attachmentPending: false,
    ...parts,
  });
}

describe("decideReconcile: no server copy", () => {
  it("an untouched account takes guest data and sends it", () => {
    const plan = decide({ guest: slot({ data: doc("g") }) });
    assert.equal(plan.rule, "first-copy-from-guest");
    assert.deepEqual(plan.slot?.data.items, ["g"]);
    assert.equal(plan.clearGuest, true);
    assert.equal(plan.push, 0);
  });

  it("data never synced anywhere is the first upload", () => {
    const plan = decide({ slot: slot({ data: doc("x"), dirty: true }) });
    assert.equal(plan.rule, "first-upload");
    assert.equal(plan.push, 0);
  });

  it("a deleted copy keeps its base and waits for Save", () => {
    const plan = decide({
      slot: slot({ data: doc("x"), base: doc("x"), baseRev: "r1" }),
    });
    assert.equal(plan.rule, "no-server-copy");
    assert.deepEqual(plan.slot?.base?.items, ["x"]);
    assert.equal(plan.slot?.baseRev, null);
    assert.equal(plan.slot?.dirty, true);
    assert.equal(plan.push, null);
  });

  it("a rejected save continues as a create", () => {
    const plan = decide({
      slot: slot({
        data: doc("x"),
        base: doc("x"),
        baseRev: "r1",
        dirty: true,
      }),
      continueSave: 2,
    });
    assert.equal(plan.rule, "no-server-copy");
    assert.equal(plan.push, 2);
  });
});

describe("decideReconcile: server copy", () => {
  it("guest data meeting a server copy is merged, unsent", () => {
    const plan = decide({
      guest: slot({ data: doc("g") }),
      wire: ["s"],
      rev: "r1",
    });
    assert.equal(plan.rule, "guest-merged");
    assert.deepEqual(plan.slot?.data.items, ["s", "g"]);
    assert.equal(plan.slot?.dirty, true);
    assert.equal(plan.clearGuest, true);
    assert.equal(plan.push, null);
  });

  it("an asking spec asks about guest data", () => {
    const plan = decideReconcile(makeSpec({ ask: true }), {
      slot: slot(),
      guest: slot({ data: doc("g") }),
      wire: ["s"],
      rev: "r1",
      continueSave: null,
      attachmentPending: false,
    });
    assert.equal(plan.rule, "guest-asks");
    assert.deepEqual(plan.ask?.remote.items, ["s"]);
  });

  it("matching data that owes an attachment stays unsent", () => {
    const plan = decide({
      slot: slot({ data: doc("x"), base: doc(), baseRev: "r1", dirty: true }),
      wire: ["x"],
      rev: "r2",
      continueSave: 1,
      attachmentPending: true,
    });
    assert.equal(plan.rule, "attachment-owed");
    assert.equal(plan.slot?.dirty, true);
    assert.equal(plan.slot?.baseRev, "r2");
    assert.equal(plan.push, 1);
  });

  it("nothing unsent takes the server copy", () => {
    const plan = decide({
      slot: slot({ data: doc("x"), base: doc("x"), baseRev: "r1" }),
      wire: ["x", "y"],
      rev: "r2",
    });
    assert.equal(plan.rule, "take-server");
    assert.deepEqual(plan.slot?.data.items, ["x", "y"]);
    assert.equal(plan.slot?.dirty, false);
  });

  it("an unmoved server leaves unsent edits alone", () => {
    const plan = decide({
      slot: slot({
        data: doc("x", "y"),
        base: doc("x"),
        baseRev: "r1",
        dirty: true,
      }),
      wire: ["x"],
      rev: "r1",
    });
    assert.equal(plan.rule, "server-unmoved");
    assert.equal(plan.slot, null);
    assert.equal(plan.push, null);
  });

  it("unsent edits merge onto a moved server copy; a read does not send", () => {
    const plan = decide({
      slot: slot({
        data: doc("x", "mine"),
        base: doc("x"),
        baseRev: "r1",
        dirty: true,
      }),
      wire: ["x", "theirs"],
      rev: "r2",
    });
    assert.equal(plan.rule, "merged");
    assert.deepEqual(plan.slot?.data.items, ["x", "theirs", "mine"]);
    assert.equal(plan.slot?.dirty, true);
    assert.equal(plan.push, null);
  });

  it("an asking spec asks instead of merging", () => {
    const plan = decideReconcile(makeSpec({ ask: true }), {
      slot: slot({
        data: doc("x", "mine"),
        base: doc("x"),
        baseRev: "r1",
        dirty: true,
      }),
      guest: slot(),
      wire: ["x", "theirs"],
      rev: "r2",
      continueSave: null,
      attachmentPending: false,
    });
    assert.equal(plan.rule, "ask");
    assert.equal(plan.slot, null);
  });
});
