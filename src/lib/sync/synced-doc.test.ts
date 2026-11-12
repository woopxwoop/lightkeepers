/**
 * Synced-document engine (docs/design/account-sync.md).
 *
 * The fake server applies the real route rules: `baseRev` compare-and-swap,
 * create-only on null, and refusing a write for an account that is not
 * signed in. `hold()` keeps requests in flight to test account switches.
 *
 * Run: pnpm exec tsx --test src/lib/sync/synced-doc.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { get } from "svelte/store";
import {
  createSyncedDoc,
  defineSyncedDocSpec,
  type MergeResult,
} from "./synced-doc.ts";
import { memorySlotStorage } from "./storage.ts";
import type { SyncTransport } from "./transport.ts";

type Doc = { items: string[]; pick: string | null };

const doc = (...items: string[]): Doc => ({ items, pick: null });

function strings(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === "string")
    : [];
}

/** Union merge: keep local adds and removes, take the rest from remote. */
function unionMerge(base: Doc | null, local: Doc, remote: Doc): Doc {
  const before = new Set(base?.items ?? []);
  const localSet = new Set(local.items);
  const removed = new Set([...before].filter((x) => !localSet.has(x)));
  const items = remote.items.filter((x) => !removed.has(x));
  for (const x of local.items) if (!items.includes(x)) items.push(x);
  return { items, pick: local.pick };
}

function makeSpec(mode: { ask: boolean } = { ask: false }) {
  return defineSyncedDocSpec<Doc>({
    key: "t",
    endpoint: "/api/t",
    field: "items",
    schemaVersion: 1,
    empty: () => doc(),
    parse: (raw) => {
      const rec = raw as { items?: unknown; pick?: unknown } | null;
      return {
        items: strings(rec?.items),
        pick: typeof rec?.pick === "string" ? rec.pick : null,
      };
    },
    toWire: (d) => d.items,
    fromWire: (wire, local) => ({ items: strings(wire), pick: local.pick }),
    equal: (a, b) => JSON.stringify(a.items) === JSON.stringify(b.items),
    merge: (base, local, remote): MergeResult<Doc> =>
      mode.ask ? "ask" : unionMerge(base, local, remote),
  });
}

function fakeServer() {
  const rows = new Map<string, { items: string[]; rev: string }>();
  const calls: string[] = [];
  let revN = 0;
  let gate: Promise<void> = Promise.resolve();
  const server = {
    rows,
    calls,
    session: null as string | null,
    failReads: false,
    failWrites: false,
    attached: [] as Record<string, unknown>[],
    /** Hold every request until the returned release() runs. */
    hold(): () => void {
      let release!: () => void;
      gate = new Promise<void>((r) => (release = r));
      return () => {
        release();
        gate = Promise.resolve();
      };
    },
    /** Another device writes directly. */
    put(account: string, items: string[]) {
      rows.set(account, { items, rev: `r${++revN}` });
    },
  };
  const transport: SyncTransport = {
    async read() {
      const session = server.session;
      calls.push(`read:${session}`);
      await gate;
      if (server.failReads) return { status: "error", message: "offline" };
      if (session === null) return { status: "error", message: "401" };
      const row = rows.get(session);
      return {
        status: "ok",
        wire: row ? [...row.items] : null,
        rev: row?.rev ?? null,
        account: session,
      };
    },
    async write(wire, baseRev, account, attach) {
      calls.push(`write:${account}:${baseRev}`);
      if (attach) server.attached.push(attach);
      await gate;
      if (server.failWrites) return { status: "error", message: "offline" };
      if (account !== server.session) {
        return { status: "error", message: "Sync failed (403)" };
      }
      const row = rows.get(account);
      if ((row?.rev ?? null) !== baseRev) {
        return {
          status: "conflict",
          wire: row ? [...row.items] : null,
          rev: row?.rev ?? null,
        };
      }
      server.put(account, strings(wire));
      return { status: "written", rev: rows.get(account)!.rev };
    },
  };
  return { server, transport };
}

