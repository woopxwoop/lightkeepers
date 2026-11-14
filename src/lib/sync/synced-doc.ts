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
import { decideReconcile } from "#lib/sync/reconcile.js";
import {
  answerAsk,
  baseOf,
  decodeSlot as decodeStoredSlot,
  detached,
  emptySlot as emptySlotOf,
  revOf,
  tracked,
  withoutAsk,
  type Ask,
  type SyncSlot,
} from "#lib/sync/slot.js";
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
  /**
   * Save during `ask` keeps this device's copy and sends it. The default.
   * Set false when that replacement must wait for `resolve` (goals over the
   * cap: the editors show a choice, and Save must not pick a side).
   */
  saveAnswersAsk?: boolean;
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
  /** `setAccount` has run: `data` is this account's own copy, not a placeholder. */
  ready: boolean;
  /** Account this view's slot belongs to. `null` is the guest slot. */
  account: string | null;
  data: T;
  status: SyncStatus;
  /** Stored edits the server has not accepted (also while `offline`). */
  dirty: boolean;
  error: string | null;
  /** While `status` is `ask`: the copy the user is choosing against. */
  remote: T | null;
  /**
   * Where `remote` came from: the server, or this device's newer stored copy
   * (a draft saved over edits made elsewhere on the device).
   */
  remoteSource: "server" | "device" | null;
};

/**
 * What a save did. `account` is the slot that was written, so a caller can
 * compare it with the account it sees now instead of one captured beforehand.
 */
export type CommitResult =
  /** Guest: stored on this device only. */
  | { status: "local" }
  /**
   * The server accepted this save. `attachmentOmitted` means the document
   * was stored and the attachment on that write was not.
   */
  | { status: "sent"; rev: string; attachmentOmitted?: boolean }
  /** Stored here; the server did not accept it. */
  | { status: "unsent"; error: string | null }
  /** The spec asked the user; the popup takes over. */
  | { status: "ask" }
  /** Nothing to send. */
  | { status: "unchanged" };

export type CommitOutcome = CommitResult & { account: string | null };

/** What `discardServer` did. `message` is null when no delete was attempted. */
export type DiscardResult =
  { removed: true } | { removed: false; message: string | null };

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
   * `basedOn` is the view data a page draft started from; it defaults to
   * the data this tab last showed. If the slot moved since (another surface
   * or tab saved, or a read landed), the draft is merged onto the current
   * data with `spec.merge` instead of replacing it.
   *
   * Saving while status is `ask` answers it: this copy wins, unless the
   * spec sets `saveAnswersAsk: false`. Then Save leaves the question open.
   *
   * `attach` adds fields to the body of the next write (the GOOD inventory
   * beside the roster). It forces that write even when `next` equals the
   * stored copy, and stays on the slot until the server accepts it.
   *
   * The promise settles when this save's chain finishes (a conflict merges
   * and pushes again), not when the first push returns. A later save that
   * sends this one's data resolves it with that result.
   */
  commit(
    next: T,
    opts?: { basedOn?: T; attach?: Record<string, unknown> },
  ): Promise<CommitOutcome>;
  /**
   * Re-read the server copy (visibility change, retry button). Never sends:
   * unsent edits are merged onto the server copy and stay unsent.
   */
  refresh(): Promise<void>;
  /**
   * Answers status `ask`: keep this device's copy, or take the server's.
   * "Keep mine" sends, so it returns the same outcome as `commit`.
   * `expected` is the other copy the user was shown. A conflict that
   * replaced it is left unanswered.
   */
  resolve(choice: "local" | "remote", expected?: T): Promise<CommitOutcome>;
  /**
   * Replace the active account's copy with the guest slot's (the roster
   * "upload this device" choice). The only cross-account copy. Callers
   * decide when: after the user chose it, or when the account has no
   * server copy. Returns the same outcome as `commit`.
   */
  adoptGuest(): Promise<CommitOutcome>;
  /**
   * Delete this account's server row after saves already queued. When the
   * delete succeeds and the document did not change during it, the slot is
   * detached and not dirty, so a save that already ran cannot be followed
   * by another upload of the same copy. A different signed-in account is
   * not deleted: the cookie would be theirs.
   */
  discardServer(): Promise<DiscardResult>;
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
  /** Every request outcome and reconcile rule, for debugging and tests. */
  trace?: (event: SyncTraceEvent) => void;
};

