/**
 * The reconcile decision table, one rule per case.
 *
 * Run: pnpm exec tsx --test src/lib/sync/reconcile.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideReconcile, type ReconcileInput } from "./reconcile.ts";
import { doc, makeSpec, type Doc } from "./synced-doc.fixtures.ts";
import { tracked, type SyncSlot } from "./slot.ts";

const spec = makeSpec();

function slot(parts: Partial<SyncSlot<Doc>> = {}): SyncSlot<Doc> {
  return {
    v: 1,
    data: doc(),
    dirty: false,
    server: { state: "unseen" },
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
  it("a response that must not offer the guest leaves an empty account alone", () => {
    const plan = decide({ guest: null });
    assert.equal(plan.rule, "no-server-copy");
    assert.equal(plan.clearGuest, false);
    assert.equal(plan.push, null);
  });

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

  it("a deleted copy is detached and waits for Save", () => {
    const plan = decide({
      slot: slot({ data: doc("x"), server: tracked(doc("x"), "r1") }),
    });
    assert.equal(plan.rule, "no-server-copy");
    assert.deepEqual(plan.slot?.server, { state: "detached", base: doc("x") });
    assert.equal(plan.slot?.dirty, true);
    assert.equal(plan.push, null);
  });

  it("a rejected save continues as a create", () => {
    const plan = decide({
      slot: slot({
        data: doc("x"),
        server: tracked(doc("x"), "r1"),
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

  it("a server copy is taken when no guest slot is offered", () => {
    const plan = decide({ guest: null, wire: ["s"], rev: "r1" });
    assert.equal(plan.rule, "take-server");
    assert.equal(plan.clearGuest, false);
    assert.deepEqual(plan.slot?.data.items, ["s"]);
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
      slot: slot({ data: doc("x"), server: tracked(doc(), "r1"), dirty: true }),
      wire: ["x"],
      rev: "r2",
      continueSave: 1,
      attachmentPending: true,
    });
    assert.equal(plan.rule, "attachment-owed");
    assert.equal(plan.slot?.dirty, true);
    assert.deepEqual(plan.slot?.server, tracked(doc("x"), "r2"));
    assert.equal(plan.push, 1);
  });

  it("nothing unsent takes the server copy", () => {
    const plan = decide({
      slot: slot({ data: doc("x"), server: tracked(doc("x"), "r1") }),
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
        server: tracked(doc("x"), "r1"),
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
        server: tracked(doc("x"), "r1"),
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
        server: tracked(doc("x"), "r1"),
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