function setup(mode?: { ask: boolean }) {
  const storage = memorySlotStorage();
  const { server, transport } = fakeServer();
  const synced = createSyncedDoc(makeSpec(mode), { storage, transport });
  const signIn = (id: string | null) => {
    server.session = id;
    synced.setAccount(id);
  };
  return { storage, server, synced, signIn, view: () => get(synced.view) };
}

describe("guest", () => {
  it("stores on the device only", async () => {
    const { synced, signIn, server, storage, view } = setup();
    signIn(null);
    await synced.commit(doc("a"));
    assert.deepEqual(view().data.items, ["a"]);
    assert.equal(view().status, "local");
    assert.deepEqual(server.calls, []);
    assert.ok(storage.entries.has("lk:t:guest"));
  });

  it("refuses to commit before the session is known", () => {
    const { synced } = setup();
    assert.throws(() => synced.commit(doc("a")), /setAccount must run first/);
  });
});

describe("signed in", () => {
  it("is not ready until the session is known", async () => {
    const { synced, signIn, view } = setup();
    assert.equal(view().ready, false);
    signIn(null);
    assert.equal(view().ready, true);
    void synced;
  });

  it("takes the server copy when nothing is pending locally", async () => {
    const { synced, signIn, server, view } = setup();
    server.put("a", ["x", "y"]);
    signIn("a");
    assert.equal(view().status, "loading");
    await synced.idle();
    assert.deepEqual(view().data.items, ["x", "y"]);
    assert.equal(view().status, "synced");
  });

  it("creates the server copy when the account has none", async () => {
    const { synced, signIn, server, view } = setup();
    signIn("a");
    await synced.idle();
    await synced.commit(doc("a1"));
    await synced.idle();
    assert.deepEqual(server.rows.get("a")?.items, ["a1"]);
    assert.ok(server.calls.includes("write:a:null"));
    assert.equal(view().status, "synced");
  });

  it("sends edits against the last revision", async () => {
    const { synced, signIn, server, view } = setup();
    server.put("a", ["x"]);
    signIn("a");
    await synced.idle();
    await synced.commit(doc("x", "y"));
    await synced.idle();
    assert.ok(server.calls.includes("write:a:r1"));
    assert.deepEqual(server.rows.get("a")?.items, ["x", "y"]);
    assert.equal(view().status, "synced");
  });

  it("a stale draft merges onto newer data instead of replacing it", async () => {
    const { synced, signIn, server, view } = setup();
    server.put("a", ["x"]);
    signIn("a");
    await synced.idle();
    const draftBase = view().data; // a page took its draft here
    await synced.commit(doc("x", "other-surface")); // another surface saved
    await synced.idle();
    await synced.commit(doc("x", "draft-edit"), { basedOn: draftBase });
    await synced.idle();
    assert.deepEqual(server.rows.get("a")?.items, [
      "x",
      "other-surface",
      "draft-edit",
    ]);
  });

  it("device-only changes do not send anything", async () => {
    const { synced, signIn, server } = setup();
    server.put("a", ["x"]);
    signIn("a");
    await synced.idle();
    await synced.commit({ items: ["x"], pick: "x" });
    await synced.idle();
    assert.equal(server.calls.filter((c) => c.startsWith("write")).length, 0);
  });

  it("merges after a conflict and sends the merge", async () => {
    const { synced, signIn, server, view } = setup();
    server.put("a", ["x"]);
    signIn("a");
    await synced.idle();
    server.put("a", ["x", "other-device"]); // r2
    await synced.commit(doc("x", "mine"));
    await synced.idle();
    assert.deepEqual(server.rows.get("a")?.items, [
      "x",
      "other-device",
      "mine",
    ]);
    assert.deepEqual(view().data.items, ["x", "other-device", "mine"]);
    assert.equal(view().status, "synced");
  });

  it("keeps a local removal through a conflict", async () => {
    const { synced, signIn, server } = setup();
    server.put("a", ["x", "y"]);
    signIn("a");
    await synced.idle();
    server.put("a", ["x", "y", "z"]);
    await synced.commit(doc("x"));
    await synced.idle();
    assert.deepEqual(server.rows.get("a")?.items, ["x", "z"]);
  });

  it("an edit made while saving is sent next", async () => {
    const { synced, signIn, server, view } = setup();
    server.put("a", ["x"]);
    signIn("a");
    await synced.idle();
    const release = server.hold();
    const first = synced.commit(doc("x", "1"));
    await Promise.resolve();
    void synced.commit(doc("x", "1", "2"));
    release();
    await first;
    await synced.idle();
    assert.deepEqual(server.rows.get("a")?.items, ["x", "1", "2"]);
    assert.equal(view().status, "synced");
  });
});