export type SyncTraceEvent = {
  /** The spec's `key`. */
  doc: string;
  account: string;
  step: "read" | "write" | "reconcile";
  /** The outcome, or the reconcile rule that fired. */
  detail: string;
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
  ask: Ask<T> | null;
};

export function createSyncedDoc<T>(
  spec: SyncedDocSpec<T>,
  deps: SyncedDocDeps,
): SyncedDoc<T> {
  const { storage, transport } = deps;
  const maxConflictRetries = deps.maxConflictRetries ?? 3;
  const emit = (event: Omit<SyncTraceEvent, "doc">) =>
    deps.trace?.({ doc: spec.key, ...event });

  const slots = new Map<string, SyncSlot<T>>();
  const transients = new Map<string, Transient<T>>();
  /** `undefined` until the layout knows the session. */
  let active: string | null | undefined = undefined;
  let queue: Promise<void> = Promise.resolve();
  /** Extra body fields for an account's next write. Memory only. */
  const attachments = new Map<string, Record<string, unknown>>();
  /**
   * Saves waiting for a push that has not started. A push collects them when
   * it begins; a follow-up push keeps the ones it was given and leaves newer
   * saves for their own push.
   */
  const pendingTokens = new Map<string, Token[]>();

  /** One save's promise. Settled once, by the push that finishes its chain. */
  type Token = {
    account: string;
    done: boolean;
    resolve: (result: CommitOutcome) => void;
  };

  function addToken(account: string): Promise<CommitOutcome> {
    const list = pendingTokens.get(account) ?? [];
    let resolve!: (result: CommitOutcome) => void;
    const promise = new Promise<CommitOutcome>((settle) => {
      resolve = settle;
    });
    list.push({ account, done: false, resolve });
    pendingTokens.set(account, list);
    return promise;
  }

  function takeTokens(account: string): Token[] {
    const list = pendingTokens.get(account) ?? [];
    pendingTokens.set(account, []);
    return list;
  }

  function settle(tokens: Token[], result: CommitResult): void {
    for (const token of tokens) {
      if (token.done) continue;
      token.done = true;
      token.resolve({ ...result, account: token.account });
    }
  }

  /** A push ended without a write: already accepted, asking, or still unsent. */
  function settleIdle(account: string, tokens: Token[]): void {
    if (tokens.length === 0) return;
    if (stateOf(account).ask) {
      settle(tokens, { status: "ask" });
      return;
    }
    const rev = revOf(slotOf(account).server);
    if (!slotOf(account).dirty && rev) {
      settle(tokens, { status: "sent", rev });
      return;
    }
    settle(tokens, { status: "unsent", error: stateOf(account).error });
  }

  /** Queue a push and resolve when that save's chain finishes. */
  function send(account: string): Promise<CommitOutcome> {
    const result = addToken(account);
    void enqueue(() => push(account, 0, null));
    return result;
  }

  const view = writable<SyncView<T>>({
    ready: false,
    account: null,
    data: spec.empty(),
    status: "loading",
    dirty: false,
    error: null,
    remote: null,
    remoteSource: null,
  });

  const slotKey = (account: string | null) =>
    `lk:${spec.key}:${account ?? "guest"}`;

  // ── Slots ────────────────────────────────────────────────────────────────

  const emptySlot = (): SyncSlot<T> =>
    emptySlotOf(spec.empty(), spec.schemaVersion);
  const decodeSlot = (raw: unknown): SyncSlot<T> =>
    decodeStoredSlot(raw, spec.parse, spec.empty, spec.schemaVersion);

  /** Stored JSON this tab last wrote or saw per slot key. */
  const lastSeen = new Map<string, string>();

  /**
   * The slot every decision starts from. Another tab may have stored a newer
   * copy whose `storage` event has not arrived yet; that copy wins, so a
   * merge or a clean server copy never lands on top of edits it never saw.
   * Unchanged storage keeps memory in charge (a failed write stays here).
   */
  function slotOf(account: string | null): SyncSlot<T> {
    const key = slotKey(account);
    const raw = storage.read(key);
    const json = raw === null ? null : JSON.stringify(raw);
    let slot = slots.get(key);
    if (!slot || (json !== null && json !== lastSeen.get(key))) {
      slot = decodeSlot(raw);
      slots.set(key, slot);
      if (json !== null) lastSeen.set(key, json);
      rememberStored(account, slot);
    }
    return slot;
  }

  /**
   * A slot just read from storage. Its question and attachment become this
   * tab's, so a reload still asks and still retries the inventory write.
   */
  function rememberStored(account: string | null, slot: SyncSlot<T>): void {
    if (account !== null) {
      if (slot.attach) attachments.set(account, slot.attach);
      else attachments.delete(account);
    }
    transients.set(slotKey(account), {
      ...stateOf(account),
      ask: slot.ask ?? null,
    });
  }

  /**
   * Memory first. Returns whether storage kept the copy. A failed write still
   * updates this tab, and is not proof the value will be there after reload.
   */
  function storeSlot(account: string | null, slot: SyncSlot<T>): boolean {
    const key = slotKey(account);
    slots.set(key, slot);
    const stored = storage.write(key, slot);
    if (stored) lastSeen.set(key, JSON.stringify(slot));
    publish(account);
    return stored;
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
    const state = stateOf(account);
    if (state.ask) return "ask";
    if (account === null) return "local";
    if (state.busy === "read" || !state.loaded) return "loading";
    if (state.busy === "write") return "saving";
    if (state.offline) return "offline";
    return slotOf(account).dirty ? "dirty" : "synced";
  }

  /** What this tab last showed: the default base of a `commit`. */
  let shown: { account: string | null; data: T } | null = null;

  /** Only the active account is ever shown. */
  function publish(account: string | null): void {
    if (account !== active) return;
    const data = slotOf(account).data;
    const state = stateOf(account);
    shown = { account, data };
    view.set({
      ready: true,
      account,
      data,
      status: statusOf(account),
      dirty: account !== null && slotOf(account).dirty,
      error: state.error,
      remote: state.ask?.remote ?? null,
      remoteSource: state.ask?.source ?? null,
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

  /**
   * `carried` null: this push collects saves still waiting (a new send).
   * An array: a follow-up for those saves only. A read passes `[]`.
   */
  function schedulePush(
    account: string,
    attempt: number,
    carried: Token[] | null,
  ): void {
    void enqueue(() => push(account, attempt, carried));
  }

  // ── Reconcile a server copy into an account's slot ──────────────────────

  /**
   * Fold a server copy into the slot. The decision is `decideReconcile`
   * (`reconcile.ts`); this applies it. A read passes `continueSave: null`
   * and never sends on its own; a rejected save passes its retry count.
   */
  function reconcile(
    account: string,
    wire: unknown,
    rev: string | null,
    continueSave: number | null,
    carried: Token[],
  ): void {
    const plan = decideReconcile(spec, {
      slot: slotOf(account),
      // Only the active account may be offered the guest slot. A response
      // for anyone else still updates that account, and does not read or
      // clear the guest document (it may now be the signed-out user's).
      guest: account === active ? slotOf(null) : null,
      wire,
      rev,
      continueSave,
      attachmentPending: attachments.has(account),
    });
    emit({ account, step: "reconcile", detail: plan.rule });
    // A plan that names a slot or a question replaces the stored question.
    // `server-unmoved` names neither, so an open question stays until answered.
    // An open device question is never replaced: its other copy exists only
    // here. It keeps its own server state, so answering it merges with this
    // server copy on the next write.
    if (plan.slot || plan.ask) {
      const current = slotOf(account);
      const ask = current.ask?.source === "device" ? current.ask : plan.ask;
      const base = plan.slot ?? current;
      const next = ask ? { ...base, ask } : withoutAsk(base);
      const wrote = storeSlot(account, next);
      // The guest copy is the only other durable copy. Drop it only after
      // the destination write landed.
      if (plan.clearGuest && wrote) storeSlot(null, emptySlot());
      setState(account, { ask });
    }
    if (plan.push !== null) schedulePush(account, plan.push, carried);
    else settleIdle(account, carried);
  }

  // ── Tasks (run only from the queue) ──────────────────────────────────────

  /**
   * A server copy answers the slot it was asked for only while the slot's
   * server revision has not moved. Another tab shares the slot and its own
   * queue: if it read or wrote meanwhile, it already knows a server state at
   * least as recent, and the older copy would read as removed edits.
   */
  function serverViewMoved(account: string, askedAt: string | null): boolean {
    return revOf(slotOf(account).server) !== askedAt;
  }

  async function pull(account: string): Promise<void> {
    // The cookie now belongs to someone else. Their own read is queued.
    if (account !== active) return;
    const askedAt = revOf(slotOf(account).server);
    setState(account, { busy: "read" });
    const res = await transport.read();
    setState(account, { busy: null });
    if (res.status === "error") {
      emit({ account, step: "read", detail: `error: ${res.message}` });
      setState(account, { loaded: true, offline: true, error: res.message });
      return;
    }
    // Another session answered. The account switch queues its own read.
    if (res.account !== null && res.account !== account) {
      emit({ account, step: "read", detail: "other-session" });
      return;
    }
    setState(account, { loaded: true, offline: false, error: null });
    if (
      serverViewMoved(account, askedAt) &&
      res.rev !== revOf(slotOf(account).server)
    ) {
      emit({ account, step: "read", detail: "stale" });
      return;
    }
    emit({ account, step: "read", detail: `ok ${res.rev}` });
    if (account !== active) emit({ account, step: "read", detail: "inactive" });
    reconcile(account, res.wire, res.rev, null, []);
  }

  async function push(
    account: string,
    attempt: number,
    carried: Token[] | null,
  ): Promise<void> {
    // null collects saves queued since the last push. A follow-up keeps only
    // the saves it was given, so a newer save is resolved by its own push.
    const tokens = carried ?? takeTokens(account);
    try {
      // Pushing needs this account's cookie. The slot stays dirty until then.
      if (account !== active) {
        settle(tokens, { status: "unsent", error: null });
        return;
      }
      const slot = slotOf(account);
      if (!slot.dirty || stateOf(account).ask) {
        settleIdle(account, tokens);
        return;
      }

      const sent = slot.data;
      const attach = attachments.get(account);
      const askedAt = revOf(slot.server);
      setState(account, { busy: "write" });
      const res = await transport.write(
        spec.toWire(sent),
        revOf(slot.server),
        account,
        attach,
      );
      setState(account, { busy: null });

      if (res.status === "written") {
        emit({ account, step: "write", detail: `written ${res.rev}` });
        const now = slotOf(account);
        // Another tab already recorded a newer server revision. Keep that
        // merge base; this response is for an older write.
        if (
          serverViewMoved(account, askedAt) &&
          res.rev !== revOf(now.server)
        ) {
          emit({ account, step: "write", detail: "written: stale" });
          settle(tokens, { status: "unsent", error: null });
          return;
        }
        // A commit during this write may have replaced the attachment.
        // Drop it only when it is still the one this request carried.
        if (attachments.get(account) === attach) attachments.delete(account);
        // Same document, but an attachment queued in flight has not been sent.
        const dirty = !spec.equal(now.data, sent) || attachments.has(account);
        setState(account, { offline: false, error: null });
        // Edits made while this was in flight wait for their own Save. A
        // device question asked meanwhile is not answered by this write.
        const stored = {
          ...(now.ask?.source === "device" ? now : withoutAsk(now)),
          server: tracked(sent, res.rev),
          dirty,
        };
        if (attachments.has(account)) stored.attach = attachments.get(account);
        else delete stored.attach;
        storeSlot(account, stored);
        settle(tokens, {
          status: "sent",
          rev: res.rev,
          ...(res.attachmentOmitted ? { attachmentOmitted: true } : {}),
        });
        return;
      }
      if (res.status === "conflict") {
        if (attempt >= maxConflictRetries) {
          emit({ account, step: "write", detail: "conflict: gave up" });
          setState(account, { error: "Sync conflict — try again" });
          settle(tokens, {
            status: "unsent",
            error: "Sync conflict — try again",
          });
          return;
        }
        // Another tab moved the slot past the copy this rejection carries:
        // retry on what it learned instead of merging an older copy.
        if (serverViewMoved(account, revOf(slot.server))) {
          emit({ account, step: "write", detail: "conflict: stale, retry" });
          schedulePush(account, attempt + 1, tokens);
          return;
        }
        emit({ account, step: "write", detail: `conflict ${res.rev}` });
        reconcile(account, res.wire, res.rev, attempt + 1, tokens);
        return;
      }
      emit({ account, step: "write", detail: `error: ${res.message}` });
      setState(account, { error: res.message });
      settle(tokens, { status: "unsent", error: res.message });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      setState(account, { busy: null, error: message });
      settle(tokens, { status: "unsent", error: message });
      throw err;
    }
  }

  // ── Other tabs ───────────────────────────────────────────────────────────

  const unwatch = storage.watch((key, value) => {
    if (!key.startsWith(`lk:${spec.key}:`)) return;
    const slot = decodeSlot(value);
    slots.set(key, slot);
    if (value === null) lastSeen.delete(key);
    else lastSeen.set(key, JSON.stringify(value));
    if (active !== undefined && key === slotKey(active)) {
      rememberStored(active, slot);
      publish(active);
    }
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
      // The watcher may have cached this slot while another account was
      // active. Its question and attachment become this tab's again.
      rememberStored(id, slotOf(id));
      // The server copy may have moved while this account was inactive.
      if (id !== null)
        transients.set(slotKey(id), { ...stateOf(id), loaded: false });
      publish(id);
      if (id !== null) void enqueue(() => pull(id));
    },

    commit(next, opts) {
      const account = requireActive();
      let slot = slotOf(account);
      // Guests have device questions too. Ignoring them lets Save drop the
      // other copy while the in-memory question stays open.
      const pendingAsk = stateOf(account).ask ?? slot.ask;
      if (account !== null && opts?.attach) {
        attachments.set(account, {
          ...attachments.get(account),
          ...opts.attach,
        });
        slot = { ...slot, attach: attachments.get(account) };
      }
      let data = next;
      if (pendingAsk && spec.saveAnswersAsk === false) {
        // The open question stays until `resolve`, including a guest's
        // device question. A draft that now merges under the spec's limit
        // is stored; one that still asks is left open.
        const remote = pendingAsk.remote;
        // A device question keeps the copy both sides started from. The
        // editor's `basedOn` already holds its own side's additions.
        const base =
          pendingAsk.source === "server"
            ? baseOf(slot.server)
            : pendingAsk.base !== undefined
              ? pendingAsk.base
              : (opts?.basedOn ?? null);
        const merged = spec.merge(base, next, remote);
        if (merged === "ask") {
          storeSlot(account, {
            ...slot,
            data: next,
            dirty: account !== null,
            ask: pendingAsk,
          });
          setState(account, { ask: pendingAsk });
          return Promise.resolve({ status: "ask", account });
        }
        setState(account, { ask: null });
        const server =
          pendingAsk.source === "server"
            ? tracked(remote, pendingAsk.rev)
            : pendingAsk.server;
        const agreed =
          pendingAsk.source === "server" ? remote : baseOf(pendingAsk.server);
        slot = withoutAsk({
          ...slot,
          data: merged,
          server,
          dirty:
            account !== null &&
            (agreed === null || !spec.equal(merged, agreed)),
        });
        data = merged;
      } else if (pendingAsk) {
        // Saving is the user's answer to the open question: their copy wins.
        setState(account, { ask: null });
        slot = answerAsk(slot, pendingAsk, "local");
      }
      // Without a draft base, the edit was made from what this tab showed.
      // Another tab may have stored newer data since (its event is late).
      const basedOn =
        opts?.basedOn ?? (shown?.account === account ? shown.data : undefined);
      if (
        basedOn !== undefined &&
        !pendingAsk &&
        !spec.equal(basedOn, slot.data)
      ) {
        const merged = spec.merge(basedOn, next, slot.data);
        if (merged !== "ask") {
          data = merged;
        } else {
          // Keep the stored copy as the other side. Both live on the slot,
          // including for a guest, where there is no server to send to.
          const ask: Ask<T> = {
            source: "device",
            remote: slot.data,
            server: slot.server,
            dirty: slot.dirty,
            base: basedOn,
          };
          storeSlot(account, {
            ...slot,
            data: next,
            dirty: account !== null,
            ask,
          });
          setState(account, { ask });
          return Promise.resolve({ status: "ask", account });
        }
      }
      // Unsent edits are flushed even when unchanged (a retry). A write in
      // flight moves the base, so a save during it is sent after it. With no
      // agreed copy (`unseen`), there is nothing to be equal to.
      const base = baseOf(slot.server);
      const dirty =
        account !== null &&
        (slot.dirty ||
          stateOf(account).busy === "write" ||
          base === null ||
          !spec.equal(data, base) ||
          attachments.has(account));
      const saved = withoutAsk({ ...slot, data, dirty });
      if (account !== null && attachments.has(account)) {
        saved.attach = attachments.get(account);
      }
      storeSlot(account, saved);
      if (account === null)
        return Promise.resolve({ status: "local", account });
      if (!dirty) return Promise.resolve({ status: "unchanged", account });
      setState(account, { error: null });
      return send(account);
    },

    refresh() {
      const account = requireActive();
      if (account === null) return Promise.resolve();
      return enqueue(() => pull(account));
    },

    resolve(choice, expected) {
      const account = requireActive();
      // Read storage first: another tab may have replaced the question, and
      // `slotOf` updates this tab's copy of it.
      const current = slotOf(account);
      const ask = stateOf(account).ask ?? current.ask;
      if (!ask) return Promise.resolve({ status: "unchanged", account });
      if (expected !== undefined && !spec.equal(ask.remote, expected)) {
        // Show the question that replaced it, so it can be answered.
        publish(account);
        return Promise.resolve({ status: "unchanged", account });
      }
      if (account === null && ask.source !== "device") {
        return Promise.resolve({ status: "unchanged", account });
      }
      setState(account, { ask: null });
      const answered = answerAsk(slotOf(account), ask, choice);
      if (account !== null && !answered.attach) attachments.delete(account);
      if (account === null) {
        storeSlot(account, { ...answered, dirty: false });
        return Promise.resolve({
          status: choice === "local" ? "local" : "unchanged",
          account,
        });
      }
      storeSlot(account, answered);
      if (choice === "remote") {
        return Promise.resolve({ status: "unchanged", account });
      }
      return send(account);
    },

    adoptGuest() {
      const account = requireActive();
      if (account === null) {
        return Promise.resolve({ status: "unchanged", account });
      }
      const guest = slotOf(null);
      // An empty guest slot has nothing to upload and must not wipe this copy.
      if (spec.equal(guest.data, spec.empty())) {
        return Promise.resolve({ status: "unchanged", account });
      }
      const slot = slotOf(account);
      const wrote = storeSlot(account, {
        ...withoutAsk(slot),
        data: guest.data,
        dirty: true,
      });
      // Adopted once: another account cannot take the same data later.
      // Keep the guest slot when the destination write did not land.
      if (wrote) storeSlot(null, emptySlot());
      return send(account);
    },

    discardServer() {
      const account = requireActive();
      if (account === null) {
        return Promise.resolve<DiscardResult>({
          removed: false,
          message: null,
        });
      }
      let outcome: DiscardResult = { removed: false, message: null };
      const run = enqueue(async () => {
        // The cookie now belongs to someone else. Their row is not deleted.
        if (account !== active) return;
        const before = slotOf(account).data;
        const attachBefore = attachments.get(account);
        try {
          const res = await transport.remove(account);
          if (res.status !== "removed") {
            outcome = { removed: false, message: res.message };
            return;
          }
        } catch (err) {
          console.error(`[sync:${spec.key}] discard failed:`, err);
          outcome = {
            removed: false,
            message: err instanceof Error ? err.message : "Sync failed",
          };
          return;
        }
        outcome = { removed: true };
        const now = slotOf(account);
        // A save during the delete is a new upload, not the copy we removed.
        // That includes one that only attached new inventory.
        if (
          !spec.equal(now.data, before) ||
          attachments.get(account) !== attachBefore
        ) {
          return;
        }
        const next = withoutAsk({
          ...now,
          dirty: false,
          server: detached(now.server),
        });
        delete next.attach;
        attachments.delete(account);
        storeSlot(account, next);
        setState(account, { ask: null, error: null, offline: false });
      });
      return run.then(() => outcome);
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
