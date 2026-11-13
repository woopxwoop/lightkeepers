/**
 * Shared fixtures for the synced-document tests: a small list spec and a fake
 * server that applies the real route rules (`baseRev` compare-and-swap,
 * create-only on null, refusing a write for an account that is not signed in).
 */
import { defineSyncedDocSpec, type MergeResult } from "./synced-doc.ts";
import type { SyncTransport } from "./transport.ts";

export type Doc = { items: string[]; pick: string | null };

export const doc = (...items: string[]): Doc => ({ items, pick: null });

export function strings(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === "string")
    : [];
}

/** Union merge: keep local adds and removes, take the rest from remote. */
export function unionMerge(base: Doc | null, local: Doc, remote: Doc): Doc {
  const before = new Set(base?.items ?? []);
  const localSet = new Set(local.items);
  const removed = new Set([...before].filter((x) => !localSet.has(x)));
  const items = remote.items.filter((x) => !removed.has(x));
  // Only local adds. An item that was already in the base and that remote
  // deleted stays deleted.
  for (const x of local.items) {
    if (!items.includes(x) && !before.has(x)) items.push(x);
  }
  return { items, pick: local.pick };
}

export function makeSpec(mode: { ask: boolean } = { ask: false }) {
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

export function fakeServer() {
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
    async remove() {
      const session = server.session;
      calls.push(`remove:${session}`);
      await gate;
      if (session === null) return { status: "error", message: "401" };
      rows.delete(session);
      return { status: "removed" };
    },
  };
  return { server, transport };
}