describe("failures", () => {
  it("a failed save stays unsent, and a refresh does not send it", async () => {
    const { synced, signIn, server, view } = setup();
    server.put("a", ["x"]);
    signIn("a");
    await synced.idle();
    server.failWrites = true;
    await synced.commit(doc("x", "mine"));
    assert.equal(view().status, "dirty");
    assert.match(view().error ?? "", /offline/);
    server.failWrites = false;
    await synced.refresh();
    await synced.idle();
    assert.deepEqual(server.rows.get("a")?.items, ["x"]);
    assert.equal(view().status, "dirty");
    // Save sends what is already unsent.
    await synced.commit(view().data);
    await synced.idle();
    assert.deepEqual(server.rows.get("a")?.items, ["x", "mine"]);
    assert.equal(view().status, "synced");
  });

  it("a read merges in the other device's changes but sends nothing", async () => {
    const { synced, signIn, server, view } = setup();
    server.put("a", ["x"]);
    signIn("a");
    await synced.idle();
    server.failWrites = true;
    await synced.commit(doc("x", "mine"));
    server.failWrites = false;
    server.put("a", ["x", "theirs"]);
    const writesBefore = server.calls.filter((c) =>
      c.startsWith("write"),
    ).length;
    await synced.refresh();
    await synced.idle();
    assert.deepEqual(view().data.items, ["x", "theirs", "mine"]);
    assert.equal(view().status, "dirty");
    assert.equal(
      server.calls.filter((c) => c.startsWith("write")).length,
      writesBefore,
    );
    assert.deepEqual(server.rows.get("a")?.items, ["x", "theirs"]);
    // The merge is now based on the newer copy, so Save does not conflict.
    await synced.commit(view().data);
    await synced.idle();
    assert.deepEqual(server.rows.get("a")?.items, ["x", "theirs", "mine"]);
  });

  it("opening the app with unsent edits does not send them", async () => {
    const storage = memorySlotStorage();
    const { server, transport } = fakeServer();
    server.put("a", ["x"]);
    server.session = "a";
    const first = createSyncedDoc(makeSpec(), { storage, transport });
    first.setAccount("a");
    await first.idle();
    server.failWrites = true;
    await first.commit(doc("x", "offline-edit"));
    first.dispose();
    server.failWrites = false;
    const reopened = createSyncedDoc(makeSpec(), { storage, transport });
    reopened.setAccount("a");
    await reopened.idle();
    assert.deepEqual(server.rows.get("a")?.items, ["x"]);
    assert.equal(get(reopened.view).status, "dirty");
    assert.deepEqual(get(reopened.view).data.items, ["x", "offline-edit"]);
  });

  it("the slot survives a reload", async () => {
    const storage = memorySlotStorage();
    const { transport } = fakeServer();
    const first = createSyncedDoc(makeSpec(), { storage, transport });
    first.setAccount(null);
    await first.commit(doc("kept"));
    first.dispose();
    const reloaded = createSyncedDoc(makeSpec(), { storage, transport });
    reloaded.setAccount(null);
    assert.deepEqual(get(reloaded.view).data.items, ["kept"]);
  });

  it("a failed storage write still updates this tab", async () => {
    const { synced, signIn, storage, view } = setup();
    storage.failWrites = true;
    signIn(null);
    await synced.commit(doc("memory-only"));
    assert.deepEqual(view().data.items, ["memory-only"]);
  });
});

