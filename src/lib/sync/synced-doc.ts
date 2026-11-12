/**
 * Account-synced documents (design: docs/design/account-sync.md).
 *
 * A synced data type is one `SyncedDocSpec`. `createSyncedDoc` owns
 * everything about timing and accounts, so specs and pages never do:
 *
 * - **Slots per account.** Data lives at `lk:<key>:<accountId|guest>`.
 *   Every write names the account it belongs to and touches only that slot.
 * - **One request at a time.** Reads and writes run through a single queue,
 *   so an older response can never land after a newer one.
 * - **The server decides conflicts.** Writes carry `baseRev`. A 409 returns
 *   the server copy, which `spec.merge` combines with local edits against
 *   the stored base.
 * - **Only the user sends.** Edits leave the device on `commit` (Save),
 *   `resolve("local")`, or `adoptGuest` — never because a read happened.
 *   A read merges unsent edits onto the newer server copy and leaves them
 *   unsent (`dirty`) for the user to review and save.
 * - **The server confirms the account.** GET echoes the session's account and
 *   POST sends the expected one. A response for a different account is
 *   dropped, and the server refuses a write for one.
 */

import { writable, type Readable } from "svelte/store";
import type { SlotStorage } from "#lib/sync/storage.js";
import type { SyncTransport } from "#lib/sync/transport.js";

/** `merge` asks the user instead of choosing (roster conflict prompt). */
export type MergeResult<T> = T | "ask";

export type SyncedDocSpec<T> = {
  /** Slot name. Stored as `lk:<key>:<accountId|guest>`. */
  key: string;
  /** Account-document route (`#lib/server/account-doc.js`). */
  endpoint: string;
  /** The route's body field (`goals`, `roster`). */
  field: string;
  /** Bump when `T` changes shape. `parse` must accept every older version. */
  schemaVersion: number;
  empty(): T;
  /** Untrusted stored JSON → T. Drops invalid parts, never throws. */
  parse(raw: unknown): T;
  /** What the route accepts for `field`. */
  toWire(data: T): unknown;
  /**
   * Untrusted server `field` → T. `local` supplies device-only parts the
   * server does not store (a selection, for example).
   */
  fromWire(wire: unknown, local: T): T;
  /** Sync-relevant equality (ignores device-only parts). */
  equal(a: T, b: T): boolean;
  /**
   * Three-way merge after the server copy moved. `base` is the last copy
   * both sides agreed on, or null when the server never had one.
   */
  merge(base: T | null, local: T, remote: T): MergeResult<T>;
};

export type SyncStatus =
  /** Guest: stored on this device only. */
  | "local"
  | "loading"
  | "synced"
  /** Local edits the server has not accepted (`error` says why, if failed). */
  | "dirty"
  | "saving"
  /** The last read failed. Edits stay on the device until the user saves. */
  | "offline"
  /** `merge` needs the user. Answer with `resolve`. */
  | "ask";

export type SyncView<T> = {
  /** Account this view's slot belongs to. `null` is the guest slot. */
  account: string | null;
  data: T;
  status: SyncStatus;
  /** Stored edits the server has not accepted (also while `offline`). */
  dirty: boolean;
  error: string | null;
  /** While `status` is `ask`: the server copy the user is choosing against. */
  remote: T | null;
};

/** What storage holds for one account. */
export type SyncSlot<T> = {
  v: number;
  data: T;
  /** Last copy both sides agreed on. The merge base. */
  base: T | null;
  /** Server revision of `base`. Null: no server copy known (create only). */
  baseRev: string | null;
  /** `data` has edits the server has not accepted. */
  dirty: boolean;
};

