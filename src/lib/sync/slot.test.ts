/**
 * Slot server states: decoding (including slots stored before `server`
 * existed) and answering an open question.
 *
 * Run: pnpm exec tsx --test src/lib/sync/slot.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  answerAsk,
  decodeSlot,
  detached,
  tracked,
  type SyncSlot,
} from "./slot.ts";
import { doc, makeSpec, type Doc } from "./synced-doc.fixtures.ts";

const spec = makeSpec();
const decode = (raw: unknown) => decodeSlot(raw, spec.parse, spec.empty, 1);

describe("decodeSlot", () => {
  it("reads every server state", () => {
    assert.deepEqual(
      decode({
        data: { items: ["x"] },
        dirty: true,
        server: { state: "unseen" },
      }).server,
      { state: "unseen" },
    );
    assert.deepEqual(
      decode({
        data: {},
        server: { state: "detached", base: { items: ["b"] } },
      }).server,
      { state: "detached", base: doc("b") },
    );
    assert.deepEqual(
      decode({
        data: {},
        server: { state: "tracked", base: { items: ["b"] }, rev: "r2" },
      }).server,
      tracked(doc("b"), "r2"),
    );
  });

  it("reads slots stored before named states", () => {
    assert.deepEqual(
      decode({ data: {}, base: { items: ["b"] }, baseRev: "r1" }).server,
      tracked(doc("b"), "r1"),
    );
    assert.deepEqual(decode({ data: {}, base: { items: ["b"] } }).server, {
      state: "detached",
      base: doc("b"),
    });
    assert.deepEqual(decode({ data: {}, base: null, baseRev: null }).server, {
      state: "unseen",
    });
  });

  it("a tracked state without a revision is not trusted", () => {
    assert.deepEqual(
      decode({ data: {}, server: { state: "tracked", base: { items: [] } } })
        .server,
      { state: "unseen" },
    );
    assert.deepEqual(decode("junk").server, { state: "unseen" });
  });
});

describe("detached", () => {
  it("keeps the agreed copy and drops the revision", () => {
    assert.deepEqual(detached(tracked(doc("b"), "r1")), {
      state: "detached",
      base: doc("b"),
    });
    assert.deepEqual(detached<Doc>({ state: "unseen" }), { state: "unseen" });
  });
});

describe("answerAsk", () => {
  const slot: SyncSlot<Doc> = {
    v: 1,
    data: doc("mine"),
    dirty: true,
    server: tracked(doc("old"), "r1"),
  };

  it("a server question makes the server copy the agreed one", () => {
    const ask = { source: "server", remote: doc("theirs"), rev: "r2" } as const;
    assert.deepEqual(answerAsk(slot, ask, "local"), {
      ...slot,
      server: tracked(doc("theirs"), "r2"),
      dirty: true,
    });
    assert.deepEqual(answerAsk(slot, ask, "remote"), {
      ...slot,
      data: doc("theirs"),
      server: tracked(doc("theirs"), "r2"),
      dirty: false,
    });
  });

  it("a device question keeps the device copy's own state", () => {
    const ask = {
      source: "device",
      remote: doc("saved"),
      server: { state: "detached", base: doc("b") },
      dirty: true,
    } as const;
    const taken = answerAsk(slot, ask, "remote");
    assert.deepEqual(taken.data, doc("saved"));
    assert.deepEqual(taken.server, { state: "detached", base: doc("b") });
    assert.equal(taken.dirty, true);
  });
});