describe("accounts", () => {
  it("a late response for A lands in A's slot, never B's", async () => {
    const { synced, signIn, server, view, storage } = setup();
    server.put("a", ["a-data"]);
    server.put("b", ["b-data"]);
    const release = server.hold();
    signIn("a");
    await Promise.resolve();
    signIn("b"); // A's read is still in flight, answered for A's cookie
    release();
    await synced.idle();
    assert.equal(view().account, "b");
    assert.deepEqual(view().data.items, ["b-data"]);
    const aSlot = storage.read("lk:t:a") as { data: Doc } | null;
    assert.deepEqual(aSlot?.data.items, ["a-data"]);
  });

  it("a read answered for another session is dropped", async () => {
    const { synced, server, view, storage } = setup();
    server.put("b", ["b-data"]);
    server.session = "b"; // cookie changed; the client still thinks A
    synced.setAccount("a");
    await synced.idle();
    assert.equal(storage.read("lk:t:a"), null);
    assert.equal(storage.read("lk:t:b"), null);
    assert.equal(view().status, "loading");
  });

  it("A's unsent edits wait in A's slot and are not sent as B", async () => {
    const { synced, signIn, server, view } = setup();
    server.put("a", ["a-data"]);
    signIn("a");
    await synced.idle();
    server.failReads = true;
    const release = server.hold();
    const pending = synced.commit(doc("a-data", "a-edit"));
    server.session = "b"; // cookie changes before the client notices
    release();
    await pending;
    assert.deepEqual(server.rows.get("a")?.items, ["a-data"]);
    assert.equal(server.rows.has("b"), false);
    assert.match(view().error ?? "", /403/);
    // Back on A, the edit is still unsent and waits for Save.
    server.failReads = false;
    synced.setAccount("b");
    server.session = "a";
    synced.setAccount("a");
    await synced.idle();
    assert.deepEqual(server.rows.get("a")?.items, ["a-data"]);
    assert.equal(view().status, "dirty");
    await synced.commit(view().data);
    await synced.idle();
    assert.deepEqual(server.rows.get("a")?.items, ["a-data", "a-edit"]);
  });

  it("guest data becomes the first copy when the account has none", async () => {
    const { synced, signIn, server, storage, view } = setup();
    signIn(null);
    await synced.commit(doc("guest-1"));
    signIn("a");
    await synced.idle();
    assert.deepEqual(server.rows.get("a")?.items, ["guest-1"]);
    assert.equal(view().status, "synced");
    const guest = storage.read("lk:t:guest") as { data: Doc } | null;
    assert.deepEqual(guest?.data.items, []);
  });

  it("a second account does not take guest data already adopted", async () => {
    const { synced, signIn, server } = setup();
    signIn(null);
    await synced.commit(doc("guest-1"));
    signIn("a");
    await synced.idle();
    signIn(null);
    signIn("b");
    await synced.idle();
    assert.equal(server.rows.has("b"), false);
  });

  it("guest data meeting a server copy is merged and left unsent", async () => {
    const { synced, signIn, server, view, storage } = setup();
    server.put("a", ["server"]);
    signIn(null);
    await synced.commit(doc("guest-1"));
    signIn("a");
    await synced.idle();
    assert.deepEqual(view().data.items, ["server", "guest-1"]);
    assert.equal(view().status, "dirty");
    assert.deepEqual(server.rows.get("a")?.items, ["server"]);
    assert.equal(storage.read("lk:t:guest") === null, false);
    assert.deepEqual(
      (storage.read("lk:t:guest") as { data: Doc }).data.items,
      [],
    );
    await synced.commit(view().data);
    await synced.idle();
    assert.deepEqual(server.rows.get("a")?.items, ["server", "guest-1"]);
  });

  it("guest data equal to the server copy changes nothing", async () => {
    const { synced, signIn, server, view } = setup();
    server.put("a", ["same"]);
    signIn(null);
    await synced.commit(doc("same"));
    signIn("a");
    await synced.idle();
    assert.equal(view().status, "synced");
  });

  it("a spec that asks gets the guest-vs-server question", async () => {
    const { synced, signIn, server, view } = setup({ ask: true });
    server.put("a", ["server"]);
    signIn(null);
    await synced.commit(doc("guest-1"));
    signIn("a");
    await synced.idle();
    assert.equal(view().status, "ask");
    assert.deepEqual(view().data.items, ["guest-1"]);
    assert.deepEqual(view().remote?.items, ["server"]);
    await synced.resolve("local");
    await synced.idle();
    assert.deepEqual(server.rows.get("a")?.items, ["guest-1"]);
  });

  it("explicit adoption replaces the account's copy", async () => {
    const { synced, signIn, server } = setup();
    server.put("a", ["server"]);
    signIn("a");
    await synced.idle();
    signIn(null);
    await synced.commit(doc("guest-1"));
    signIn("a");
    await synced.idle();
    await synced.adoptGuest();
    await synced.idle();
    assert.deepEqual(server.rows.get("a")?.items, ["guest-1"]);
  });
});