export interface SyncedDoc<T> {
  readonly view: Readable<SyncView<T>>;
  /**
   * The signed-in account (`null` = guest). Called from the layout session
   * effect only. Work queued for other accounts writes only their slots.
   */
  setAccount(id: string | null): void;
  /**
   * Save: store `next` for the active account and send it. The only way
   * edits leave the device (with `resolve("local")` and `adoptGuest`).
   * `commit(get(view).data)` sends edits that are already unsent.
   *
   * `basedOn` is the view data a page draft started from. If the slot moved
   * since (another surface saved, or a read landed), the draft is merged
   * onto the current data with `spec.merge` instead of replacing it.
   */
  commit(next: T, opts?: { basedOn?: T }): Promise<void>;
  /**
   * Re-read the server copy (visibility change, retry button). Never sends:
   * unsent edits are merged onto the server copy and stay unsent.
   */
  refresh(): Promise<void>;
  /** Answers status `ask`: keep this device's copy, or take the server's. */
  resolve(choice: "local" | "remote"): Promise<void>;
  /**
   * Replace the active account's copy with the guest slot's (the roster
   * "upload this device" choice). The only cross-account copy. Callers
   * decide when: after the user chose it, or when the account has no
   * server copy.
   */
  adoptGuest(): Promise<void>;
  /** Resolves when queued work has finished. */
  idle(): Promise<void>;
  /** Stop watching other tabs. */
  dispose(): void;
}

export type SyncedDocDeps = {
  storage: SlotStorage;
  transport: SyncTransport;
  /** 409 → merge → retry rounds before giving up for now. */
  maxConflictRetries?: number;
};

/** Typed identity for specs, so a spec is checked where it is declared. */
export function defineSyncedDocSpec<T>(
  spec: SyncedDocSpec<T>,
): SyncedDocSpec<T> {
  return spec;
}

