/**
 * Account-synced documents — contract only (design: docs/design/account-sync.md).
 *
 * A synced data type is one `SyncedDocSpec`. The engine (phase 1) owns the
 * request queue, per-account slots, status, and account switches, so specs and
 * pages never handle request ordering themselves.
 */

import type { Readable } from "svelte/store";

/** `merge` asks the user instead of choosing (roster conflict prompt). */
export type MergeResult<T> = T | "ask";

export type SyncedDocSpec<T> = {
  /** Slot name. Stored as `lk:<key>:<accountId|guest>`. */
  key: string;
  /** GET → { data, rev }. POST { data, baseRev } → 200 { rev } | 409 { data, rev }. */
  endpoint: string;
  /** Bump when `T` changes shape. `parse` must accept every older version. */
  schemaVersion: number;
  empty(): T;
  /** Untrusted storage or server JSON → T. Drops invalid parts, never throws. */
  parse(raw: unknown): T;
  /** Sync-relevant equality (ignores UI-only fields such as a selection). */
  equal(a: T, b: T): boolean;
  /**
   * Three-way merge after a 409. `base` is the last copy both sides agreed
   * on, or null when the server never had one.
   */
  merge(base: T | null, local: T, remote: T): MergeResult<T>;
};

export type SyncStatus =
  "loading" | "synced" | "dirty" | "saving" | "offline" | "ask";

export type SyncView<T> = {
  /** Account this view's slot belongs to. `null` is the guest slot. */
  account: string | null;
  data: T;
  status: SyncStatus;
  error: string | null;
};

/** What localStorage holds for one account. */
export type SyncSlot<T> = {
  v: number;
  data: T;
  base: T | null;
  baseRev: string | null;
  dirty: boolean;
};

export interface SyncedDoc<T> {
  readonly view: Readable<SyncView<T>>;
  /** Layout session effect only. Queued work for other accounts writes only their slots. */
  setAccount(id: string | null): void;
  /** Store `next` in the active slot, then send it. */
  commit(next: T): Promise<void>;
  refresh(): Promise<void>;
  /** Answers status `ask`. */
  resolve(choice: "local" | "remote"): Promise<void>;
  /** The only cross-account copy: guest slot → active account. */
  adoptGuest(): Promise<void>;
}

/** Typed identity for specs, so a spec is checked where it is declared. */
export function defineSyncedDocSpec<T>(
  spec: SyncedDocSpec<T>,
): SyncedDocSpec<T> {
  return spec;
}