describe("ask", () => {
  it("waits for the user, then keeps the chosen side", async () => {
    const mode = { ask: true };
    const { synced, signIn, server, view } = setup(mode);
    server.put("a", ["x"]);
    signIn("a");
    await synced.idle();
    server.put("a", ["theirs"]);
    await synced.commit(doc("mine"));
    await synced.idle();
    assert.equal(view().status, "ask");
    assert.deepEqual(view().remote?.items, ["theirs"]);
    await synced.resolve("local");
    await synced.idle();
    assert.deepEqual(server.rows.get("a")?.items, ["mine"]);
    assert.equal(view().status, "synced");
  });

  it("taking the server copy drops local edits", async () => {
    const mode = { ask: true };
    const { synced, signIn, server, view } = setup(mode);
    server.put("a", ["x"]);
    signIn("a");
    await synced.idle();
    server.put("a", ["theirs"]);
    await synced.commit(doc("mine"));
    await synced.idle();
    await synced.resolve("remote");
    await synced.idle();
    assert.deepEqual(view().data.items, ["theirs"]);
    assert.equal(view().status, "synced");
  });
});

describe("save answers and attachments", () => {
  it("saving while asked sends the saved copy", async () => {
    const { synced, signIn, server, view } = setup({ ask: true });
    server.put("a", ["x"]);
    signIn("a");
    await synced.idle();
    server.put("a", ["theirs"]);
    await synced.commit(doc("mine"));
    await synced.idle();
    assert.equal(view().status, "ask");
    await synced.commit(doc("mine", "more"));
    await synced.idle();
    assert.deepEqual(server.rows.get("a")?.items, ["mine", "more"]);
    assert.equal(view().status, "synced");
  });

  it("an attachment rides one write, even with no data change", async () => {
    const { synced, signIn, server } = setup();
    server.put("a", ["x"]);
    signIn("a");
    await synced.idle();
    await synced.commit(doc("x"), { attach: { weapons: [1] } });
    await synced.idle();
    assert.deepEqual(server.attached, [{ weapons: [1] }]);
    await synced.commit(doc("x", "y"));
    await synced.idle();
    assert.equal(server.attached.length, 1);
  });
});

describe("other tabs", () => {
  it("a change to the active slot updates the view", async () => {
    const { synced, signIn, storage, view } = setup();
    signIn(null);
    storage.emit("lk:t:guest", {
      v: 1,
      data: { items: ["from-tab"], pick: null },
      base: null,
      baseRev: null,
      dirty: false,
    });
    assert.deepEqual(view().data.items, ["from-tab"]);
    synced.dispose();
  });
});