/** Per-account request state. Never persisted. */
type Transient<T> = {
  busy: "read" | "write" | null;
  /** A read finished since this account became active. */
  loaded: boolean;
  error: string | null;
  offline: boolean;
  ask: { remote: T; rev: string | null } | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function createSyncedDoc<T>(
  spec: SyncedDocSpec<T>,
  deps: SyncedDocDeps,
): SyncedDoc<T> {
  const { storage, transport } = deps;
  const maxConflictRetries = deps.maxConflictRetries ?? 3;

  const slots = new Map<string, SyncSlot<T>>();
  const transients = new Map<string, Transient<T>>();
  /** `undefined` until the layout knows the session. */
  let active: string | null | undefined = undefined;
  let queue: Promise<void> = Promise.resolve();

  const view = writable<SyncView<T>>({
    account: null,
    data: spec.empty(),
    status: "loading",
    dirty: false,
    error: null,
    remote: null,
  });

  const slotKey = (account: string | null) =>
    `lk:${spec.key}:${account ?? "guest"}`;

  // ── Slots ────────────────────────────────────────────────────────────────

  function emptySlot(): SyncSlot<T> {
    return {
      v: spec.schemaVersion,
      data: spec.empty(),
      base: null,
      baseRev: null,
      dirty: false,
    };
  }

  function decodeSlot(raw: unknown): SyncSlot<T> {
    const record = asRecord(raw);
    if (!record) return emptySlot();
    return {
      v: spec.schemaVersion,
      data: spec.parse(record.data),
      base: record.base == null ? null : spec.parse(record.base),
      baseRev: typeof record.baseRev === "string" ? record.baseRev : null,
      dirty: record.dirty === true,
    };
  }

  function slotOf(account: string | null): SyncSlot<T> {
    const key = slotKey(account);
    let slot = slots.get(key);
    if (!slot) {
      slot = decodeSlot(storage.read(key));
      slots.set(key, slot);
    }
    return slot;
  }

  /** Memory first; a failed storage write still updates this tab. */
  function storeSlot(account: string | null, slot: SyncSlot<T>): void {
    slots.set(slotKey(account), slot);
    storage.write(slotKey(account), slot);
    publish(account);
  }

  // ── Transient state + view ───────────────────────────────────────────────

  function stateOf(account: string | null): Transient<T> {
    const key = slotKey(account);
    let state = transients.get(key);
    if (!state) {
      state = {
        busy: null,
        loaded: false,
        error: null,
        offline: false,
        ask: null,
      };
      transients.set(key, state);
    }
    return state;
  }

  function setState(account: string | null, patch: Partial<Transient<T>>) {
    transients.set(slotKey(account), { ...stateOf(account), ...patch });
    publish(account);
  }

  function statusOf(account: string | null): SyncStatus {
    if (account === null) return "local";
    const state = stateOf(account);
    if (state.ask) return "ask";
    if (state.busy === "read" || !state.loaded) return "loading";
    if (state.busy === "write") return "saving";
    if (state.offline) return "offline";
    return slotOf(account).dirty ? "dirty" : "synced";
  }

  /** Only the active account is ever shown. */
  function publish(account: string | null): void {
    if (account !== active) return;
    const state = stateOf(account);
    view.set({
      account,
      data: slotOf(account).data,
      status: statusOf(account),
      dirty: account !== null && slotOf(account).dirty,
      error: state.error,
      remote: state.ask?.remote ?? null,
    });
  }

  // ── Queue ────────────────────────────────────────────────────────────────

  function enqueue(task: () => Promise<void>): Promise<void> {
    const run = queue.then(task).catch((err: unknown) => {
      console.error(`[sync:${spec.key}] task failed:`, err);
    });
    queue = run;
    return run;
  }

  /** Only from a user action already in progress (commit, resolve, adopt). */
  function schedulePush(account: string, attempt: number): void {
    void enqueue(() => push(account, attempt));
  }

  // ── Reconcile a server copy into an account's slot ──────────────────────

  /**
   * Fold a server copy into the slot. A read passes `continueSave: null`
   * and never sends: unsent edits are merged onto the new server copy and
   * stay unsent until the user saves. A conflict during a save passes the
   * retry count so that save can finish with the merged list.
   */
  function reconcile(
    account: string,
    wire: unknown,
    rev: string | null,
    continueSave: number | null,
  ): void {
    const slot = slotOf(account);
    const finishSave = (dirty: boolean) => {
      if (dirty && continueSave !== null) schedulePush(account, continueSave);
    };

    if (wire === null || rev === null) {
      // No server copy and nothing of this account's own on the device:
      // guest data becomes the account's first copy without asking. There
      // is nothing to overwrite or compare. The guest slot is emptied so
      // another account cannot silently take the same data later.
      const untouched =
        !slot.dirty &&
        slot.base === null &&
        spec.equal(slot.data, spec.empty());
      const guest = slotOf(null);
      if (
        continueSave === null &&
        untouched &&
        !spec.equal(guest.data, spec.empty())
      ) {
        storeSlot(account, { ...slot, data: guest.data, dirty: true });
        storeSlot(null, emptySlot());
        schedulePush(account, 0);
        return;
      }
      // Otherwise what this device has is unsent until the user saves.
      const dirty = slot.dirty || !spec.equal(slot.data, spec.empty());
      storeSlot(account, { ...slot, base: null, baseRev: null, dirty });
      finishSave(dirty);
      return;
    }

    const remote = spec.fromWire(wire, slot.data);
    if (!slot.dirty) {
      storeSlot(account, {
        ...slot,
        data: remote,
        base: remote,
        baseRev: rev,
        dirty: false,
      });
      return;
    }

    // The server has not moved since our base. Nothing to merge.
    if (rev === slot.baseRev) {
      finishSave(true);
      return;
    }

    const merged = spec.merge(slot.base, slot.data, remote);
    if (merged === "ask") {
      setState(account, { ask: { remote, rev } });
      return;
    }
    const dirty = !spec.equal(merged, remote);
    storeSlot(account, {
      ...slot,
      data: merged,
      base: remote,
      baseRev: rev,
      dirty,
    });
    finishSave(dirty);
  }

  // ── Tasks (run only from the queue) ──────────────────────────────────────

  async function pull(account: string): Promise<void> {
    // The cookie now belongs to someone else. Their own read is queued.
    if (account !== active) return;
    setState(account, { busy: "read" });
    const res = await transport.read();
    setState(account, { busy: null });
    if (res.status === "error") {
      setState(account, { loaded: true, offline: true, error: res.message });
      return;
    }
    // Another session answered. The account switch queues its own read.
    if (res.account !== null && res.account !== account) return;
    setState(account, { loaded: true, offline: false, error: null });
    reconcile(account, res.wire, res.rev, null);
  }

  async function push(account: string, attempt: number): Promise<void> {
    // Pushing needs this account's cookie. The slot stays dirty until then.
    if (account !== active) return;
    const slot = slotOf(account);
    if (!slot.dirty || stateOf(account).ask) return;

    const sent = slot.data;
    setState(account, { busy: "write" });
    const res = await transport.write(spec.toWire(sent), slot.baseRev, account);
    setState(account, { busy: null });

    if (res.status === "written") {
      const now = slotOf(account);
      const dirty = !spec.equal(now.data, sent);
      setState(account, { offline: false, error: null });
      // Edits made while this was in flight wait for their own Save.
      storeSlot(account, { ...now, base: sent, baseRev: res.rev, dirty });
      return;
    }
    if (res.status === "conflict") {
      if (attempt >= maxConflictRetries) {
        setState(account, { error: "Sync conflict — try again" });
        return;
      }
      reconcile(account, res.wire, res.rev, attempt + 1);
      return;
    }
    setState(account, { error: res.message });
  }

  // ── Other tabs ───────────────────────────────────────────────────────────

  const unwatch = storage.watch((key, value) => {
    if (!key.startsWith(`lk:${spec.key}:`)) return;
    slots.set(key, decodeSlot(value));
    if (active !== undefined && key === slotKey(active)) publish(active);
  });

  function requireActive(): string | null {
    if (active === undefined) {
      throw new Error(`[sync:${spec.key}] setAccount must run first`);
    }
    return active;
  }

  // ── Public surface ───────────────────────────────────────────────────────

  return {
    view: { subscribe: view.subscribe },

    setAccount(id) {
      if (id === active) return;
      active = id;
      // The server copy may have moved while this account was inactive.
      if (id !== null)
        transients.set(slotKey(id), { ...stateOf(id), loaded: false });
      publish(id);
      if (id !== null) void enqueue(() => pull(id));
    },

    commit(next, opts) {
      const account = requireActive();
      const slot = slotOf(account);
      let data = next;
      const basedOn = opts?.basedOn;
      if (basedOn !== undefined && !spec.equal(basedOn, slot.data)) {
        const merged = spec.merge(basedOn, next, slot.data);
        if (merged !== "ask") {
          data = merged;
        } else if (account !== null) {
          // The user picks between their draft and the newer copy.
          storeSlot(account, { ...slot, data: next, dirty: true });
          setState(account, {
            ask: { remote: slot.data, rev: slot.baseRev },
          });
          return Promise.resolve();
        }
      }
      const dirty =
        account !== null &&
        (slot.base === null || !spec.equal(data, slot.base));
      storeSlot(account, { ...slot, data, dirty });
      if (account === null || !dirty) return Promise.resolve();
      setState(account, { error: null });
      return enqueue(() => push(account, 0));
    },

    refresh() {
      const account = requireActive();
      if (account === null) return Promise.resolve();
      return enqueue(() => pull(account));
    },

    resolve(choice) {
      const account = requireActive();
      if (account === null) return Promise.resolve();
      const ask = stateOf(account).ask;
      if (!ask) return Promise.resolve();
      setState(account, { ask: null });
      const slot = slotOf(account);
      if (choice === "remote") {
        storeSlot(account, {
          ...slot,
          data: ask.remote,
          base: ask.remote,
          baseRev: ask.rev,
          dirty: false,
        });
        return Promise.resolve();
      }
      storeSlot(account, {
        ...slot,
        base: ask.remote,
        baseRev: ask.rev,
        dirty: true,
      });
      return enqueue(() => push(account, 0));
    },

    adoptGuest() {
      const account = requireActive();
      if (account === null) return Promise.resolve();
      const guest = slotOf(null);
      const slot = slotOf(account);
      storeSlot(account, { ...slot, data: guest.data, dirty: true });
      return enqueue(() => push(account, 0));
    },

    async idle() {
      // Tasks queue follow-ups (merge → push), so wait until it stops growing.
      let seen: Promise<void>;
      do {
        seen = queue;
        await seen;
      } while (seen !== queue);
    },

    dispose() {
      unwatch();
    },
  };
}
