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
import { createSyncedDoc } from "./synced-doc.ts";
import { memorySlotStorage } from "./storage.ts";
import { doc, fakeServer, makeSpec, type Doc } from "./synced-doc.fixtures.ts";

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

  it("saving back to the base while a write is in flight is still sent", async () => {
    const { synced, signIn, server, view } = setup();
    server.put("a", ["x"]);
    signIn("a");
    await synced.idle();
    const release = server.hold();
    const first = synced.commit(doc("x", "1"));
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(view().status, "saving");
    void synced.commit(doc("x"));
    release();
    await first;
    await synced.idle();
    assert.deepEqual(server.rows.get("a")?.items, ["x"]);
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

  it("a deleted server copy is never re-uploaded by later reads", async () => {
    const { synced, signIn, server, view } = setup();
    server.put("a", ["x"]);
    signIn("a");
    await synced.idle();
    server.rows.delete("a");
    await synced.refresh();
    await synced.idle();
    await synced.refresh();
    await synced.idle();
    assert.equal(server.rows.has("a"), false);
    assert.equal(view().dirty, true);
    // Save creates the copy again.
    await synced.commit(view().data);
    await synced.idle();
    assert.deepEqual(server.rows.get("a")?.items, ["x"]);
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

  it("adoption empties the guest slot, and an empty guest changes nothing", async () => {
    const { synced, signIn, server, view } = setup();
    server.put("a", ["server"]);
    signIn("a");
    await synced.idle();
    signIn(null);
    await synced.commit(doc("guest-1"));
    signIn("a");
    await synced.idle();
    await synced.adoptGuest();
    await synced.idle();
    await synced.adoptGuest();
    await synced.idle();
    assert.deepEqual(server.rows.get("a")?.items, ["guest-1"]);
    assert.deepEqual(view().data.items, ["guest-1"]);
    signIn(null);
    assert.deepEqual(view().data.items, []);
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

  it("taking this device's newer copy keeps it unsent", async () => {
    const { synced, signIn, server, view } = setup({ ask: true });
    server.put("a", ["x"]);
    signIn("a");
    await synced.idle();
    server.failWrites = true;
    await synced.commit(doc("x", "other")); // another surface, not sent
    await synced.commit(doc("x", "draft"), { basedOn: doc("x") });
    assert.equal(view().status, "ask");
    assert.equal(view().remoteSource, "device");
    await synced.resolve("remote");
    assert.deepEqual(view().data.items, ["x", "other"]);
    assert.equal(view().dirty, true);
    server.failWrites = false;
    await synced.commit(view().data);
    await synced.idle();
    assert.deepEqual(server.rows.get("a")?.items, ["x", "other"]);
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

  it("a conflict whose data already matches still sends the attachment", async () => {
    const { synced, signIn, server, view } = setup();
    server.put("a", ["x"]);
    signIn("a");
    await synced.idle();
    server.put("a", ["x"]); // same data, newer revision
    await synced.commit(doc("x"), { attach: { weapons: [1] } });
    await synced.idle();
    assert.ok(server.calls.includes("write:a:r2"));
    assert.equal(server.rows.get("a")?.rev, "r3");
    assert.equal(view().status, "synced");
    await synced.commit(doc("x", "y"));
    await synced.idle();
    assert.equal(server.attached.length, 2); // r1 rejected, r2 written
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

  it("a read never replaces another tab's unsent edits it has not seen yet", async () => {
    const { synced, signIn, server, storage, view } = setup();
    server.put("a", ["x"]);
    signIn("a");
    await synced.idle();
    // Another tab stored offline edits; its storage event has not arrived.
    storage.entries.set(
      "lk:t:a",
      JSON.stringify({
        v: 1,
        data: { items: ["x", "mine"], pick: null },
        base: { items: ["x"], pick: null },
        baseRev: "r1",
        dirty: true,
      }),
    );
    server.put("a", ["x", "theirs"]);
    await synced.refresh();
    await synced.idle();
    assert.deepEqual(view().data.items, ["x", "theirs", "mine"]);
    assert.equal(view().dirty, true);
    assert.deepEqual(server.rows.get("a")?.items, ["x", "theirs"]);
    synced.dispose();
  });

  it("a late rejection never takes the slot back past another tab's save", async () => {
    const storage = memorySlotStorage();
    const { server, transport } = fakeServer();
    // Tab 1's write answers only when released, after tab 0 has saved.
    let releaseLate!: () => void;
    const late = new Promise<void>((r) => (releaseLate = r));
    const delayed: typeof transport = {
      read: transport.read,
      async write(...args) {
        const res = await transport.write(...args);
        await late;
        return res;
      },
    };
    const tab0 = createSyncedDoc(makeSpec(), { storage, transport });
    const tab1 = createSyncedDoc(makeSpec(), { storage, transport: delayed });
    server.put("a", ["x"]);
    server.session = "a";
    tab0.setAccount("a");
    tab1.setAccount("a");
    await tab0.idle();
    await tab1.idle();
    server.put("a", ["x", "device"]); // tab 1's write will be rejected
    const pending = tab1.commit(doc("x", "t1"));
    await Promise.resolve();
    await Promise.resolve();
    await tab0.commit(doc("x", "t0"));
    await tab0.idle();
    const saved = server.rows.get("a")!.items;
    releaseLate();
    await pending;
    await tab1.idle();
    await tab0.idle();
    // The rejection carried the older copy; the slot keeps the newer save.
    for (const item of saved)
      assert.ok(get(tab1.view).data.items.includes(item));
    assert.deepEqual(server.rows.get("a")?.items, saved);
    tab0.dispose();
    tab1.dispose();
  });
});

describe("commit result", () => {
  it("a guest save is local", async () => {
    const { synced, signIn } = setup();
    signIn(null);
    assert.deepEqual(await synced.commit(doc("a")), {
      status: "local",
      account: null,
    });
  });

  it("an unchanged save sends nothing", async () => {
    const { synced, signIn, server } = setup();
    server.put("a", ["x"]);
    signIn("a");
    await synced.idle();
    assert.deepEqual(await synced.commit(doc("x")), {
      status: "unchanged",
      account: "a",
    });
    assert.equal(server.calls.filter((c) => c.startsWith("write")).length, 0);
  });

  it("a conflict merges and resolves sent with the final revision", async () => {
    const { synced, signIn, server } = setup();
    server.put("a", ["x"]);
    signIn("a");
    await synced.idle();
    server.put("a", ["x", "other-device"]);
    const result = await synced.commit(doc("x", "mine"));
    assert.deepEqual(server.rows.get("a")?.items, [
      "x",
      "other-device",
      "mine",
    ]);
    assert.deepEqual(result, {
      status: "sent",
      rev: server.rows.get("a")?.rev,
      account: "a",
    });
  });

  it("a network failure resolves unsent", async () => {
    const { synced, signIn, server } = setup();
    server.put("a", ["x"]);
    signIn("a");
    await synced.idle();
    server.failWrites = true;
    assert.deepEqual(await synced.commit(doc("x", "mine")), {
      status: "unsent",
      error: "offline",
      account: "a",
    });
  });

  it("an account switch while a push is waiting resolves unsent", async () => {
    const { synced, signIn, server, view } = setup();
    server.put("a", ["x"]);
    signIn("a");
    await synced.idle();
    const pending = synced.commit(doc("x", "edit"));
    signIn("b");
    assert.deepEqual(await pending, {
      status: "unsent",
      error: null,
      account: "a",
    });
    assert.deepEqual(server.rows.get("a")?.items, ["x"]);
    signIn("a");
    await synced.idle();
    assert.equal(view().account, "a");
    assert.equal(view().dirty, true);
    assert.deepEqual(view().data.items, ["x", "edit"]);
  });

  it("a save superseded before its push resolves with the newer push", async () => {
    const { synced, signIn, server } = setup();
    server.put("a", ["x"]);
    signIn("a");
    await synced.idle();
    const release = server.hold();
    const first = synced.commit(doc("x", "1"));
    const second = synced.commit(doc("x", "1", "2"));
    release();
    const [earlier, later] = await Promise.all([first, second]);
    assert.equal(earlier.status, "sent");
    assert.equal(later.status, "sent");
    if (earlier.status === "sent" && later.status === "sent") {
      assert.equal(earlier.rev, later.rev);
      assert.equal(earlier.rev, server.rows.get("a")?.rev);
    }
    assert.equal(earlier.account, "a");
    assert.deepEqual(server.rows.get("a")?.items, ["x", "1", "2"]);
  });

  it("a spec that asks resolves ask", async () => {
    const { synced, signIn, server } = setup({ ask: true });
    server.put("a", ["x"]);
    signIn("a");
    await synced.idle();
    server.put("a", ["theirs"]);
    assert.deepEqual(await synced.commit(doc("mine")), {
      status: "ask",
      account: "a",
    });
  });
});
