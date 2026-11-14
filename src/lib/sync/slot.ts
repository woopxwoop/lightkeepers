/**
 * What storage holds for one account of a synced document, and the open
 * questions about it (design: docs/design/account-sync.md).
 *
 * A slot is this device's `data`, whether it has edits the server has not
 * accepted (`dirty`), and what it knows about the server copy (`server`).
 * The server states are named so each one's rules are visible where they
 * apply, instead of being read off which fields happen to be null.
 */

/**
 * What a slot knows about the account's server copy.
 *
 * - `unseen`: no server copy has reached this slot. A read that finds none
 *   takes this device's data as the account's first copy; one that finds a
 *   copy merges with no base, so every item counts as added.
 * - `detached`: both sides agreed on `base` once, but the slot holds no
 *   server revision. The server copy was deleted, or the data came from
 *   storage older than revisions. Writes create a copy; a read never treats
 *   this device's data as a first upload, so a deleted copy stays deleted
 *   until the user saves.
 * - `tracked`: as far as this slot knows, the server is at `rev`, holding
 *   `base`. Writes are compare-and-swap on `rev`.
 */
export type ServerCopy<T> =
  | { state: "unseen" }
  | { state: "detached"; base: T }
  | { state: "tracked"; base: T; rev: string };

export type SyncSlot<T> = {
  v: number;
  data: T;
  /** `data` has edits the server has not accepted. */
  dirty: boolean;
  server: ServerCopy<T>;
  /**
   * Open question, stored with the slot so a reload still has both copies.
   * Absent once the user has answered.
   */
  ask?: Ask<T>;
  /**
   * Body fields for the next write (GOOD inventory). Kept until that write
   * is accepted so a reload can retry them. Not part of `data`.
   */
  attach?: Record<string, unknown>;
};

/**
 * An open question for the user: this device's `data` or `remote`.
 *
 * - `server`: `remote` is the server's copy at `rev`. Either answer makes it
 *   the agreed copy.
 * - `device`: `remote` is this device's newer stored copy (a draft saved over
 *   edits made elsewhere on the device). The server never had it, so either
 *   answer keeps that copy's own server state and unsent edits.
 */
export type Ask<T> =
  | { source: "server"; remote: T; rev: string }
  | {
      source: "device";
      remote: T;
      server: ServerCopy<T>;
      dirty: boolean;
      /**
       * The copy both sides started from, when known. A later Save merges
       * against it, not against the editor's own (already edited) baseline.
       * `null`: no common copy, every item counts as added.
       */
      base?: T | null;
    };

function unseen<T>(): ServerCopy<T> {
  return { state: "unseen" };
}

export function tracked<T>(base: T, rev: string): ServerCopy<T> {
  return { state: "tracked", base, rev };
}

/** The server has no copy now: keep what was agreed, drop the revision. */
export function detached<T>(server: ServerCopy<T>): ServerCopy<T> {
  return server.state === "unseen"
    ? server
    : { state: "detached", base: server.base };
}

/** The merge base: the last copy both sides agreed on, if any. */
export function baseOf<T>(server: ServerCopy<T>): T | null {
  return server.state === "unseen" ? null : server.base;
}

/** The revision a write is compared against. Null: create only. */
export function revOf<T>(server: ServerCopy<T>): string | null {
  return server.state === "tracked" ? server.rev : null;
}

export function emptySlot<T>(data: T, v: number): SyncSlot<T> {
  return { v, data, dirty: false, server: unseen() };
}

/** The slot once `choice` answers `ask`. The question itself is dropped. */
export function answerAsk<T>(
  slot: SyncSlot<T>,
  ask: Ask<T>,
  choice: "local" | "remote",
): SyncSlot<T> {
  const { ask: _drop, ...rest } = slot;
  const server =
    ask.source === "server" ? tracked(ask.remote, ask.rev) : ask.server;
  if (choice === "local") return { ...rest, server, dirty: true };
  // The server copy wins: an attachment queued for the dropped copy must not
  // ride the next write.
  if (ask.source === "server") delete rest.attach;
  return {
    ...rest,
    data: ask.remote,
    server,
    dirty: ask.source === "device" ? ask.dirty : false,
  };
}

/** Slot with no open question. */
export function withoutAsk<T>(slot: SyncSlot<T>): SyncSlot<T> {
  if (!slot.ask) return slot;
  const { ask: _drop, ...rest } = slot;
  return rest;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Untrusted stored JSON → slot. Never throws. Also reads slots stored before
 * `server` existed (`base` + `baseRev`): a base with a revision is tracked,
 * a base without one detached, no base unseen.
 */
export function decodeSlot<T>(
  raw: unknown,
  parse: (raw: unknown) => T,
  empty: () => T,
  v: number,
): SyncSlot<T> {
  const record = asRecord(raw);
  if (!record) return emptySlot(empty(), v);
  const ask = decodeAsk(record.ask, parse);
  const attach = asRecord(record.attach);
  return {
    v,
    data: parse(record.data),
    dirty: record.dirty === true,
    server: decodeServer(record, parse),
    ...(ask ? { ask } : {}),
    ...(attach ? { attach } : {}),
  };
}

function decodeAsk<T>(raw: unknown, parse: (raw: unknown) => T): Ask<T> | null {
  const ask = asRecord(raw);
  if (!ask) return null;
  if (ask.source === "server" && typeof ask.rev === "string") {
    return { source: "server", remote: parse(ask.remote), rev: ask.rev };
  }
  if (ask.source === "device") {
    return {
      source: "device",
      remote: parse(ask.remote),
      server: decodeServerValue(ask.server, parse),
      dirty: ask.dirty === true,
      ...(ask.base === null
        ? { base: null }
        : ask.base !== undefined
          ? { base: parse(ask.base) }
          : {}),
    };
  }
  return null;
}

function decodeServerValue<T>(
  value: unknown,
  parse: (raw: unknown) => T,
): ServerCopy<T> {
  const server = asRecord(value);
  if (!server) return unseen();
  if (server.state === "tracked" && typeof server.rev === "string") {
    return tracked(parse(server.base), server.rev);
  }
  if (server.state === "detached") {
    return { state: "detached", base: parse(server.base) };
  }
  return unseen();
}

function decodeServer<T>(
  record: Record<string, unknown>,
  parse: (raw: unknown) => T,
): ServerCopy<T> {
  if (record.server) return decodeServerValue(record.server, parse);
  // Stored before `server` existed.
  if (record.base == null) return unseen();
  const base = parse(record.base);
  return typeof record.baseRev === "string"
    ? tracked(base, record.baseRev)
    : { state: "detached", base };
}
